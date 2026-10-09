import { readFileSync } from "node:fs";
import path from "node:path";
import type { ServerSpec } from "../types.js";
import { clientForPath, discoverExisting } from "./discover.js";
import { parseConfigText } from "./parse.js";

export function resolveSpecs(configs: string[], cwd: string): ServerSpec[] {
  const specs: ServerSpec[] = [];
  const candidates = configs.length
    ? configs.map((p) => ({ client: clientForPath(path.resolve(p)), path: path.resolve(p) }))
    : discoverExisting(cwd);

  for (const c of candidates) {
    try {
      const text = readFileSync(c.path, "utf8");
      const parsed = parseConfigText(text, c.path, c.client);
      if (parsed.specs.length === 0) {
        console.error(`warn: no MCP servers found in ${c.path} (shape: ${parsed.shape})`);
      }
      specs.push(...parsed.specs);
    } catch (err) {
      console.error(
        `warn: failed to parse ${c.path}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  return specs;
}