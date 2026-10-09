import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

// JSONL fixtures are not TypeScript, so `tsc` does not copy them into dist.
// Tests resolve fixtures relative to the compiled test file, so mirror them.
const from = path.join("tests", "fixtures");
const to = path.join("dist", "tests", "fixtures");
mkdirSync(to, { recursive: true });
for (const file of readdirSync(from)) {
  if (file.endsWith(".jsonl")) copyFileSync(path.join(from, file), path.join(to, file));
}