# ARCHITECTURE

Design and as-built truth. Status per component is marked; anything not built
says so explicitly. Not the plan (`ROADMAP.md`) and not the map
(`PROJECT_CONTEXT.md`).

## The one invariant

**Read-only and secret-safe.** mcp-weight never writes a client config, never
prints env/header values, and never fails a whole scan because one server is
broken. A failed probe is a row in the report, not an exception.

## Data flow

```
discover              parse / normalize            probe                    account            report
config paths   →   client shapes → ServerSpec  →  SDK client connects  →  cl100k_base     →  table / JSON
(existing only)    (JSON / JSONC)                  tools/list + timeout     + chars/4          + totals
```

1. **discover** (`src/config/discover.ts`) — candidate paths for the five
   supported clients plus project-local paths in `cwd` and its ancestors up to
   the git root; explicit `--config` paths are added verbatim. Only existing
   files are returned.
2. **parse / normalize** (`src/config/parse.ts`) — JSONC stripper (comments and
   trailing commas, string-aware), shape detection (`mcpServers`, `servers`,
   `mcp.servers`, `mcp`), entry normalization to `ServerSpec`, disabled entries
   kept but marked. Env/header values are retained in memory for launching the
   server, and never serialized.
3. **probe** (`src/mcp/probe.ts`) — official MCP SDK client; stdio
   (`StdioClientTransport`) or HTTP, where HTTP is tried as Streamable HTTP and
   then legacy SSE; `tools/list` + `getServerVersion()`; per-server timeout.
   Failures carry an actionable `hint` (auth / not-found / connection /
   timeout / protocol). Client is closed on every path.
4. **account** (`src/tokens.ts`) — `semantics-free` measurement: the text
   `name + "\n" + description + "\n" + JSON.stringify(inputSchema)`, tokenized
   with `cl100k_base`; chars/4 reported beside it. Tokenizer name travels in
   the report.
5. **report** (`src/report.ts`) — pretty table (per server, with totals and
   duplicate-name note) or `--json` (`ScanReport`).

## Components (as-built — 2026-10-05)

| Component | File | Status |
| --- | --- | --- |
| Types + report schema | `src/types.ts` | built |
| Tokenizer | `src/tokens.ts` | built |
| Config discovery | `src/config/discover.ts` | built |
| Config parsing / normalizing | `src/config/parse.ts` | built |
| Config resolution | `src/config/resolve.ts` | built |
| Scan orchestration | `src/scan.ts` | built |
| Server probing | `src/mcp/probe.ts` | built |
| Diff + CI gate | `src/diff.ts` | built |
| Report formatting | `src/report.ts` | built |
| CLI | `src/cli.ts` | built |
| Serial per-use accounting | — | **not built** (Stage 2 research) |
| Codex TOML parsing | `src/config/parse.ts` (`parseTomlConfig`) | built (smol-toml) |
| MCP server wrapper | — | **not built by design** (ADR-0002) |

## The observer effect

If mcp-weight itself were exposed as an MCP server, its own tool schema would
join the context it is measuring. That is why the core is a CLI and any future
MCP surface must: (a) call the same core, and (b) include its own weight in the
report. Stated here so it is never forgotten.

## Deliberate limits

- **Proxy tokenizer:** `cl100k_base` is not Claude/Gemini tokenization; counts
  are comparable across servers, not billing-exact. The report says so.
- **Listed ≠ sent:** some clients trim, rename, or lazily expose tools. v0.1
  measures what the server reports; verifying client behavior is a later stage.
- **Dynamic servers:** tools may vary by session; a scan is a snapshot with a
  timestamp, not a guarantee.
- **Auth:** remote servers requiring OAuth will fail the probe; the report
  shows an auth hint rather than guessing. mcp-weight never performs an auth
  flow.