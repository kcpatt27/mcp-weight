# mcp-weight

**Weigh your MCP stack.** Finds the MCP configs on your machine, connects to
every configured server, and reports how many context tokens their tool schemas
cost — per tool, per server, per client, with provenance.

**Status:** v0.1.0 published to npm. Honest frontier: [`ROADMAP.md`](ROADMAP.md).

[![npm](https://img.shields.io/npm/v/mcp-weight)](https://www.npmjs.com/package/mcp-weight)
[![ci](https://github.com/kcpatt27/mcp-weight/actions/workflows/ci.yml/badge.svg)](https://github.com/kcpatt27/mcp-weight/actions/workflows/ci.yml)

## Why

Every MCP server injects its tool definitions (name + description + JSON
schema) into context on every turn — before the user types anything. Four
config files across three apps later, nobody knows what the stack costs.

Related work exists and is credited in [`SPEC.md`](SPEC.md) §4:
`context-tax` (per-use, Claude Code), `tooltax` (server leaderboard),
`mcp-tax` (Claude configs), `mcp-diet` (config profiles). `mcp-weight`'s angle:
**cross-client measurement with provenance, snapshots, and no fake precision.**

## Quick start

```bash
npx mcp-weight scan        # pretty report
npx mcp-weight scan --json # machine-readable
```

From source:

```bash
npm install && npm run build
node dist/src/cli.js scan
```

Point it at specific files instead of auto-discovery:

```bash
npx mcp-weight scan --config ~/.cursor/mcp.json --config ./opencode.jsonc
```

## What a report looks like

Captured on the author's machine, 2026-10-05 (one Cursor config, one OpenCode
config; `perplexica-local` was down, which is exactly the partial-result path):

```text
mcp-weight 0.1.0 — MCP context weight report
Tokenizer: cl100k_base (proxy tokenizer: comparable across servers, not provider-native (up to ~15% off))
Scanned: 2026-10-05T20:36:29.374Z · window basis: 200,000 tokens

CLIENT    SERVER             TOOLS  TOKENS  ~TOKENS  STATUS
--------  -----------------  -----  ------  -------  ------
cursor    perplexica-local       -       -        -  error
cursor    memvid                 7   1,414   ~1,659  ok
cursor    home-agent-memory      2     184     ~213  ok
opencode  perplexica            11   1,312   ~1,468  ok

Total: 20 tools · 2,910 tokens (1.5% of window) · 4 servers (3 ok, 1 failed, 0 disabled)

! cursor/perplexica-local: error — MCP error -32000: Connection closed
```

`--verbose` adds a per-tool breakdown (e.g. `memvid`'s `create_memory_bank`
alone is 493 tokens).

## What is measured

- Tool `name` + `description` + `inputSchema` JSON, tokenized with
  **`cl100k_base` (labeled proxy)** plus a chars/4 estimate.
- Per-server totals and share of a 200k-token window (configurable display).
- Provenance on every row: client, config path, transport, server version.
- Failures are per-row `error` / `timeout` — a broken server never aborts the
  scan.
- Secrets: env/header values are never printed; only keys.

## Snapshot + diff (CI gate)

```bash
mcp-weight scan --out baseline.json         # commit this once
mcp-weight scan --out current.json
mcp-weight diff baseline.json current.json --fail-over 2000   # exit 2 if total grows > 2000 tokens
```

In a workflow:

```yaml
- run: npm ci && npm run build
- run: node dist/src/cli.js scan --config .cursor/mcp.json --out current.json
- run: node dist/src/cli.js diff baseline.json current.json --fail-over 2000
```

`--fail-over` is absolute tokens; `--fail-percent` is a percentage. With
neither flag, `diff` reports and exits 0.

## Clients scanned

| Client | Config paths |
| --- | --- |
| Cursor | `~/.cursor/mcp.json`, `./.cursor/mcp.json` |
| Claude Code | `~/.claude.json`, `./.mcp.json` |
| Claude Desktop | `%APPDATA%\Claude\claude_desktop_config.json` (platform paths) |
| OpenCode | `~/.config/opencode/opencode.jsonc`, `./opencode.jsonc` |
| VS Code | `%APPDATA%\Code\User\mcp.json`, `./.vscode/mcp.json` |
| Codex | `~/.codex/config.toml`, `./.codex/config.toml` (TOML) |
| Any (explicit) | `--config <path>` (JSON/JSONC/TOML auto-detected) |

Project configs are discovered from the working directory **up to the git root**;
user-level configs are always checked.

Remote (HTTP) servers are probed as Streamable HTTP and then legacy SSE.
Auth failures, missing commands, and unreachable servers get an actionable
`hint` on the row instead of aborting the scan.

## Documentation (reading order)

1. [`SPEC.md`](SPEC.md) — source of truth: problem, scope, success criteria.
2. [`ROADMAP.md`](ROADMAP.md) — ladder and current frontier.
3. [`ARCHITECTURE.md`](ARCHITECTURE.md) — design, as-built truth, limits.
4. [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) — map, environment, glossary.
5. [`DECISIONS.md`](DECISIONS.md) — ADR log.
6. [`AGENTS.md`](AGENTS.md) — session contract for agents (also good for humans).
7. [`CURRENT_STATE.md`](CURRENT_STATE.md) — live snapshot and session ledger.

## Research context

mcp-weight is the measurement instrument for the **MCP token tax** experiment in
[Context Lab](https://github.com/kcpatt27/context-lab), which studies how coding
agents spend and conserve context. Sibling project:
[living-state-machine](https://github.com/kcpatt27/living-state-machine) (prior
memory research). Tools stay standalone; the lab links them.

## License

MIT.