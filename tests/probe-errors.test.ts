import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { classifyProbeError, probeServer } from "../src/mcp/probe.js";

test("classifyProbeError recognizes common failure classes", () => {
  assert.equal(classifyProbeError("Error POSTing (HTTP 401 Unauthorized)").kind, "auth");
  assert.equal(classifyProbeError("spawn npx ENOENT").kind, "not-found");
  assert.equal(classifyProbeError("connect ECONNREFUSED 127.0.0.1:9").kind, "connection");
  assert.equal(classifyProbeError("request timed out after 15s").kind, "timeout");
  assert.equal(classifyProbeError("something odd happened").kind, "other");
  assert.equal(classifyProbeError("spawn npx ENOENT").hint.length > 0, true);
});

test("an HTTP 401 server yields an error result with an actionable hint, not a crash", async () => {
  const server = http.createServer((_req, res) => {
    res.statusCode = 401;
    res.end("unauthorized");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  try {
    const res = await probeServer(
      {
        name: "auth",
        client: "remote",
        sourcePath: "x",
        transport: "http",
        url: `http://127.0.0.1:${port}/mcp`,
        enabled: true,
      },
      5000
    );
    assert.equal(res.status, "error");
    assert.equal(typeof res.hint, "string");
    assert.ok((res.hint ?? "").length > 0);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});