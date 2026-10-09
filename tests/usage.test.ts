import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseTranscript, readTranscriptFile } from "../src/usage.js";
import type { ScanReport } from "../src/types.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const transcriptFixture = path.join(here, "fixtures", "transcript.jsonl");

const sampleScanReport: ScanReport = {
  schemaVersion: 1,
  tool: { name: "mcp-weight", version: "0.0.0" },
  tokenizer: { name: "cl100k_base", note: "test" },
  scannedAt: "2026-10-09T00:00:00.000Z",
  contextWindow: 200000,
  servers: [
    {
      name: "fixture",
      client: "test",
      sourcePath: "x",
      transport: "stdio",
      enabled: true,
      status: "ok",
      tools: [
        { name: "Bash", tokens: 120, chars: 480, estimate: 120, descriptionChars: 10, schemaChars: 370 },
        { name: "Read", tokens: 85, chars: 340, estimate: 85, descriptionChars: 8, schemaChars: 252 },
        { name: "Glob", tokens: 60, chars: 240, estimate: 60, descriptionChars: 6, schemaChars: 174 },
      ],
      totalTokens: 265,
      totalChars: 1060,
    },
  ],
  totals: { servers: 1, ok: 1, failed: 0, disabled: 0, tools: 3, tokens: 265, chars: 1060 },
};

test("parseTranscript counts per-tool calls from a fixture JSONL transcript", () => {
  const text = [
    '{"type":"user","message":{"role":"user","content":"hi"}}',
    '{"type":"assistant","message":{"role":"assistant","tool_calls":[{"name":"Bash","arguments":{"command":"ls"}}]}}',
    '{"type":"assistant","message":{"role":"assistant","tool_calls":[{"name":"Bash","arguments":{"command":"cat x"}}]}}',
    '{"type":"assistant","message":{"role":"assistant","tool_calls":[{"name":"Read","arguments":{"file":"a.md"}}]}}',
    '{"type":"assistant","message":{"role":"assistant","tool_calls":[{"name":"Glob","arguments":{"pattern":"**/*.ts"}}]}}',
    '{"type":"assistant","message":{"role":"assistant","tool_calls":[{"name":"Glob","arguments":{"pattern":"**/*.json"}}]}}',
    '{"type":"assistant","message":{"role":"assistant","tool_calls":[{"name":"Glob","arguments":{"pattern":"**/*.md"}}]}}',
  ].join("\n");

  const report = parseTranscript(text);
  assert.equal(report.totalCalls, 6);
  assert.equal(report.totalTools, 3);
  assert.equal(report.rows.length, 3);

  const byName = new Map(report.rows.map((r) => [r.tool, r]));
  assert.equal(byName.get("Bash")?.calls, 2);
  assert.equal(byName.get("Read")?.calls, 1);
  assert.equal(byName.get("Glob")?.calls, 3);
});

test("parseTranscript enriches rows with scan-report token weights", () => {
  const text = [
    '{"type":"assistant","message":{"role":"assistant","tool_calls":[{"name":"Bash","arguments":{}}]}}',
    '{"type":"assistant","message":{"role":"assistant","tool_calls":[{"name":"Read","arguments":{}}]}}',
    '{"type":"assistant","message":{"role":"assistant","tool_calls":[{"name":"UnknownTool","arguments":{}}]}}',
  ].join("\n");

  const report = parseTranscript(text, { scanReport: sampleScanReport });
  assert.equal(report.totalCalls, 3);
  assert.equal(report.totalTools, 3);

  const byName = new Map(report.rows.map((r) => [r.tool, r]));
  const bash = byName.get("Bash")!;
  assert.equal(bash.calls, 1);
  assert.equal(bash.tokens, 120);
  assert.equal(bash.tokenSource, "scan-report");

  const read = byName.get("Read")!;
  assert.equal(read.calls, 1);
  assert.equal(read.tokens, 85);
  assert.equal(read.tokenSource, "scan-report");

  const unknown = byName.get("UnknownTool")!;
  assert.equal(unknown.calls, 1);
  assert.equal(unknown.tokens, undefined);
  assert.equal(unknown.tokenSource, "count-only");
});

test("parseTranscript skips non-object lines and unknown shapes with errors", () => {
  const text = [
    "not json at all",
    '{"type":"user","message":{"role":"user","content":"hi"}}',
    '{"type":123}',
    '{"noType":true}',
    '{"type":"assistant","message":{"role":"user","tool_calls":[{"name":"Bash","arguments":{}}]}}',
    '{"type":"assistant","message":{"role":"assistant","content":"no tool calls here"}}',
    '[]',
    '{"type":"assistant","message":{"role":"assistant","tool_calls":[]}}',
    '{"type":"assistant","message":{"role":"assistant","tool_calls":[{"name":"","arguments":{}}]}}',
  ].join("\n");

  const report = parseTranscript(text);
  assert.equal(report.totalCalls, 0);
  assert.equal(report.totalTools, 0);
  assert.equal(report.rows.length, 0);
  assert.equal(report.errors.length, 4);
});

test("parseTranscript returns empty report for empty input", () => {
  const report = parseTranscript("");
  assert.equal(report.totalCalls, 0);
  assert.equal(report.totalTools, 0);
  assert.equal(report.rows.length, 0);
  assert.equal(report.errors.length, 0);
});

test("readTranscriptFile reads and parses the fixture transcript", () => {
  const report = readTranscriptFile(transcriptFixture);
  assert.equal(report.totalCalls, 6);
  assert.equal(report.totalTools, 3);
  assert.equal(report.rows.length, 3);
  assert.equal(report.transcript, transcriptFixture);
});

test("readTranscriptFile enriches with scan report when provided", () => {
  const report = readTranscriptFile(transcriptFixture, { scanReport: sampleScanReport });
  const byName = new Map(report.rows.map((r) => [r.tool, r]));
  const bash = byName.get("Bash");
  const read = byName.get("Read");
  const glob = byName.get("Glob");
  assert.ok(bash);
  assert.ok(read);
  assert.ok(glob);
  assert.equal(bash.tokens, 120);
  assert.equal(bash.tokenSource, "scan-report");
  assert.equal(read.tokens, 85);
  assert.equal(read.tokenSource, "scan-report");
  assert.equal(glob.tokens, 60);
  assert.equal(glob.tokenSource, "scan-report");
});

test("parseTranscript without scanReport marks all rows as count-only", () => {
  const text = '{"type":"assistant","message":{"role":"assistant","tool_calls":[{"name":"Bash","arguments":{}}]}}';
  const report = parseTranscript(text);
  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0]!.tokens, undefined);
  assert.equal(report.rows[0]!.tokenSource, "count-only");
  assert.equal(report.tool, null);
});