import { test } from "node:test";
import assert from "node:assert/strict";
import { diffReports, evaluateThreshold, formatDiff } from "../src/diff.js";
import type { ScanReport, ServerReport } from "../src/types.js";

function server(over: Partial<ServerReport>): ServerReport {
  return {
    name: "s",
    client: "cursor",
    sourcePath: "x",
    transport: "stdio",
    enabled: true,
    status: "ok",
    tools: [],
    totalTokens: 0,
    totalChars: 0,
    ...over,
  };
}

function report(tokens: number, servers: ServerReport[], scannedAt = "2026-10-05T00:00:00.000Z"): ScanReport {
  return {
    schemaVersion: 1,
    tool: { name: "mcp-weight", version: "0.0.0" },
    tokenizer: { name: "cl100k_base", note: "test" },
    scannedAt,
    contextWindow: 200000,
    servers,
    totals: {
      servers: servers.length,
      ok: servers.filter((s) => s.status === "ok").length,
      failed: servers.filter((s) => s.status !== "ok" && s.status !== "disabled").length,
      disabled: servers.filter((s) => s.status === "disabled").length,
      tools: servers.reduce((a, s) => a + s.tools.length, 0),
      tokens,
      chars: 0,
    },
  };
}

test("diffReports detects added, removed, changed, and same servers", () => {
  const before = report(1000, [
    server({ name: "keep", totalTokens: 500 }),
    server({ name: "grow", totalTokens: 300 }),
    server({ name: "gone", totalTokens: 200 }),
  ]);
  const after = report(1400, [
    server({ name: "keep", totalTokens: 500 }),
    server({ name: "grow", totalTokens: 700 }),
    server({ name: "new", totalTokens: 200 }),
  ]);

  const d = diffReports(before, after);
  assert.equal(d.totals.beforeTokens, 1000);
  assert.equal(d.totals.afterTokens, 1400);
  assert.equal(d.totals.deltaTokens, 400);
  assert.equal(d.totals.deltaPercent, 40);

  const by = Object.fromEntries(d.servers.map((s) => [s.name, s]));
  assert.equal(by.keep?.change, "same");
  assert.equal(by.grow?.change, "changed");
  assert.equal(by.grow?.deltaTokens, 400);
  assert.equal(by.gone?.change, "removed");
  assert.equal(by.new?.change, "added");
});

test("evaluateThreshold gates on absolute and percent increases", () => {
  const d = diffReports(report(1000, [server({ name: "s", totalTokens: 1000 })]), report(1200, [server({ name: "s", totalTokens: 1200 })]));
  assert.equal(evaluateThreshold(d, {}).failed, false);
  assert.equal(evaluateThreshold(d, { failOver: 300 }).failed, false);
  assert.equal(evaluateThreshold(d, { failOver: 100 }).failed, true);
  assert.equal(evaluateThreshold(d, { failPercent: 25 }).failed, false);
  assert.equal(evaluateThreshold(d, { failPercent: 10 }).failed, true);
});

test("formatDiff shows totals and changed rows", () => {
  const d = diffReports(report(500, [server({ name: "a", totalTokens: 500 })]), report(900, [server({ name: "a", totalTokens: 900 })]));
  const out = formatDiff(d);
  assert.match(out, /TOTAL: 500 → 900 tokens \(\+400, \+80\.0%\)/);
  assert.match(out, /changed/);
  assert.match(out, /a/);
});