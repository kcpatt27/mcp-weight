import { readFileSync } from "node:fs";
import type { ScanReport } from "./types.js";

/**
 * Transcript dialects:
 * - `simple` — OpenAI-style assistant messages: `message.tool_calls[]`.
 * - `claude-code` — Anthropic-style assistant messages:
 *   `message.content[]` blocks with `type: "tool_use"`.
 * - `auto` (default) — extract both shapes from whatever each line contains.
 */
export type TranscriptFormat = "auto" | "simple" | "claude-code";

export interface ToolCall {
  name: string;
  arguments: unknown;
}

export interface TranscriptEntry {
  type: string;
  message?: {
    role?: string;
    content?: string | unknown[];
    tool_calls?: ToolCall[];
  } | null;
  [k: string]: unknown;
}

export interface UsageRow {
  tool: string;
  calls: number;
  tokens?: number;
  tokenSource: "scan-report" | "count-only";
}

export interface UsageReport {
  schemaVersion: 1;
  transcript: string;
  scannedAt: string;
  /** Dialect detected in the file (or selected explicitly). */
  format: TranscriptFormat | "mixed" | "none";
  tool: { name: string; version: string } | null;
  totalCalls: number;
  totalTools: number;
  rows: UsageRow[];
  errors: string[];
}

export interface UsageOptions {
  scanReport?: ScanReport;
  /** Transcript dialect. `auto` (default) extracts both shapes. */
  format?: TranscriptFormat;
}

interface ExtractedCall {
  name: string;
  id?: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Extract tool calls from one assistant message.
 * Counts each call once; callers dedupe by `id` across the transcript.
 */
function extractToolCalls(message: Record<string, unknown>, format: TranscriptFormat): ExtractedCall[] {
  const calls: ExtractedCall[] = [];
  const wantSimple = format === "auto" || format === "simple";
  const wantClaude = format === "auto" || format === "claude-code";

  if (wantSimple && Array.isArray(message.tool_calls)) {
    for (const raw of message.tool_calls) {
      if (!isRecord(raw)) continue;
      const name = raw.name;
      if (typeof name !== "string" || name.length === 0) continue;
      const id = raw.id;
      calls.push({ name, id: typeof id === "string" ? id : undefined });
    }
  }

  if (wantClaude && Array.isArray(message.content)) {
    for (const raw of message.content) {
      if (!isRecord(raw) || raw.type !== "tool_use") continue;
      const name = raw.name;
      if (typeof name !== "string" || name.length === 0) continue;
      const id = raw.id;
      calls.push({ name, id: typeof id === "string" ? id : undefined });
    }
  }

  return calls;
}

function hasClaudeToolUse(message: Record<string, unknown>): boolean {
  if (!Array.isArray(message.content)) return false;
  return message.content.some((block) => isRecord(block) && block.type === "tool_use");
}

/**
 * Parse a JSONL session transcript and return per-tool call counts, with
 * optional schema-token weight from a scan report.
 *
 * Each non-blank line must be a JSON object with a `type` field. Lines that are
 * not objects, invalid JSON, or missing `type` produce an error entry and are
 * skipped; every other unrecognized shape is skipped silently. Tool calls come
 * from assistant messages, in either supported dialect (see `TranscriptFormat`).
 *
 * Calls carrying an `id` are counted once (transcripts may repeat a call across
 * streamed updates). If a `scanReport` is provided, each tool row is enriched
 * with its schema-token weight; tools not found get `tokenSource: "count-only"`.
 */
export function parseTranscript(text: string, opts: UsageOptions = {}): UsageReport {
  const format = opts.format ?? "auto";
  const lines = text.split("\n");
  const errors: string[] = [];
  const callCounts = new Map<string, number>();
  const seenIds = new Set<string>();
  let totalCalls = 0;
  let sawSimple = false;
  let sawClaude = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    if (line.trim().length === 0) continue;

    let entry: TranscriptEntry;
    try {
      const parsed: unknown = JSON.parse(line);
      if (!isRecord(parsed)) {
        errors.push(`line ${i + 1}: not a JSON object`);
        continue;
      }
      entry = parsed as TranscriptEntry;
    } catch {
      errors.push(`line ${i + 1}: not valid JSON`);
      continue;
    }

    if (typeof entry.type !== "string") {
      errors.push(`line ${i + 1}: missing or non-string "type" field`);
      continue;
    }

    const msg = entry.message;
    if (!isRecord(msg)) continue;
    if (msg.role !== "assistant") continue;

    if ((format === "auto" || format === "simple") && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
      sawSimple = true;
    }
    if ((format === "auto" || format === "claude-code") && hasClaudeToolUse(msg)) {
      sawClaude = true;
    }

    for (const call of extractToolCalls(msg, format)) {
      if (call.id) {
        if (seenIds.has(call.id)) continue;
        seenIds.add(call.id);
      }
      callCounts.set(call.name, (callCounts.get(call.name) ?? 0) + 1);
      totalCalls++;
    }
  }

  // Build a scan-report token map: tool name → token weight.
  const scanTokenMap = new Map<string, number>();
  if (opts.scanReport) {
    for (const server of opts.scanReport.servers) {
      if (server.status !== "ok") continue;
      for (const tool of server.tools) {
        if (!scanTokenMap.has(tool.name)) {
          scanTokenMap.set(tool.name, tool.tokens);
        }
      }
    }
  }

  const rows: UsageRow[] = [...callCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tool, calls]) => {
      const tokens = scanTokenMap.get(tool);
      return {
        tool,
        calls,
        tokens,
        tokenSource: tokens !== undefined ? "scan-report" : "count-only",
      };
    });

  const detected: UsageReport["format"] =
    sawSimple && sawClaude ? "mixed" : sawClaude ? "claude-code" : sawSimple ? "simple" : "none";

  return {
    schemaVersion: 1,
    transcript: "",
    scannedAt: new Date().toISOString(),
    format: detected,
    tool: opts.scanReport ? opts.scanReport.tool : null,
    totalCalls,
    totalTools: callCounts.size,
    rows,
    errors,
  };
}

/**
 * Read a transcript file from disk and parse it.
 */
export function readTranscriptFile(filePath: string, opts: UsageOptions = {}): UsageReport {
  const text = readFileSync(filePath, "utf8");
  const report = parseTranscript(text, opts);
  report.transcript = filePath;
  return report;
}