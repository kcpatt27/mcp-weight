import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { probeServer } from "../src/mcp/probe.js";
import type { ServerSpec } from "../src/types.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(here, "fixtures", "fixture-server.js");

function fixtureSpec(overrides: Partial<ServerSpec> = {}): ServerSpec {
  return {
    name: "fixture",
    client: "test",
    sourcePath: "<fixture>",
    transport: "stdio",
    command: process.execPath,
    args: [fixture],
    enabled: true,
    ...overrides,
  };
}

test("end-to-end: probes the stdio fixture server and lists its tools", async () => {
  const res = await probeServer(fixtureSpec(), 15000);
  assert.equal(res.status, "ok", res.error);
  assert.equal(res.tools.length, 3);
  assert.match(res.serverVersion ?? "", /mcp-weight-fixture/);
  assert.deepEqual(
    res.tools.map((t) => t.name).sort(),
    ["fixture_alpha", "fixture_beta", "fixture_gamma"]
  );
});

test("a bad command yields an error result, not a thrown scan", async () => {
  const res = await probeServer(
    fixtureSpec({ command: "definitely-not-a-real-binary-xyz" }),
    15000
  );
  assert.equal(res.status, "error");
  assert.equal(res.tools.length, 0);
  assert.ok(res.error);
});