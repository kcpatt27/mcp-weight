# PROJECT_CONTEXT

A stable map, not a live status. Status lives in `README.md` and `ROADMAP.md`.

## 1. What this is

`mcp-weight` — a read-only CLI that finds MCP client configs, connects to every
configured MCP server, and reports the token weight of their tool schemas.
Source of truth: `SPEC.md`. Decisions: `DECISIONS.md`.

## 2. Repository state at start

- New standalone repo, initialized 2026-10-05 (`git init`), no remote yet.
- Founded after archiving `memvid-mcp` and in support of the
  context-engineering research direction (Context Lab hub, later).
- Name check 2026-10-05: `mcp-diet`, `mcp-tax`, `tooltax`, `context-tax` taken
  on npm; `mcp-weight` free; fallback `mcp-token-cost` recorded (ADR-0006).

## 3. Environment (measured 2026-10-05)

| Tool | Version | Notes |
| --- | --- | --- |
| Node | v24.18.0 | dev machine; package targets `>=20` |
| npm | 11.16.0 | lockfile committed |
| OS | Windows (dev) | targets Windows/macOS/Linux |

Runtime dependencies: `@modelcontextprotocol/sdk`, `js-tiktoken`. A new runtime
dependency requires a pinned entry in `package.json` and a line in
`DECISIONS.md`.

## 4. How to run

```powershell
npm install
npm run build
node dist/src/cli.js scan          # pretty report
node dist/src/cli.js scan --json   # machine-readable
npm test                           # build + node:test
```

There is no published npm package yet — `npm publish` is a roadmap item.

## 5. Conventions

- **Docs update in the same commit as the work**; roadmap statuses carry dates
  and evidence. A pending number is never a claimed number.
- **Read-only invariant:** never write or modify client configs.
- **Secrets:** env/header *values* are never printed or serialized; only keys.
- **Proxy tokenizer:** counts use `cl100k_base` and are labeled as a proxy; a
  chars/4 estimate is reported beside it. No fake precision.
- **Tests first where practical:** parser and transport boundaries get a test
  in the same commit that adds them.
- **Version:** `package.json` and the CLI `--version` read the same file.

## 6. Non-goals for this stage

- No config mutation, no profiles, no "apply" command.
- No transcript/per-use accounting yet (Stage 2).
- No TOML (Codex) parsing yet (Stage 1).
- No MCP server wrapper (ADR-0002).
- No telemetry, ever. Network use is limited to the servers the user configured.

## 7. Domain glossary (compact)

- **MCP client** — the app that hosts servers and owns a config file (Claude
  Code, Cursor, OpenCode, VS Code, Claude Desktop, Codex).
- **MCP server** — a process or endpoint exposing tools/resources/prompts.
- **Tool schema** — the `name` + `description` + `inputSchema` JSON a client
  injects each turn.
- **Weight** — the measured token cost of a server's tool schemas.
- **Proxy tokenizer** — `cl100k_base` used consistently for comparability;
  not provider-native tokenization.
- **Partial result** — a scan where some servers failed or timed out; still a
  valid report, failures are listed per row.
- **Provenance** — the config path, client label, transport, and server version
  attached to every row.
- **Fixture server** — the minimal in-repo MCP server under `tests/fixtures/`
  used by the end-to-end test.