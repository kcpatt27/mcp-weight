# AGENTS — session contract

Short enough to actually be read. Stable; operator-owned.

## Before writing code

1. Read, in order: `README.md` → `ROADMAP.md` → `ARCHITECTURE.md` →
   `PROJECT_CONTEXT.md`; then the `SPEC.md` section for your item.
2. One roadmap item at a time — never widen scope beyond it.
3. Write the failing test first where a boundary exists (config parsing,
   probing, redaction); keep the fixture server in `tests/fixtures/` as the
   transport boundary.

## While building

- **Read-only invariant:** never write or modify client configs.
- **Secrets:** env/header values stay in memory; never print, log, or
  serialize them. Reports show keys only.
- **Partial results are a feature:** a failed probe becomes a row with
  `error`/`timeout`, never a thrown scan.
- **No new runtime dependency** without a pinned `package.json` entry and an
  ADR line in `DECISIONS.md`.
- **Label the proxy:** any token number is presented with its tokenizer name;
  no exactness claims.
- Keep the core in `src/` free of CLI-only concerns so a future MCP surface can
  call it (ADR-0002).

## Before committing

- Gate: `npm run build && npm test` (must be green).
- Docs updated in the same commit: `ROADMAP.md` statuses (dated, with
  evidence); `DECISIONS.md` for choices; `README.md` / `ARCHITECTURE.md` when
  the surface or design changes.

## After a milestone

- Record `Did / Left / Next / Evidence` for the next session.
- Flip roadmap items with real evidence (test counts, captured output, commit).
- If reality diverged from `SPEC.md`, that is an ADR here — never a silent
  edit.

## What this project does NOT do

- No config mutation, profiles, or "apply" commands.
- No telemetry; no network beyond the servers the user configured.
- No session-transcript parsing in v0.1.
- No security scanning, no leaderboard.
- No MCP server wrapper without an ADR superseding ADR-0002.
- No unverified numbers in docs — a pending number is never a claimed number.
- No silent edits to `DECISIONS.md` — supersede with a new ADR.

## Where things live

- Spec: `SPEC.md` · Plan: `ROADMAP.md` · Design: `ARCHITECTURE.md`
- Decisions: `DECISIONS.md` · Map/glossary: `PROJECT_CONTEXT.md`
- Code: `src/` · Tests: `tests/` (fixture server in `tests/fixtures/`)