# USAGE-TRANSCRIPT-FORMAT

`mcp-weight usage` reads a JSONL session transcript — one JSON object per line,
each with a `type` field — and reports per-tool call counts.

## Formats

Two assistant-message dialects are supported and auto-detected per line:

| Dialect | Tool calls live in | Typical producer |
| --- | --- | --- |
| `simple` (OpenAI-style) | `message.tool_calls[]` = `{ name, arguments }` | OpenAI-compatible agents; the simplified fixture |
| `claude-code` (Anthropic-style) | `message.content[]` blocks with `type: "tool_use"` (`name`, `id`) | Claude Code session logs |

`--format auto` (default) extracts both. `--format simple` or
`--format claude-code` restricts to one dialect. The report records which
dialect(s) were seen: `format: "simple" | "claude-code" | "mixed" | "none"`.

Calls carrying an `id` are counted once, so a call repeated across streamed
updates is not double-counted.

### Minimal shape (`simple`)

```jsonl
{"type":"user","message":{"role":"user","content":"List the files."}}
{"type":"assistant","message":{"role":"assistant","tool_calls":[{"name":"Bash","arguments":{"command":"ls"}}]}}
```

### Minimal shape (`claude-code`)

```jsonl
{"type":"user","message":{"role":"user","content":"List the files."}}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Listing."},{"type":"tool_use","id":"toolu_01","name":"Bash","input":{"command":"ls"}}]}}
```

### Fields used

| Field | Required | Notes |
| --- | --- | --- |
| `type` | yes | Must be a string. Lines without it are skipped with an error. |
| `message.role` | for tool calls | Only `"assistant"` messages are scanned. |
| `message.tool_calls` | `simple` dialect | Array of `{ name, id?, arguments }`. |
| `message.content[]` | `claude-code` dialect | Blocks; only `type: "tool_use"` counts. `text`/`tool_result` blocks are ignored. |
| `...id` | no | Optional call id; used to dedupe repeated calls. Non-empty `name` required in both dialects. |

### Lines that are skipped

Skipped **with an error recorded** in the report's `errors` array (line numbers
are 1-based file lines, counting blank lines):

- Lines that are not valid JSON.
- Lines that are not JSON objects (arrays, primitives).
- Lines where `type` is missing or not a string.

Skipped **silently** (normal/irrelevant shapes, not errors):

- Blank or whitespace-only lines.
- Lines where `message` is missing or not an object.
- Lines whose `message.role` is not `"assistant"`.
- Lines with no recognizable tool calls (`tool_calls` absent/non-array and no
  `tool_use` blocks).
- Individual calls that are not objects, or whose `name` is missing/empty.

## Usage command

```bash
# Basic per-tool call counts (auto-detects the dialect)
mcp-weight usage transcript.jsonl

# Force a dialect
mcp-weight usage transcript.jsonl --format claude-code

# Enrich with schema-token weight from a scan report
mcp-weight usage transcript.jsonl --scan-report scan-report.json

# Machine-readable JSON output
mcp-weight usage transcript.jsonl --json
```

### `--scan-report`

Path to a `mcp-weight scan --json` output file. When provided, each tool row is
enriched with its schema-token weight from the scan report's per-server tool
lists. Tools not found in the scan report omit the `tokens` field and carry
`tokenSource: "count-only"`.

### Output (pretty)

Captured with the shipped `simple` fixture and a scan report whose server
exposes `Bash: 120`, `Read: 85`, `Glob: 60` tokens:

```
mcp-weight 0.2.0 — usage report
Transcript: transcript.jsonl
Format: simple · Scanned: 2026-10-09T00:00:00.000Z · 6 call(s) across 3 tool(s)

TOOL  CALLS  TOKENS  SOURCE
----  -----  ------  -----------
Bash      4     120  scan-report
Read      1      85  scan-report
Glob      1      60  scan-report
```

`TOKENS` is the tool's schema weight from the scan report, not multiplied by
`CALLS`. When `--scan-report` is not provided, `TOKENS` shows `-` and `SOURCE`
is `count-only`.

### Output (JSON)

```json
{
  "schemaVersion": 1,
  "transcript": "transcript.jsonl",
  "scannedAt": "2026-10-09T00:00:00.000Z",
  "format": "simple",
  "tool": { "name": "mcp-weight", "version": "0.0.0" },
  "totalCalls": 6,
  "totalTools": 3,
  "rows": [
    { "tool": "Bash", "calls": 4, "tokens": 120, "tokenSource": "scan-report" }
  ],
  "errors": []
}
```

## Error handling

- Malformed lines (bad JSON, non-objects, missing `type`) are recorded in the
  `errors` array and reported at the bottom of the pretty output. The command
  never aborts — it processes what it can.
- The `--scan-report` file is validated the same way as `diff` validates its
  inputs (schemaVersion 1 check); failure exits 1 with a clear message.
- A missing transcript file exits 1 via the top-level catch.

## Limitations

This is a **tracer bullet** (Stage 2 research): it reads a single JSONL file and
counts tool calls. Specifically:

- `claude-code` support targets the documented Anthropic message shape
  (`message.content[]` with `tool_use` blocks). It has **not** been validated
  against a captured Claude Code log on this machine (no Claude Code install);
  add a real-log fixture when one is available.
- It does not dedupe calls across multiple files/sessions, compute
  per-session/per-turn costs, or interpret `tool_result` blocks.
- The tool name in a call is matched to a scan report by name only; duplicate
  tool names across servers resolve to the first server's weight.