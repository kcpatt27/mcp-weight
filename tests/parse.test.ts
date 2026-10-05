import { test } from "node:test";
import assert from "node:assert/strict";
import { parseConfigText, stripJsonc } from "../src/config/parse.js";

test("stripJsonc removes line and block comments but preserves URLs in strings", () => {
  const input = `{
    // a comment
    "url": "https://example.com/mcp", /* block comment */
    "n": 1,
  }`;
  const out = stripJsonc(input);
  assert.ok(out.includes("https://example.com/mcp"));
  assert.ok(!out.includes("a comment"));
  const parsed = JSON.parse(out) as { url: string; n: number };
  assert.equal(parsed.url, "https://example.com/mcp");
  assert.equal(parsed.n, 1);
});

test("stripJsonc drops trailing commas before } and ]", () => {
  const out = stripJsonc('{"a":[1,2,],"b":{"c":1,},}');
  assert.deepEqual(JSON.parse(out), { a: [1, 2], b: { c: 1 } });
});

test("parses Cursor mcpServers shape (stdio)", () => {
  const text = JSON.stringify({
    mcpServers: {
      memvid: { command: "npx", args: ["-y", "memvid-mcp", "--server"], env: { K: "secret" } },
    },
  });
  const { shape, specs } = parseConfigText(text, "/home/u/.cursor/mcp.json", "cursor");
  assert.equal(shape, "mcpServers");
  assert.equal(specs.length, 1);
  const s = specs[0]!;
  assert.equal(s.name, "memvid");
  assert.equal(s.transport, "stdio");
  assert.equal(s.command, "npx");
  assert.deepEqual(s.args, ["-y", "memvid-mcp", "--server"]);
  assert.deepEqual(s.envKeys, ["K"]);
});

test("parses VS Code servers shape (http)", () => {
  const text = JSON.stringify({
    servers: { remote: { type: "http", url: "https://example.com/mcp" } },
  });
  const { shape, specs } = parseConfigText(text, "/x/.vscode/mcp.json", "vscode");
  assert.equal(shape, "servers");
  assert.equal(specs[0]!.transport, "http");
  assert.equal(specs[0]!.url, "https://example.com/mcp");
});

test("parses OpenCode mcp.servers shape (local command array + enabled flag)", () => {
  const text = `{
    "$schema": "https://opencode.ai/config.json",
    "mcp": {
      "servers": {
        "perplexica": { "type": "local", "command": ["node", "server.js"], "environment": { "TOKEN": "x" } },
        "off": { "type": "local", "command": ["node", "x.js"], "enabled": false },
        "remote": { "type": "remote", "url": "https://r.example.com/mcp" }
      }
    }
  }`;
  const { shape, specs } = parseConfigText(text, "C:/u/.config/opencode/opencode.jsonc", "opencode");
  assert.equal(shape, "mcp.servers");
  assert.equal(specs.length, 3);
  const perplexica = specs.find((s) => s.name === "perplexica")!;
  assert.equal(perplexica.command, "node");
  assert.deepEqual(perplexica.args, ["server.js"]);
  assert.deepEqual(perplexica.envKeys, ["TOKEN"]);
  assert.equal(specs.find((s) => s.name === "off")!.enabled, false);
  assert.equal(specs.find((s) => s.name === "remote")!.transport, "http");
});

test("parses Claude Code per-project mcpServers", () => {
  const text = JSON.stringify({
    mcpServers: { global: { command: "node", args: ["g.js"] } },
    projects: {
      "C:/proj": { mcpServers: { local: { command: "node", args: ["l.js"] } } },
    },
  });
  const { specs } = parseConfigText(text, "C:/u/.claude.json", "claude-code");
  assert.equal(specs.length, 2);
  assert.ok(specs.some((s) => s.name === "local" && s.sourcePath.includes("#project:")));
});

test("secret values are retained in memory but never surface as keys", () => {
  const secret = "sk-super-secret-123";
  const text = JSON.stringify({
    mcpServers: { s: { command: "node", args: ["x.js"], env: { API_KEY: secret } } },
  });
  const { specs } = parseConfigText(text, "x", "cursor");
  const spec = specs[0]!;
  assert.deepEqual(spec.envKeys, ["API_KEY"]);
  // The value is needed to launch the server, so it is present on the spec...
  assert.equal(spec.env?.API_KEY, secret);
  // ...but a report-shaped projection must not include it.
  const reportRow = { name: spec.name, client: spec.client, envKeys: spec.envKeys };
  assert.ok(!JSON.stringify(reportRow).includes(secret));
});