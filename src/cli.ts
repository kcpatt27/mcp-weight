#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveSpecs } from "./config/resolve.js";
import { diffReports, evaluateThreshold, formatDiff } from "./diff.js";
import { formatReport } from "./report.js";
import { scanSpecs } from "./scan.js";
import type { ScanReport } from "./types.js";

interface Args {
  command: string;
  configs: string[];
  json: boolean;
  verbose: boolean;
  timeoutMs: number;
  contextWindow: number;
  out?: string;
  failOver?: number;
  failPercent?: number;
  help: boolean;
  version: boolean;
}

function parseArgs(argv: string[]): { args: Args; positionals: string[] } {
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
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    switch (a) {
      case "scan":
      case "diff":
        args.command = a;
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
      case "--out": {
        const v = argv[++i];
        if (!v) throw new Error("--out requires a path");
        args.out = v;
        break;
      }
      case "--fail-over": {
        const v = Number(argv[++i]);
        if (!Number.isFinite(v)) throw new Error("--fail-over requires a token count");
        args.failOver = v;
        break;
      }
      case "--fail-percent": {
        const v = Number(argv[++i]);
        if (!Number.isFinite(v)) throw new Error("--fail-percent requires a percentage");
        args.failPercent = v;
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
        positionals.push(a);
    }
  }
  return { args, positionals };
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

function readReport(file: string): ScanReport {
  const parsed = JSON.parse(readFileSync(file, "utf8")) as ScanReport;
  if (!parsed || parsed.schemaVersion !== 1 || !Array.isArray(parsed.servers) || !parsed.totals) {
    throw new Error(`${file} is not a mcp-weight report (expected schemaVersion 1)`);
  }
  return parsed;
}

async function runScan(args: Args): Promise<number> {
  const specs = resolveSpecs(args.configs, process.cwd());
  if (specs.length === 0) {
    console.error(
      "No MCP configs found. Pass --config <path>, or run where a client config exists.\n" +
        "Looked for: Cursor, Claude Code, Claude Desktop, OpenCode, VS Code, Codex (project + user)."
    );
    return 1;
  }
  const pkg = readPackage();
  const report = await scanSpecs(specs, {
    timeoutMs: args.timeoutMs,
    contextWindow: args.contextWindow,
    tool: pkg,
  });

  if (args.out) {
    writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
    console.error(`wrote ${args.out}`);
  }
  if (args.json) console.log(JSON.stringify(report, null, 2));
  else console.log(formatReport(report, args.verbose));
  return 0;
}

function runDiff(args: Args, positionals: string[]): number {
  const beforeFile = positionals[0];
  const afterFile = positionals[1];
  if (!beforeFile || !afterFile) {
    console.error(
      "usage: mcp-weight diff <before.json> <after.json> [--fail-over N] [--fail-percent P] [--json]"
    );
    return 2;
  }
  const before = readReport(beforeFile);
  const after = readReport(afterFile);
  const diff = diffReports(before, after);

  if (args.json) console.log(JSON.stringify(diff, null, 2));
  else console.log(formatDiff(diff));

  const verdict = evaluateThreshold(diff, { failOver: args.failOver, failPercent: args.failPercent });
  if (verdict.failed) {
    console.error(`gate failed: ${verdict.reason}`);
    return 2;
  }
  return 0;
}

function printHelp(pkg: { name: string; version: string }): void {
  console.log(`${pkg.name} ${pkg.version} — weigh your MCP stack

Usage:
  mcp-weight scan [options]
  mcp-weight diff <before.json> <after.json> [options]

Scan options:
  --config <path>        Scan a specific config file (repeatable)
  --out <path>           Also write the JSON report to a file
  --json                 Machine-readable output
  --verbose, -v          Per-tool breakdown
  --timeout <ms>         Per-server probe timeout (default 15000)
  --context-window <n>   Window size for the % column (default 200000)

Diff options:
  --fail-over <tokens>   Exit 2 if total tokens increase by more than this
  --fail-percent <pct>   Exit 2 if total tokens increase by more than this %
  --json                 Machine-readable diff

  --help, -h             Show this help
  --version              Show version

With no --config, scans project configs from cwd up to the git root, plus
user configs, for Cursor, Claude Code, Claude Desktop, OpenCode, VS Code,
and Codex.

Exit codes: 0 ok · 1 error/no configs · 2 usage or gate failure.

Read-only: mcp-weight never writes configs and never prints secret values.`);
}

async function main(): Promise<number> {
  let parsed: { args: Args; positionals: string[] };
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }
  const { args, positionals } = parsed;
  const pkg = readPackage();

  if (args.version) {
    console.log(`${pkg.name} ${pkg.version}`);
    return 0;
  }
  if (args.help || args.command === "help") {
    printHelp(pkg);
    return 0;
  }
  try {
    if (args.command === "diff") return runDiff(args, positionals);
    if (args.command === "scan") return await runScan(args);
    console.error(`unknown command: ${args.command}`);
    printHelp(pkg);
    return 2;
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