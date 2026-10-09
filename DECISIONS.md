# DECISIONS

Append-only. Newest last. Numbered. Superseding a decision means adding a new
ADR that references the old one — never editing history silently. A new runtime
dependency is pinned in `package.json` and recorded here.

## ADR-0001: Standalone repo; TypeScript + official MCP SDK; npx distribution

- **Status:** accepted (2026-10-05)
- **Deciders:** operator
- **Related:** `SPEC.md` §2, `PROJECT_CONTEXT.md` §3

### Context

The tool is a command-line scanner for MCP users. Prior art in this space
(`context-tax`, `tooltax`, `mcp-tax`, `mcp-diet`) is Node/npx distributed. The
operator's prior MCP work is TypeScript (`memvid-mcp`); the adjacent research
project (`living-state-machine`) is Python, but this is a CLI whose audience
runs `npx`.

### Decision

- Standalone repository (`mcp-weight`), no monorepo; links to Context Lab later.
- TypeScript on Node >= 20; official `@modelcontextprotocol/sdk` as the client
  library; `js-tiktoken` for token counting.
- Distributed via npm as an unscoped package, run with `npx mcp-weight`.

### Alternatives

- Python + `uvx`: reuses LSM patterns but worse fit for the MCP CLI audience.
- Monorepo from day one: rejected — one tool, no shared code yet.

### Consequences

- Two runtime dependencies; both pinned in `package.json` (lockfile committed).
- Cross-platform paths must be handled explicitly (Windows dev machine).

---

## ADR-0002: CLI-first; no MCP server wrapper in v0.1

- **Status:** accepted (2026-10-05)
- **Related:** `ARCHITECTURE.md` ("The observer effect")

### Context

"An MCP to track an MCP" is tempting, but an MCP server cannot enumerate its
siblings (MCP has no config-discovery primitive) and would add its own tool
schema to the context it measures.

### Decision

The core is a CLI. If an MCP surface is added later, it must call the same core
and include its own weight in reports.

### Consequences

- Config discovery uses the host filesystem directly.
- CI and scheduled runs are possible without an agent in the loop.

---

## ADR-0003: v0.1 parses JSON/JSONC only; Codex TOML deferred

- **Status:** accepted (2026-10-05)

### Context

Five clients use JSON or JSONC (comments, trailing commas). Codex uses TOML,
which would add a parser dependency for one client.

### Decision

Ship JSON/JSONC support in v0.1, including the OpenCode JSONC format. Codex
TOML is a Stage 1 roadmap item.

### Consequences

- `--config <path>` still covers a JSON export from any client.
- No TOML dependency in v0.1.

---

## ADR-0004: Proxy tokenizer is labeled; no fake precision

- **Status:** accepted (2026-10-05)

### Context

Provider tokenizers differ and are not all available locally. Floating-point
"exactness" would be dishonest.

### Decision

Count with `cl100k_base` as a consistent proxy and report a chars/4 estimate
beside it. The tokenizer name and its limits travel in every report (table
header and JSON field). No billing claims.

### Consequences

- Reports are comparable across servers and machines, not exact per provider.
- If a provider-native tokenizer is added later, it is a new labeled column,
  not a silent replacement.

---

## ADR-0005: Read-only invariant; secrets are never printed

- **Status:** accepted (2026-10-05)

### Context

Client configs routinely embed API keys in `env`/`headers` blocks. The tool
must launch servers (which needs those values) while never revealing them.

### Decision

- Env/header values are held in memory only, used to launch/probe, and never
  serialized into any output or log. Reports show keys only.
- mcp-weight never writes client configs.
- Server failures degrade to per-row status; the scan exits 0 with partial
  results.

### Consequences

- Tests must assert redaction on a config that carries fake secrets.
- Logs (if added later) inherit the same rule.

---

## ADR-0006: Project name `mcp-weight`; fallback `mcp-token-cost`

- **Status:** accepted (2026-10-05)

### Context

The working name `mcp-diet` is taken on npm (v0.2.0), as are `mcp-tax`,
`tooltax`, and `context-tax`. Name availability was checked 2026-10-05.

### Decision

Use `mcp-weight` (available). It complements `mcp-diet` (diet selects what
loads; weight measures what it costs). If a rename is ever needed, the recorded
fallback is `mcp-token-cost`.

### Consequences

- Docs, package name, and bin all use `mcp-weight`.
- A rename is a mechanical change plus a new ADR.

---

## ADR-0007: `smol-toml` for Codex TOML configs

- **Status:** accepted (2026-10-09)
- **Related:** `package.json`, `src/config/parse.ts`, `ROADMAP.md` Stage 1

### Context

Codex stores MCP servers in `~/.codex/config.toml` (`[mcp_servers.<name>]`),
and no standard-library TOML parser exists in Node. Hand-rolling TOML would be
error-prone for one client.

### Decision

Add `smol-toml` (ESM, typed, ~1 small package) as a runtime dependency and use
`parseTomlConfig` for `.toml` inputs. JSON/JSONC files keep `parseConfigText`.
Both normalize to the same `ServerSpec`.

### Alternatives

- `@iarna/toml` — mature but heavier and CommonJS-first.
- Hand-rolled subset parser — rejected: correctness risk for a supported client.
- Skip Codex — rejected: it is now a mainstream MCP client.

### Consequences

- One new runtime dependency (pinned in `package.json`).
- `--config <file>.toml` works for any TOML-shaped config, not just Codex.