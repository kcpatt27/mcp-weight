# USAGE-TRANSCRIPT-FORMAT

## Transcript format

`mcp-weight usage` reads a **Claude Code-style JSONL transcript** — one
JSON object per line, each with a `type` field.

### Minimal shape

```jsonl
{"type":"user","message":{"role":"user","content":"List the files."}}
{"type":"assistant","message":{"role":"assistant","tool_calls":[{"name":"Bash","arguments":{"command":"ls"}}]}}
{"type":"assistant","message":{"role":"assistant","tool_calls":[{"name":"Read","arguments":{"file":"README.md"}}]}}
```

### Fields used

| Field | Required | Notes |
| --- | --- | --- |
| `type` | yes | Must be a string. Lines without it are skipped with an error. |
| `message.role` | yes (for tool calls) | Only `"assistant"` messages are scanned for tool calls. |
| `message.tool_calls` | no | Array of `{ name, arguments }`. Missing or non-array → no calls extracted from that line. |
| `message.tool_calls[].name` | yes | The tool name (e.g. `Bash`, `Read`, `Glob`). Empty names are skipped. |
| `message.tool_calls[].arguments` | no | The tool arguments; not used for counting. |

### Lines that are skipped (with an error recorded)

- Lines that are not valid JSON.
- Lines that are not JSON objects (arrays, primitives).
- Lines where `type` is missing or not a string.
- Lines where `message` is missing or not an object.
- Tool calls with a missing or empty `name`.

## Usage command

```bash
# Basic per-tool call counts
mcp-weight usage transcript.jsonl

# Enrich with schema-token weight from a scan report
mcp-weight usage transcript.jsonl --scan-report scan-report.json

# Machine-readable JSON output
mcp-weight usage transcript.jsonl --json

# Verbose (shows token source column and notes)
mcp-weight usage transcript.jsonl --verbose
```

### `--scan-report`

Path to a `mcp-weight scan --json` output file. When provided, each
tool row is enriched with its schema-token weight from the scan report's
per-server tool lists. Tools not found in the scan report get
`tokens: null` and `tokenSource: "count-only"`.

### Output (pretty)

```
mcp-weight 0.0.0 — usage report
Transcript: transcript.jsonl
Scanned: 2026-10-09T00:00:00.000Z · 6 call(s) across 3 tool(s)

TOOL    CALLS  TOKENS  SOURCE
------  -----  ------  -----------
Bash       2     240  scan-report
Read       1      85  scan-report
Glob       3     180  scan-report
```

When `--scan-report` is not provided, `TOKENS` shows `-` and
`SOURCE` is `count-only`.

### Output (JSON)

```json
{
  "schemaVersion": 1,
  "transcript": "transcript.jsonl",
  "scannedAt": "2026-10-09T00:00:00.000Z",
  "tool": null,
  "totalCalls": 6,
  "totalTools": 3,
  "rows": [
    { "tool": "Bash", "calls": 2, "tokens": 240, "tokenSource": "scan-report" },
    { "tool": "Read", "calls": 1, "tokens": 85, "tokenSource": "scan-report" },
    { "tool": "Glob", "calls": 3, "tokens": 180, "tokenSource": "scan-report" }
  ],
  "errors": []
}
```

## Error handling

- Unknown transcript shapes (non-objects, missing `type`, invalid JSON)
  are recorded in the `errors` array and reported at the bottom of the
  pretty output. The command does not abort — it processes what it can.
- The `--scan-report` file is validated the same way as `diff` validates
  its inputs (schemaVersion 1 check). If it fails validation, the command
  exits 1 with a clear error message.
- Missing transcript file: Node's `readFileSync` throws a clear error;
  the CLI catches it and exits 1.

## Limitations

- This is a **tracer bullet** (Stage 2 research). It reads a single
  JSONL file and counts tool calls. It does not:
  - Parse Claude Code's native session logs (which use a different
    internal format).
  - Deduplicate tool calls across sessions.
  - Compute per-session or per-turn costs.
  - Handle multi-turn tool results (only assistant→tool_calls are counted).
- The transcript format is a **simplified JSONL shape** designed for
  fixture testing and future client-specific parsers. It is not Claude
  Code's actual internal log format.
