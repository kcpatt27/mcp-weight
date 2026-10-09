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
| Snapshot + diff + CI gate (`scan --out`, `diff --fail-over`) | catch config bloat in review | v0.1 | M | P | **[NEXT]** |
| Codex TOML support | 6th client | v0.1 | S | P | [ ] |
| Project/parent-directory discovery and multi-root scans | real workspaces | v0.1 | S | P | [ ] |
| Remote auth diagnostics (headers, OAuth servers) | honest failures | v0.1 | M | P | [ ] |

## Stage 2 — HARD (research)

| Item | What it buys | Prerequisite | Class |
| --- | --- | --- | --- |
| Per-use accounting: read session logs per client, compute cost-per-use | "this server cost 17M tokens for 2 calls" | Stage 1; one transcript reader per client, each a moving target | R |
| Longitudinal study: scans over time, published dataset + writeup (Context Lab) | evidence for pruning advice | Stage 1 snapshots | R |

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
2. **Snapshot + diff + CI gate [NEXT]** — catch config bloat in review.
3. Codex TOML + parent-directory discovery.
4. Per-use accounting (research spike, not a commitment).

## Maintenance

Update statuses in the session that ships an item. Correct stale docs in the
same pass. Estimates stay honest — if an item was harder than listed, say so
rather than re-labeling it.