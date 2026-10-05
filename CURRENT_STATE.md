# CURRENT_STATE

Live snapshot, not a stable map (that is `PROJECT_CONTEXT.md`) and not the plan
(`ROADMAP.md`). Dated; overwrite the top section each session.

## 2026-10-05

**Works**

- `scan` discovers project + user configs for Cursor, Claude Code, Claude
  Desktop, OpenCode, VS Code, plus `--config <path>` (shape auto-detected).
- JSONC (comments, trailing commas) and the four config shapes
  (`mcpServers`, `servers`, `mcp.servers`, `mcp`).
- stdio and HTTP probes via the official MCP SDK; per-server timeout; a failed
  server is a row, never a thrown scan.
- Token accounting: `cl100k_base` (labeled proxy) + chars/4; `--verbose`
  per-tool breakdown; `--json` report.
- Secrets: env/header values are never printed.
- `npm test`: **13/13** (parser shapes, JSONC strip, redaction, tokenizer
  sanity, fixture stdio end-to-end + error path).

**Does not work / not built yet**

- Codex TOML configs (Stage 1).
- Snapshot/diff/CI gate (Stage 1).
- Per-use accounting from session logs (Stage 2, research).
- npm package not published yet (operator `npm login` required).

**Reproduce**

```powershell
npm install
npm run build
npm test
node dist/src/cli.js scan --verbose
```

## Session ledger

### 2026-10-05 — v0.1 scan

- **Did:** founded the repo (SPEC + house docs + ADRs); implemented discovery,
  parsing, probing, token accounting, reporting, CLI; 13 tests green; captured a
  real scan (4 servers, 20 tools, 2,910 tokens, 1.5% of a 200k window) with one
  down server handled as a partial result.
- **Left:** npm publish (needs operator login); Stage 1 items.
- **Next:** publish `mcp-weight@0.1.0`, then snapshot/diff + CI gate.
- **Evidence:** README captured output; `ROADMAP.md` v0.1 scan [DONE]
  (2026-10-05); `npm test` 13/13.