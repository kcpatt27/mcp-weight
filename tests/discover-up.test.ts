import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { projectCandidatesUp } from "../src/config/discover.js";

function tree(): string {
  return mkdtempSync(path.join(tmpdir(), "mcp-weight-tree-"));
}

test("walks up to the git root, nearest first", () => {
  const root = tree();
  mkdirSync(path.join(root, ".git"));
  mkdirSync(path.join(root, "sub", ".cursor"), { recursive: true });
  const rootCfg = path.join(root, ".mcp.json");
  const subCfg = path.join(root, "sub", ".cursor", "mcp.json");
  writeFileSync(rootCfg, JSON.stringify({ mcpServers: {} }));
  writeFileSync(subCfg, JSON.stringify({ mcpServers: {} }));

  const paths = projectCandidatesUp(path.join(root, "sub")).map((c) => c.path);
  assert.equal(paths.length, 2);
  assert.equal(paths[0], subCfg);
  assert.equal(paths[1], rootCfg);
});

test("stops at the git root and does not climb past it", () => {
  const outer = tree();
  const repo = path.join(outer, "repo");
  mkdirSync(path.join(repo, ".git"), { recursive: true });
  mkdirSync(path.join(repo, "sub"));
  writeFileSync(path.join(outer, ".mcp.json"), JSON.stringify({ mcpServers: {} }));

  const paths = projectCandidatesUp(path.join(repo, "sub")).map((c) => c.path);
  assert.ok(!paths.some((p) => p === path.join(outer, ".mcp.json")));
});
