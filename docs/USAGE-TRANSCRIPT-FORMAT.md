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

### Lines that are skipped

Skipped **with an error recorded** in the report's `errors` array (line
numbers are 1-based file lines, counting blank lines):

- Lines that are not valid JSON.
- Lines that are not JSON objects (arrays, primitives).
- Lines where `type` is missing or not a string.

Skipped **silently** (these are normal/irrelevant shapes, not errors):

- Blank or whitespace-only lines.
- Lines where `message` is missing or not an object.
- Lines whose `message.role` is not `"assistant"`.
- Lines where `message.tool_calls` is missing or not an array.
- Individual tool calls that are not objects, or whose `name` is missing or
  not a non-empty string.

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
per-server tool lists. Tools not found in the scan report omit the `tokens`
field and carry `tokenSource: "count-only"`.

### Output (pretty)

Captured with the shipped fixture and a scan report whose server exposes
`Bash: 120`, `Read: 85`, `Glob: 60` tokens:

```
mcp-weight 0.2.0 — usage report
Transcript: transcript.jsonl
Scanned: 2026-10-09T00:00:00.000Z · 6 call(s) across 3 tool(s)

TOOL  CALLS  TOKENS  SOURCE
----  -----  ------  -----------
Bash      4     120  scan-report
Read      1      85  scan-report
Glob      1      60  scan-report
```

`TOKENS` is the tool's schema weight from the scan report, not multiplied by
`CALLS`.

When `--scan-report` is not provided, `TOKENS` shows `-` and
`SOURCE` is `count-only`.

### Output (JSON)

```json
{
  "schemaVersion": 1,
  "transcript": "transcript.jsonl",
  "scannedAt": "2026-10-09T00:00:00.000Z",
  "tool": { "name": "mcp-weight", "version": "0.0.0" },
  "totalCalls": 6,
  "totalTools": 3,
  "rows": [
    { "tool": "Bash", "calls": 4, "tokens": 120, "tokenSource": "scan-report" },
    { "tool": "Read", "calls": 1, "tokens": 85, "tokenSource": "scan-report" },
    { "tool": "Glob", "calls": 1, "tokens": 60, "tokenSource": "scan-report" }
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
