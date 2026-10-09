import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTomlConfig } from "../src/config/parse.js";

const TOML = `
model = "gpt-5"
approval_policy = "on-request"

[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]
env = { "API_KEY" = "sk-secret", "REGION" = "us" }

[mcp_servers.remote]
url = "https://example.com/mcp"
`;

test("parses Codex mcp_servers from TOML (stdio + remote)", () => {
  const { shape, specs } = parseTomlConfig(TOML, "C:/Users/u/.codex/config.toml", "codex");
  assert.equal(shape, "toml:mcp_servers");
  assert.equal(specs.length, 2);

  const c7 = specs.find((s) => s.name === "context7");
  assert.equal(c7?.command, "npx");
  assert.deepEqual(c7?.args, ["-y", "@upstash/context7-mcp"]);
  assert.deepEqual(c7?.envKeys, ["API_KEY", "REGION"]);
  assert.equal(c7?.client, "codex");

  const remote = specs.find((s) => s.name === "remote");
  assert.equal(remote?.transport, "http");
  assert.equal(remote?.url, "https://example.com/mcp");
});

test("TOML env values stay out of a report projection", () => {
  const { specs } = parseTomlConfig(TOML, "x", "codex");
  const row = { name: specs[0]?.name, envKeys: specs[0]?.envKeys };
  assert.ok(!JSON.stringify(row).includes("sk-secret"));
});