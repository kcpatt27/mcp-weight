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
- Remote (HTTP) probes try Streamable HTTP then legacy SSE; failures carry an
  actionable hint (auth / not-found / connection / timeout / protocol).
- `npm test`: **42/42** (parser shapes incl. TOML, JSONC strip, redaction,
  tokenizer sanity, fixture stdio end-to-end + error path, diff semantics, CLI
  `scan --out` + `diff --fail-over` integration, ancestor discovery, HTTP 401
  hint path, usage parser + CLI dispatch + both transcript dialects).
- Snapshot + diff + CI gate: `scan --out <file>` writes a JSON report;
  `diff <before> <after> [--fail-over N] [--fail-percent P]` exits 2 when the
  gate is exceeded.
- GitHub repository is live with a CI workflow (ubuntu + windows, Node 20/24).
- Published to npm: **`mcp-weight@0.2.0`** (2026-10-09). The legacy
  `@kcpatt27/memvid-mcp` package carries its deprecation message on the registry.
- Release automation: `.github/workflows/release.yml` publishes on `v*` tags via
  npm trusted publishing (OIDC) once the trusted publisher is configured on
  npmjs.com; see `docs/RELEASING.md`.

**Stage 2 — per-use accounting (tracer bullet)**

- `mcp-weight usage <transcript.jsonl>` counts per-tool calls; auto-detects the `simple` (OpenAI `tool_calls`) and `claude-code` (Anthropic `tool_use`) dialects, or takes `--format`.
- `--scan-report <path>` enriches each row with schema-token weight from a scan report JSON.
- Unknown transcript shapes produce error entries and are skipped (never thrown).
- `npm test` includes 17 fixture-driven usage tests.
- Docs: `docs/USAGE-TRANSCRIPT-FORMAT.md`; audit: `docs/AUDIT-usage.md`.

**Does not work / not built yet**

- Per-session/per-turn aggregation and cross-file dedupe.
- `claude-code` dialect support is modeled on the documented Anthropic shape; it
  has not been validated against a captured Claude Code log.
- Folder rename `mcp-diet` → `mcp-weight` is deferred: the running OpenCode
  service holds the directory. Run `Rename-Item` with OpenCode closed, then
  update `control-plane/project-registry.yaml`.

**Reproduce**

```powershell
npm install
npm run build
npm test
node dist/src/cli.js scan --verbose
```

## Session ledger

### 2026-10-09 — Claude Code dialect, trusted publishing, release 0.2.0

- **Did:** added the `claude-code` transcript dialect (Anthropic `tool_use`
  content blocks) with `--format auto|simple|claude-code` and call-id dedupe;
  tests 36 → 42. Added `.github/workflows/release.yml` (npm trusted publishing
  via OIDC) and `docs/RELEASING.md`. Published **0.2.0** and cut the GitHub
  release. Deferred the folder rename (the OpenCode service holds `mcp-diet`).
- **Left:** trusted-publisher config on npmjs.com (operator); per-session
  aggregation; a real Claude Code log fixture; folder rename.
- **Next:** enable the trusted publisher; future releases are tag pushes.
- **Evidence:** `npm view mcp-weight version` → 0.2.0; release workflow in git;
  `npm test` 42/42.

### 2026-10-09 — independent audit of the usage tracer bullet

- **Did:** audited `usage` against code, tests, fixture, CLI wiring, and docs.
  Found and fixed two real defects — (F1) `usage` was never dispatched as a
  command, so `mcp-weight usage …` ran a **scan**; (F2) error line numbers
  ignored blank lines. Fixed the `mcp-weight ?` header (F3), aligned the
  format doc/README with actual silent-skip behavior and omitted-vs-null
  `tokens` (F4), and reused the shared report validator (F5). Added 4
  regression tests. `scan`/`diff` and all JSON schemas unchanged.
  Findings: `docs/AUDIT-usage.md`.
- **Left:** full Claude Code native session-log parser; per-session/turn
  aggregation.
- **Next:** expand the transcript parser to Claude Code's native format.
- **Evidence:** `docs/AUDIT-usage.md`; `npm test` 32 → 36.

### 2026-10-09 — Stage 1: remote auth diagnostics (Stage 1 complete)

- **Did:** HTTP probes now try Streamable HTTP then legacy SSE; failed probes
  carry an actionable hint (auth / not-found / connection / timeout /
  protocol) shown under the table and in JSON. Added classifier + live HTTP-401
  tests. Tests 23 → 25. Stage 1 is done.
- **Left:** nothing in Stage 1.
- **Next:** Stage 2 per-use accounting tracer bullet.
- **Evidence:** `tests/probe-errors.test.ts`; `npm test` 25/25.

### 2026-10-09 — Stage 2: per-use accounting tracer bullet

- **Did:** added `usage` command (`mcp-weight usage <transcript.jsonl>`) that
  parses a Claude Code-style JSONL transcript and reports per-tool call counts.
  With `--scan-report`, rows are enriched with schema-token weight from a scan
  report JSON. Unknown transcript shapes produce error entries and are skipped
  (never thrown). Added `src/usage.ts`, `tests/usage.test.ts` (6 tests),
  `tests/fixtures/transcript.jsonl`, `docs/USAGE-TRANSCRIPT-FORMAT.md`.
  Updated `src/cli.ts` (usage command + `--scan-report` flag), `src/index.ts`
  (exports). `npm test` 25 → 32.
- **Left:** full Claude Code native session-log parser; per-session/per-turn
  cost breakdown; multi-client transcript format support.
- **Next:** expand transcript parser to handle Claude Code's actual log format;
  add per-session cost aggregation.
- **Evidence:** `tests/usage.test.ts`; `npm test` 32/32.

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