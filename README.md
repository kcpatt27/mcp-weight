# mcp-weight

**Weigh your MCP stack.** Finds the MCP configs on your machine, connects to
every configured server, and reports how many context tokens their tool schemas
cost — per tool, per server, per client, with provenance.

**Status:** v0.1 in development. The scan runs from a local checkout; npm
publish is pending. Honest frontier: [`ROADMAP.md`](ROADMAP.md).

![status: MVP in progress](https://img.shields.io/badge/status-v0.1%20in%20development-yellow)

## Why

Every MCP server injects its tool definitions (name + description + JSON
schema) into context on every turn — before the user types anything. Four
config files across three apps later, nobody knows what the stack costs.

Related work exists and is credited in [`SPEC.md`](SPEC.md) §4:
`context-tax` (per-use, Claude Code), `tooltax` (server leaderboard),
`mcp-tax` (Claude configs), `mcp-diet` (config profiles). `mcp-weight`'s angle:
**cross-client measurement with provenance, snapshots, and no fake precision.**

## Quick start (from source)

```bash
npm install
npm run build
node dist/src/cli.js scan        # pretty report
node dist/src/cli.js scan --json # machine-readable
```

Point it at specific files instead of auto-discovery:

```bash
node dist/src/cli.js scan --config ~/.cursor/mcp.json --config ./opencode.jsonc
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

## Clients scanned

| Client | Config paths |
| --- | --- |
| Cursor | `~/.cursor/mcp.json`, `./.cursor/mcp.json` |
| Claude Code | `~/.claude.json`, `./.mcp.json` |
| Claude Desktop | `%APPDATA%\Claude\claude_desktop_config.json` (platform paths) |
| OpenCode | `~/.config/opencode/opencode.jsonc`, `./opencode.jsonc` |
| VS Code | `%APPDATA%\Code\User\mcp.json`, `./.vscode/mcp.json` |
| Any (explicit) | `--config <path>` (shape auto-detected) |

Codex TOML is a Stage 1 item, not supported yet.

## Documentation (reading order)

1. [`SPEC.md`](SPEC.md) — source of truth: problem, scope, success criteria.
2. [`ROADMAP.md`](ROADMAP.md) — ladder and current frontier.
3. [`ARCHITECTURE.md`](ARCHITECTURE.md) — design, as-built truth, limits.
4. [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) — map, environment, glossary.
5. [`DECISIONS.md`](DECISIONS.md) — ADR log.
6. [`AGENTS.md`](AGENTS.md) — session contract for agents (also good for humans).
7. [`CURRENT_STATE.md`](CURRENT_STATE.md) — live snapshot and session ledger.

## License

MIT.