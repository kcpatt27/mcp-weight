# ROADMAP

Long-horizon plan, EASY → MEDIUM → HARD → IMPOSSIBLE+. Complexity estimates are
honest. Status markers: **[DONE]**, **[NEXT]**, **[ ]**.

Classes: **MVP** (required for v0.1), **P** (post-MVP), **R** (research),
**HA** (high-assurance). Complexity S / M / L.

Source: `SPEC.md` (v0.1). Shipped surface: `README.md`. Why: `DECISIONS.md`.

---

## Stage 0 — EASY (conventional engineering)

| Item | Purpose | Deps | Complexity | Class | Status |
| --- | --- | --- | --- | --- | --- |
| Repo foundation — docs, TS scaffold, tests harness | ready to code | — | S | MVP | **[DONE]** (2026-10-05) |
| v0.1 scan — discovery (5 clients + `--config`), JSONC, stdio+HTTP probe, token accounting, table/JSON report, fixture test | the number | foundation | M | MVP | **[DONE]** (2026-10-05) |
| Publish `mcp-weight@0.1.0` to npm | `npx mcp-weight` | v0.1 | S | P | **[DONE]** (2026-10-09, [npm](https://www.npmjs.com/package/mcp-weight)) |

### v0.1 scan — [DONE] (2026-10-05)

- **Acceptance met.** Real scan over a Cursor config + an OpenCode config
  returned all 4 configured servers with per-row status; a down server
  (`perplexica-local`) produced an `error` row without aborting the scan; the
  tokenizer is labeled; env/header values are never printed. `npm test`: 13/13
  green (parser shapes, JSONC stripping, redaction, tokenizer sanity, fixture
  stdio end-to-end + error path).
- **Evidence:** captured run in `README.md` (20 tools, 2,910 tokens, 1.5% of a
  200k window); `--verbose` per-tool breakdown works; `--json` validates.

---

## Stage 1 — MEDIUM (deliberate systems engineering)

| Item | Purpose | Deps | Complexity | Class | Status |
| --- | --- | --- | --- | --- | --- |
| Snapshot + diff + CI gate (`scan --out`, `diff --fail-over`) | catch config bloat in review | v0.1 | M | P | **[DONE]** (2026-10-09) |
| Codex TOML support | 6th client | v0.1 | S | P | **[DONE]** (2026-10-09) |
| Project/parent-directory discovery and multi-root scans | real workspaces | v0.1 | S | P | **[DONE]** (2026-10-09) |
| Remote auth diagnostics (headers, OAuth servers) | honest failures | v0.1 | M | P | **[DONE]** (2026-10-09) |
| Release automation — npm trusted publishing (OIDC) workflow | tag-push releases, no OTP | v0.2.0 | S | P | **[DONE]** (workflow; operator enables on npmjs.com) |

**Stage 1 complete (2026-10-09).** Stage 2 below is research; the tool is
otherwise feature-complete for its stated scope.

## Stage 2 — HARD (research)

| Item | What it buys | Prerequisite | Class | Status |
| --- | --- | --- | --- | --- |
| Per-use accounting: read session logs per client, compute cost-per-use | "this server cost 17M tokens for 2 calls" | Stage 1; one transcript reader per client, each a moving target | R | **[DONE]** (tracer bullet, 2026-10-09) |
| Longitudinal study: scans over time, published dataset + writeup (Context Lab) | evidence for pruning advice | Stage 1 snapshots | R | [ ] |

### Per-use accounting — tracer bullet (2026-10-09)

- **Tracer bullet, not the full item.** `usage` counts per-tool calls from a
  JSONL transcript and can enrich rows with schema-token weight from a scan
  report. Both the `simple` (OpenAI `tool_calls`) and `claude-code` (Anthropic
  `tool_use` content blocks) dialects are supported via
  `--format auto|simple|claude-code`, deduping repeated call ids. It does **not**
  yet aggregate per session/turn.
- **Evidence:** `tests/usage.test.ts` (17 tests), `tests/fixtures/transcript.jsonl`,
  `tests/fixtures/claude-code-transcript.jsonl`, `docs/USAGE-TRANSCRIPT-FORMAT.md`,
  `src/usage.ts`, `docs/AUDIT-usage.md` (independent audit, 2026-10-09).

## IMPOSSIBLE+

| Requirement | Why it cannot be guaranteed | Engineering approximation | Residual risk |
| --- | --- | --- | --- |
| Exact provider token counts | tokenizers differ per model/provider; clients cache/trim | labeled `cl100k_base` proxy + chars/4 | up to ~±15% vs native counts |
| What the client actually sends | clients may trim, rename, or lazily expose tools | measure what the server reports; label the snapshot time | listed ≠ sent |
| Every server reachable | auth, network, crashed processes | per-row timeout/error status; partial reports | unmeasurable servers |
| Stable numbers over time | servers change tools between versions | provenance: version + timestamp per row | comparisons drift |

## VISION COMPLETE

`npx mcp-weight` is the boring pre-flight check for MCP stacks: one command,
honest numbers, provenance, snapshot diffs in CI, and per-use data where
available. The tool stays small; the data feeds the Context Lab research line.

## Working order (pick list)

1. **v0.1 scan** — done; published as `0.1.0`.
2. **Snapshot + diff + CI gate** — done (`scan --out`, `diff --fail-over/--fail-percent`).
3. **Codex TOML support** — done.
4. **Project/parent-directory discovery** — done (up to the git root).
5. **Remote auth diagnostics** — done (SSE fallback + actionable hints).
6. **Per-use accounting** — tracer bullet (`usage`; `simple` + `claude-code` dialects).
7. **Release automation** — trusted-publishing workflow added; enable it on npmjs.com.

## Maintenance

Update statuses in the session that ships an item. Correct stale docs in the
same pass. Estimates stay honest — if an item was harder than listed, say so
rather than re-labeling it.