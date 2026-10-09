# CURRENT_STATE

Live snapshot, not a stable map (that is `PROJECT_CONTEXT.md`) and not the plan
(`ROADMAP.md`). Dated; overwrite the top section each session.

## 2026-10-09

**Works**

- `scan` discovers project + user configs for Cursor, Claude Code, Claude
  Desktop, OpenCode, VS Code, plus `--config <path>` (shape auto-detected).
- JSONC + four config shapes; stdio and HTTP probes via the official MCP SDK;
  per-server timeout; failed servers are rows, never thrown scans.
- Token accounting: `cl100k_base` (labeled proxy) + chars/4; `--verbose`
  per-tool breakdown; `--json` report. Secrets never printed.
- Codex TOML configs (`~/.codex/config.toml`) parse into the same normalized
  specs (stdio + remote).
- Project configs are discovered from `cwd` up to the git root (nearest first).
- `npm test`: **23/23** (parser shapes incl. TOML, JSONC strip, redaction,
  tokenizer sanity, fixture stdio end-to-end + error path, diff semantics, CLI
  `scan --out` + `diff --fail-over` integration, ancestor discovery).
- Snapshot + diff + CI gate: `scan --out <file>` writes a JSON report;
  `diff <before> <after> [--fail-over N] [--fail-percent P]` exits 2 when the
  gate is exceeded.
- GitHub repository is live with a CI workflow (ubuntu + windows, Node 20/24).
- Published to npm: **`mcp-weight@0.1.0`** (2026-10-09). The legacy
  `@kcpatt27/memvid-mcp` package now carries its deprecation message on the
  registry.

**Does not work / not built yet**

- Per-use accounting from session logs (Stage 2, research).

**Reproduce**

```powershell
npm install
npm run build
npm test
node dist/src/cli.js scan --verbose
```

## Session ledger

### 2026-10-09 — Stage 1: Codex TOML + ancestor discovery

- **Did:** added TOML parsing (`smol-toml`, ADR-0007) for
  `~/.codex/config.toml`; project discovery now walks `cwd` → git root,
  nearest first. Tests 21 → 23.
- **Left:** remote auth diagnostics.
- **Next:** remote auth diagnostics.
- **Evidence:** `tests/toml.test.ts`, `tests/discover-up.test.ts`;
  `npm test` 23/23.

### 2026-10-09 — Stage 1: snapshot + diff + CI gate

- **Did:** refactored scan orchestration into `src/scan.ts` and config
  resolution into `src/config/resolve.ts`; added `scan --out <file>` and a
  `diff` command with `--fail-over` / `--fail-percent` gating (exit 2);
  added diff + CLI integration tests. `npm test`: 19/19.
- **Left:** Codex TOML, parent-directory discovery, remote auth diagnostics.
- **Next:** Codex TOML support.
- **Evidence:** `npm test` 19/19; README CI snippet; this file.

### 2026-10-09 — published 0.1.0; legacy package deprecated

- **Did:** operator published `mcp-weight@0.1.0` to npm from the laptop
  (browser + security-key login), and deprecated `@kcpatt27/memvid-mcp` with
  the MemVid v1 message. Docs flipped to match.
- **Left:** npm access on the desktop is still security-key-gated (operator is
  adding a TOTP method separately); Stage 1 items.
- **Next:** snapshot/diff + CI gate.
- **Evidence:** npm packument (`mcp-weight@0.1.0`, published 2026-10-09T15:40Z);
  `npm view @kcpatt27/memvid-mcp deprecated`.

### 2026-10-09 — repo to GitHub; CI added

- **Did:** pushed the repo to GitHub (`kcpatt27/mcp-weight`), added a
  cross-platform CI workflow and package metadata (repository/homepage/bugs);
  created the [Context Lab](https://github.com/kcpatt27/context-lab) hub and
  linked it from the README; recorded that npm publish is blocked on account
  recovery.
- **Left:** npm publish (account recovery); Stage 1 items.
- **Next:** recover npm access (or create an automation token from a recovered
  account), then `npm publish`; meanwhile Stage 1 snapshot/diff work can start.
- **Evidence:** GitHub repo + CI workflow in git; this file.

### 2026-10-05 — v0.1 scan

- **Did:** founded the repo (SPEC + house docs + ADRs); implemented discovery,
  parsing, probing, token accounting, reporting, CLI; 13 tests green; captured a
  real scan (4 servers, 20 tools, 2,910 tokens, 1.5% of a 200k window) with one
  down server handled as a partial result.
- **Left:** npm publish; Stage 1 items.
- **Next:** publish `mcp-weight@0.1.0`, then snapshot/diff + CI gate.
- **Evidence:** README captured output; `ROADMAP.md` v0.1 scan [DONE]
  (2026-10-05); `npm test` 13/13.