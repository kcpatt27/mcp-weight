import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ScanReport } from "../src/types.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, "..", "src", "cli.js");
const fixture = path.join(here, "fixtures", "fixture-server.js");

function tempDir(): string {
  return mkdtempSync(path.join(tmpdir(), "mcp-weight-"));
}

function run(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function reportJson(totalTokens: number, scannedAt: string): ScanReport {
  return {
    schemaVersion: 1,
    tool: { name: "mcp-weight", version: "0.0.0" },
    tokenizer: { name: "cl100k_base", note: "test" },
    scannedAt,
    contextWindow: 200000,
    servers: [
      {
        name: "s",
        client: "cursor",
        sourcePath: "x",
        transport: "stdio",
        enabled: true,
        status: "ok",
        tools: [{ name: "t", tokens: totalTokens, chars: 4, estimate: 1, descriptionChars: 0, schemaChars: 0 }],
        totalTokens,
        totalChars: 4,
      },
    ],
    totals: { servers: 1, ok: 1, failed: 0, disabled: 0, tools: 1, tokens: totalTokens, chars: 4 },
  };
}

test("scan --out writes a JSON report; a dead server is a partial row, exit 0", () => {
  const dir = tempDir();
  const config = path.join(dir, "mcp.json");
  const out = path.join(dir, "report.json");
  writeFileSync(
    config,
    JSON.stringify({
      mcpServers: {
        fixture: { command: process.execPath, args: [fixture] },
        dead: { command: "definitely-not-a-real-binary-xyz" },
      },
    })
  );

  const r = run(["scan", "--config", config, "--json", "--out", out]);
  assert.equal(r.status, 0, r.stderr);

  const report = JSON.parse(readFileSync(out, "utf8")) as ScanReport;
  assert.equal(report.totals.servers, 2);
  assert.equal(report.totals.ok, 1);
  assert.equal(report.totals.failed, 1);
  const fx = report.servers.find((s) => s.name === "fixture");
  assert.equal(fx?.status, "ok");
  assert.equal(fx?.tools.length, 3);
});

test("diff gates with --fail-over: exit 2 over threshold, exit 0 under", () => {
  const dir = tempDir();
  const before = path.join(dir, "before.json");
  const after = path.join(dir, "after.json");
  writeFileSync(before, JSON.stringify(reportJson(1000, "2026-10-05T00:00:00.000Z")));
  writeFileSync(after, JSON.stringify(reportJson(1500, "2026-10-09T00:00:00.000Z")));

  const over = run(["diff", before, after, "--fail-over", "100", "--json"]);
  assert.equal(over.status, 2);
  assert.match(over.stdout, /"deltaTokens": 500/);

  const under = run(["diff", before, after, "--fail-over", "1000"]);
  assert.equal(under.status, 0);
  assert.match(under.stdout, /\+500/);
});

test("diff rejects a file that is not a report", () => {
  const dir = tempDir();
  const bad = path.join(dir, "bad.json");
  writeFileSync(bad, JSON.stringify({ hello: "world" }));
  const r = run(["diff", bad, bad]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /not a mcp-weight report/);
});