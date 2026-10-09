#!/usr/bin/env node
/**
 * Cross-platform test runner: Node's --test glob support differs by version,
 * so collect compiled test files ourselves and pass them explicitly.
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testsDir = path.join(root, "dist", "tests");

function collect(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collect(full));
    else if (entry.name.endsWith(".test.js")) out.push(full);
  }
  return out;
}

const files = collect(testsDir).sort();
if (files.length === 0) {
  console.error(`no compiled test files found under ${testsDir}`);
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
process.exit(result.status ?? 1);