# SPEC — mcp-weight

**Status:** v0.1 (2026-10-05). Source document for this repo; `README`, `ROADMAP`,
`ARCHITECTURE`, `DECISIONS`, and `PROJECT_CONTEXT` cite it.

**Provenance.** Synthesized from the founding conversation of 2026-10-04/05:
the memvid-mcp archive assessment → context-engineering research direction →
"mcp-diet" wedge discussion. The conversation is the founding source; this file
is its distilled record. Nothing here is invented beyond what was discussed;
open points are listed as open.

## 1. Problem

Every MCP server an agent host connects injects its tool definitions (name +
description + JSON schema) into context on every turn — before the user types
anything. The cost is invisible, compounds with every server, and is spread
across client-specific config files that no single tool understands.

Prior art exists and is tracked (see §4). What is still thin: cross-client
breadth with provenance, snapshot/diff/CI gating, and an honest, labeled
accounting methodology.

## 2. Idea

A local, read-only CLI: find the MCP configs on the machine, connect to every
configured server, ask for its tool list (`tools/list`), and report the token
weight per tool, per server, and per client — with the config path, transport,
and server version attached to every row.

Tagline: **weigh your MCP stack.**

## 3. Audience

Developers running 3+ MCP servers across one or more agent hosts (Claude Code,
Cursor, OpenCode, VS Code, Claude Desktop, Codex) who want a number before
pruning, profiling, or blaming the context window.

## 4. Prior art (checked 2026-10-05) and what this is not

| Package | dl/mo | What it does | Relation |
| --- | --- | --- | --- |
| `context-tax` | 896 | Reads Claude Code session transcripts; cost per *use*; writes fixes | Not replaced: transcript/per-use is a later research stage here |
| `tooltax` | 217 | Real BPE tokenizer; lints schemas; public server leaderboard | Different angle: your real configs, not a server registry |
| `mcp-tax` | 29 | Real handshake; chars/4 estimate; HTML receipt | Same core scan; our take adds cross-client + provenance + snapshots |
| `mcp-diet` | 20 | Multi-client scanner; paid profiles to switch configs | Complementary: diet chooses what loads, weight measures what it costs |

- We do not read session transcripts in v0.1.
- We do not run a leaderboard.
- We do not switch or write configs (read-only).
- We are not a security scanner.

## 5. Scope

**v0.1 (MVP):**

- Config discovery for Cursor, Claude Code, Claude Desktop, OpenCode, VS Code,
  plus explicit `--config <path>`.
- JSON and JSONC parsing (comments, trailing commas).
- stdio and HTTP servers via the official MCP SDK client.
- `tools/list` handshake with per-server timeout; failures are partial results,
  never fatal.
- Token accounting: `cl100k_base` (labeled proxy) and a chars/4 estimate.
- Table output and `--json`; provenance on every row.
- Secrets never printed: env/header values are redacted, keys only.
- Tests: parser shapes, tokenizer sanity, end-to-end against an in-repo
  fixture MCP server.

**Non-goals for v0.1:** Codex TOML configs, config writing, an MCP server wrapper, remote OAuth flows, telemetry (none, ever).

**Stage 2 research (tracer bullet):** per-use accounting from a simplified JSONL transcript format (`usage` command). This is not a full Claude Code session-log parser — it is a tracer bullet for the per-use accounting research track.

## 6. Success criteria (v0.1)

1. `scan` runs on a machine with real configs and prints a report; every
   configured server appears with status `ok | error | timeout | disabled`.
2. Failures do not abort the scan (partial results are a feature).
3. Report labels its tokenizer and never presents proxy counts as exact.
4. No secret values in any output.
5. `npm run build && npm test` is green, including the fixture end-to-end test.

## 7. Open questions

- Per-use accounting from session logs (worth it? each client format is a
  moving target) — Stage 2.
- Snapshot/diff format and CI gate semantics — Stage 1.
- Codex TOML support — Stage 1.
- Whether any of this feeds a public Context Lab study (optional).