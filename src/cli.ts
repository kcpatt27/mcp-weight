#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clientForPath, discoverExisting } from "./config/discover.js";
import { parseConfigText } from "./config/parse.js";
import { probeServer } from "./mcp/probe.js";
import { buildTotals, formatReport } from "./report.js";
import { measureTool, TOKENIZER_NAME, TOKENIZER_NOTE } from "./tokens.js";
import type { ScanReport, ServerReport, ServerSpec } from "./types.js";

interface Args {
  command: string;
  configs: string[];
  json: boolean;
  verbose: boolean;
  timeoutMs: number;
  contextWindow: number;
  help: boolean;
  version: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    command: "scan",
    configs: [],
    json: false,
    verbose: false,
    timeoutMs: 15000,
    contextWindow: 200000,
    help: false,
    version: false,
  };
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    switch (a) {
      case "scan":
        args.command = "scan";
        break;
      case "help":
        args.command = "help";
        break;
      case "--config": {
        const v = argv[++i];
        if (!v) throw new Error("--config requires a path");
        args.configs.push(v);
        break;
      }
      case "--json":
        args.json = true;
        break;
      case "--verbose":
      case "-v":
        args.verbose = true;
        break;
      case "--timeout": {
        const v = Number(argv[++i]);
        if (!Number.isFinite(v) || v <= 0) throw new Error("--timeout requires milliseconds");
        args.timeoutMs = v;
        break;
      }
      case "--context-window": {
        const v = Number(argv[++i]);
        if (!Number.isFinite(v) || v <= 0) throw new Error("--context-window requires tokens");
        args.contextWindow = v;
        break;
      }
      case "--help":
      case "-h":
        args.help = true;
        break;
      case "--version":
        args.version = true;
        break;
      default:
        if (a.startsWith("-")) throw new Error(`unknown flag: ${a}`);
        positional.push(a);
    }
  }
  if (positional.length > 0) args.command = positional[0] as string;
  return args;
}

function readPackage(): { name: string; version: string } {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const p = path.join(dir, "package.json");
    if (existsSync(p)) {
      try {
        const j = JSON.parse(readFileSync(p, "utf8")) as { name?: string; version?: string };
        if (j.name && j.version) return { name: j.name, version: j.version };
      } catch {
        /* keep walking */
      }
    }
    dir = path.dirname(dir);
  }
  return { name: "mcp-weight", version: "0.0.0" };
}

function resolveSpecs(configs: string[]): ServerSpec[] {
  const specs: ServerSpec[] = [];
  const candidates = configs.length
    ? configs.map((p) => ({ client: clientForPath(path.resolve(p)), path: path.resolve(p) }))
    : discoverExisting(process.cwd());

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

async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (;;) {
      const i = index++;
      if (i >= items.length) return;
      results[i] = await fn(items[i] as T);
    }
  });
  await Promise.all(workers);
  return results;
}

async function scan(args: Args): Promise<number> {
  const specs = resolveSpecs(args.configs);
  if (specs.length === 0) {
    console.error(
      "No MCP configs found. Pass --config <path>, or run where a client config exists.\n" +
        "Looked for: Cursor, Claude Code, Claude Desktop, OpenCode, VS Code (project + user)."
    );
    return 1;
  }

  const pkg = readPackage();
  const servers = await pool(specs, 4, async (spec): Promise<ServerReport> => {
    const base = {
      name: spec.name,
      client: spec.client,
      sourcePath: spec.sourcePath,
      transport: spec.transport,
      enabled: spec.enabled,
      envKeys: spec.envKeys,
      headerKeys: spec.headerKeys,
    };
    if (!spec.enabled) {
      return { ...base, status: "disabled", tools: [], totalTokens: 0, totalChars: 0 };
    }
    const res = await probeServer(spec, args.timeoutMs);
    const tools = res.tools.map(measureTool);
    return {
      ...base,
      status: res.status,
      error: res.error,
      serverVersion: res.serverVersion,
      tools,
      totalTokens: tools.reduce((a, t) => a + t.tokens, 0),
      totalChars: tools.reduce((a, t) => a + t.chars, 0),
    };
  });

  const report: ScanReport = {
    schemaVersion: 1,
    tool: pkg,
    tokenizer: { name: TOKENIZER_NAME, note: TOKENIZER_NOTE },
    scannedAt: new Date().toISOString(),
    contextWindow: args.contextWindow,
    servers,
    totals: buildTotals(servers),
  };

  if (args.json) console.log(JSON.stringify(report, null, 2));
  else console.log(formatReport(report, args.verbose));
  return 0;
}

function printHelp(pkg: { name: string; version: string }): void {
  console.log(`${pkg.name} ${pkg.version} — weigh your MCP stack

Usage:
  mcp-weight scan [options]

Options:
  --config <path>        Scan a specific config file (repeatable)
  --json                 Machine-readable output
  --verbose, -v          Per-tool breakdown
  --timeout <ms>         Per-server probe timeout (default 15000)
  --context-window <n>   Window size for the % column (default 200000)
  --help, -h             Show this help
  --version              Show version

With no --config, scans discovered project + user configs for Cursor,
Claude Code, Claude Desktop, OpenCode, and VS Code.

Read-only: mcp-weight never writes configs and never prints secret values.`);
}

async function main(): Promise<number> {
  let args: Args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }
  const pkg = readPackage();
  if (args.version) {
    console.log(`${pkg.name} ${pkg.version}`);
    return 0;
  }
  if (args.help || args.command === "help") {
    printHelp(pkg);
    return 0;
  }
  if (args.command !== "scan") {
    console.error(`unknown command: ${args.command}`);
    printHelp(pkg);
    return 2;
  }
  try {
    return await scan(args);
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });