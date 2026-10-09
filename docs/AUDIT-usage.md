# AUDIT — Stage 2 usage tracer bullet

Independent audit of the per-use accounting tracer bullet. Scope: `src/usage.ts`,
`tests/usage.test.ts`, `tests/fixtures/transcript.jsonl`,
`scripts/copy-fixtures.mjs`, `docs/USAGE-TRANSCRIPT-FORMAT.md`, and the
`usage` wiring in `src/cli.ts` / `src/index.ts`. Date: 2026-10-09.

## Verdict

The tracer bullet's parser and its unit tests were mostly correct and honest
about being a tracer bullet. Two real defects made the feature unusable or
misleading in production, and several doc/code claims drifted. All defects
below are fixed, each with a regression test (or a doc correction where the
defect was documentation-only). `scan`/`diff` behavior and all existing JSON
schemas are unchanged.

`npm test`: **36/36** green (was 32/32; +4 regression tests).

## Findings

### F1 — `usage` was never dispatched (critical)

- **Severity:** critical (feature non-functional via CLI)
- **Location:** `src/cli.ts` `parseArgs`, `main`
- **Evidence:** `node dist/src/cli.js usage transcript.jsonl` printed the MCP
  **scan** report, and with no configs printed "No MCP configs found". Running
  the fixture transcript produced a token report over the local machine's
  servers, not call counts for the transcript.
- **Cause:** the `switch` in `parseArgs` recognized `scan` and `diff` as
  commands but not `usage`. The literal `usage` fell through to
  `positionals`, so `args.command` stayed at its default `"scan"`. The
  `usage` branch in `main` (`if (args.command === "usage")`) was therefore
  dead code that the existing unit tests never exercised (they call
  `parseTranscript` directly).
- **Fix:** added `case "usage":` to the command switch.
- **Regression test:** `cli dispatches \`usage\` (not \`scan\`) and prints a
  usage report` — asserts exit 0 and a usage-report header, not a scan report.
  Also `cli usage --json emits the usage schema, not a scan report`, which
  asserts the JSON has no `servers` field (a scan report would).

### F2 — error line numbers were wrong when the file had blank lines

- **Severity:** medium (misleading diagnostics)
- **Location:** `src/usage.ts` `parseTranscript`
- **Evidence:** for input with blank lines, an invalid line at file line 4 was
  reported as `line 2`.
- **Cause:** the function pre-filtered whitespace-only lines
  (`text.split("\n").filter(...)`) and then indexed the *filtered* array with
  `i + 1`, so blank lines were not counted. The docs promise file line
  numbers.
- **Fix:** iterate the unfiltered `split("\n")` array and `continue` on
  whitespace-only lines, preserving true 1-based file line numbers.
- **Regression test:** `parseTranscript reports 1-based file line numbers,
  counting blank lines` — errors are asserted at lines 2, 4, and 6.

### F3 — usage header printed `mcp-weight ?` without `--scan-report`

- **Severity:** low (cosmetic, but the version header is provenance)
- **Location:** `src/cli.ts` `formatUsageReport`
- **Evidence:** the header used `report.tool?.version`, but `report.tool` is
  only populated from a scan report. With no `--scan-report`, every usage
  report began `mcp-weight ? — usage report`.
- **Fix:** `formatUsageReport` now takes the CLI package version and prints it,
  matching `docs/USAGE-TRANSCRIPT-FORMAT.md` and the scan report header.
- **Regression test:** the dispatch test asserts the header matches
  `mcp-weight <semver> — usage report`.

### F4 — doc/code drift in the transcript format spec

- **Severity:** low (documentation correctness)
- **Location:** `docs/USAGE-TRANSCRIPT-FORMAT.md`, `README.md`
- **Details:**
  - The doc listed "Lines where `message` is missing or not an object" and
    "Tool calls with a missing or empty `name`" under *skipped with an error
    recorded*. The parser skips these **silently** (they are normal/irrelevant
    shapes); only invalid JSON, non-object lines, and a missing/non-string
    `type` produce error entries. The repo's own test
    (`... unknown shapes with errors`, expecting exactly 4 errors) encoded the
    silent behavior, confirming the doc, not the code, was wrong.
  - The doc said unknown tools get `tokens: null`; the interface is
    `tokens?: number`, so the field is **omitted** (not `null`) in JSON.
- **Fix:** rewrote the "Lines that are skipped" section to split
  error-recorded vs silently-skipped cases and to state the 1-based
  line-number guarantee; changed `tokens: null` to "omit the `tokens` field".
  Tightened the README summary ("Unknown shapes are skipped with an error
  entry" → "Malformed lines (bad JSON, non-objects, missing `type`)")
  to match. No code behavior changed for this item.

### F5 — `--scan-report` validation duplicated instead of shared

- **Severity:** informational (drift risk, not a defect)
- **Location:** `src/cli.ts` `runUsage`
- **Details:** the inline validation was byte-for-byte the same intent as the
  existing `readReport` helper used by `diff`. Duplicating it invites the two
  validators to drift; the docs claim `--scan-report` "is validated the same
  way as `diff`".
- **Fix:** `runUsage` now calls the shared `readReport`, making the doc claim
  literally true. No schema or behavior change.
- **Regression test:** `cli usage --scan-report enriches rows; a bad report
  exits 1` covers both the enrichment path and the shared rejection message.

### F6 — documented example output did not match the shipped fixture

- **Severity:** low (documentation correctness)
- **Location:** `docs/USAGE-TRANSCRIPT-FORMAT.md` ("Output (pretty)" and
  "Output (JSON)").
- **Evidence:** the doc showed `Bash 2 / Read 1 / Glob 3` (240/85/180) and
  `"tool": null`, but the shipped `tests/fixtures/transcript.jsonl` yields
  `Bash 4 / Read 1 / Glob 1`, and `--scan-report` populates `tool` from the
  scan report. The old example also implied `TOKENS` scaled with `CALLS`
  (240 = 120 × 2), which it does not — `TOKENS` is the schema weight.
- **Fix:** replaced both examples with output captured from the shipped
  fixture and added the sentence "`TOKENS` is the tool's schema weight from
  the scan report, not multiplied by `CALLS`."

## Verified correct (no change)

- **Parser core:** assistant-only extraction, non-array `tool_calls` skipped,
  empty-name calls skipped, per-tool counts and `totalTools`/`totalCalls`
  consistent.
- **Partial results:** unknown shapes are recorded and skipped; `usage` never
  throws on a malformed transcript. Missing transcript files surface as exit 1
  via the top-level catch.
- **Scan-report enrichment:** only `status === "ok"` servers contribute tokens;
  unmatched tools are `count-only`.
- **`scripts/copy-fixtures.mjs`:** correctly mirrors `.jsonl` fixtures into
  `dist/tests/fixtures` (JSONL is not compiled by `tsc`); the fixture rename to
  `transcript.jsonl` is still copied.
- **`src/index.ts`:** `parseTranscript`, `readTranscriptFile`, and the usage
  types are exported; core stays free of CLI-only concerns (ADR-0002).
- **`scan`/`diff` untouched:** no edits to `src/scan.ts`, `src/diff.ts`,
  `src/report.ts`, `src/types.ts`, or their tests. The `diff.test.ts` and
  `scan-out.test.ts` suites pass unchanged. Existing JSON schemas
  (`ScanReport` v1, `DiffReport` v1, `UsageReport` v1) are unchanged.

## Residual limitations (unchanged, and honestly documented)

- The tracer bullet reads a simplified JSONL shape, not Claude Code's native
  session logs.
- Duplicate tool names across servers in a scan report resolve to the first
  server's weight (documented as "per-server tool lists").
- No per-session/per-turn aggregation or dedup (stated in the doc's
  Limitations).
