import { readFileSync } from "node:fs";
import type { ScanReport } from "./types.js";

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
  tool: { name: string; version: string } | null;
  totalCalls: number;
  totalTools: number;
  rows: UsageRow[];
  errors: string[];
}

export interface UsageOptions {
  scanReport?: ScanReport;
}

/**
 * Parse a Claude Code-style JSONL transcript and return per-tool call
 * counts, with optional schema-token weight from a scan report.
 *
 * Each line must be a JSON object with a `type` field. Lines that are
 * not objects or lack `type` produce an error entry and are skipped.
 * Tool calls are extracted from assistant messages
 * (`message.role === "assistant"` and `message.tool_calls`).
 *
 * If a `scanReport` is provided, each tool row is enriched with its
 * schema-token weight from the scan report's per-server tool lists.
 * Tools not found in the scan report get `tokens: undefined` and
 * `tokenSource: "count-only"`.
 */
export function parseTranscript(
  text: string,
  opts: UsageOptions = {}
): UsageReport {
  const lines = text.split("\n");
  const errors: string[] = [];
  const callCounts = new Map<string, number>();
  let totalCalls = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    if (line.trim().length === 0) continue;
    let entry: TranscriptEntry;
    try {
      const parsed = JSON.parse(line);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
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
    if (!msg || typeof msg !== "object" || Array.isArray(msg)) continue;

    if (msg.role !== "assistant") continue;

    const toolCalls = msg.tool_calls;
    if (!Array.isArray(toolCalls)) continue;

    for (const tc of toolCalls) {
      if (!tc || typeof tc !== "object") continue;
      const name = tc.name;
      if (typeof name !== "string" || name.length === 0) continue;
      callCounts.set(name, (callCounts.get(name) ?? 0) + 1);
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

  return {
    schemaVersion: 1,
    transcript: "",
    scannedAt: new Date().toISOString(),
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
export function readTranscriptFile(
  filePath: string,
  opts: UsageOptions = {}
): UsageReport {
  const text = readFileSync(filePath, "utf8");
  const report = parseTranscript(text, opts);
  report.transcript = filePath;
  return report;
}
