import { parse as parseToml } from "smol-toml";
import type { ServerSpec, TransportKind } from "../types.js";

/**
 * Strip JSONC comments and trailing commas, string-aware.
 * URLs inside strings are preserved; `//` and `/* *​/` outside strings are removed.
 */
export function stripJsonc(input: string): string {
  // Pass 1: remove comments.
  let out = "";
  let i = 0;
  const n = input.length;
  let inString = false;
  let inLine = false;
  let inBlock = false;
  while (i < n) {
    const c = input[i] as string;
    const next = input[i + 1];
    if (inLine) {
      if (c === "\n") {
        inLine = false;
        out += c;
      }
      i++;
      continue;
    }
    if (inBlock) {
      if (c === "*" && next === "/") {
        inBlock = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (inString) {
      out += c;
      if (c === "\\") {
        out += next ?? "";
        i += 2;
        continue;
      }
      if (c === '"') inString = false;
      i++;
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
      i++;
      continue;
    }
    if (c === "/" && next === "/") {
      inLine = true;
      i += 2;
      continue;
    }
    if (c === "/" && next === "*") {
      inBlock = true;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }

  // Pass 2: drop trailing commas before `}` or `]` (string-aware).
  let out2 = "";
  let j = 0;
  const m = out.length;
  let str = false;
  while (j < m) {
    const c = out[j] as string;
    if (str) {
      out2 += c;
      if (c === "\\") {
        out2 += out[j + 1] ?? "";
        j += 2;
        continue;
      }
      if (c === '"') str = false;
      j++;
      continue;
    }
    if (c === '"') {
      str = true;
      out2 += c;
      j++;
      continue;
    }
    if (c === ",") {
      let k = j + 1;
      while (k < m && /\s/.test(out[k] as string)) k++;
      const nc = out[k];
      if (nc === "}" || nc === "]") {
        j++;
        continue;
      }
    }
    out2 += c;
    j++;
  }
  return out2;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function asStringArray(v: unknown): string[] | undefined {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : undefined;
}

function asStringRecord(v: unknown): Record<string, string> | undefined {
  if (!isRecord(v)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === "string") out[k] = val;
  }
  return Object.keys(out).length ? out : undefined;
}

export function normalizeEntry(
  name: string,
  raw: unknown,
  client: string,
  sourcePath: string
): ServerSpec | null {
  if (!isRecord(raw)) return null;
  const enabled = raw.enabled !== false && raw.disabled !== true;
  const env = asStringRecord(raw.env) ?? asStringRecord(raw.environment);
  const headers = asStringRecord(raw.headers);
  const url = asString(raw.url);

  let command = asString(raw.command);
  let args = asStringArray(raw.args);
  const cmdArray = asStringArray(raw.command);
  if (!command && cmdArray && cmdArray.length > 0) {
    command = cmdArray[0];
    args = cmdArray.slice(1);
  }
  if (!args && command) args = [];

  const typeRaw = asString(raw.type)?.toLowerCase();
  let transport: TransportKind;
  if (typeRaw === "local" || typeRaw === "stdio") transport = "stdio";
  else if (
    typeRaw === "remote" ||
    typeRaw === "http" ||
    typeRaw === "sse" ||
    typeRaw === "streamable-http" ||
    typeRaw === "streamablehttp"
  )
    transport = "http";
  else transport = url ? "http" : "stdio";

  if (transport === "stdio" && !command) return null;
  if (transport === "http" && !url) return null;

  return {
    name,
    client,
    sourcePath,
    transport,
    enabled,
    command,
    args,
    cwd: asString(raw.cwd),
    url,
    env,
    headers,
    envKeys: env ? Object.keys(env) : undefined,
    headerKeys: headers ? Object.keys(headers) : undefined,
  };
}

export interface ParsedConfig {
  shape: string;
  specs: ServerSpec[];
}

export function parseConfigText(
  text: string,
  sourcePath: string,
  clientHint = "custom"
): ParsedConfig {
  const json = JSON.parse(stripJsonc(text)) as unknown;
  if (!isRecord(json)) throw new Error("config root is not an object");
  const specs: ServerSpec[] = [];

  const addAll = (container: unknown): boolean => {
    if (!isRecord(container)) return false;
    let added = false;
    for (const [name, raw] of Object.entries(container)) {
      const spec = normalizeEntry(name, raw, clientHint, sourcePath);
      if (spec) {
        specs.push(spec);
        added = true;
      }
    }
    return added;
  };

  // Claude Code `~/.claude.json`: top-level mcpServers plus per-project mcpServers.
  if (clientHint === "claude-code") {
    addAll(json.mcpServers);
    const projects = isRecord(json.projects) ? json.projects : undefined;
    if (projects) {
      for (const [projPath, proj] of Object.entries(projects)) {
        if (isRecord(proj) && isRecord(proj.mcpServers)) {
          for (const [name, raw] of Object.entries(proj.mcpServers)) {
            const spec = normalizeEntry(
              name,
              raw,
              "claude-code",
              `${sourcePath}#project:${projPath}`
            );
            if (spec) specs.push(spec);
          }
        }
      }
    }
    return { shape: "claude-code", specs };
  }

  if (isRecord(json.mcpServers)) {
    addAll(json.mcpServers);
    return { shape: "mcpServers", specs };
  }
  if (isRecord(json.servers)) {
    addAll(json.servers);
    return { shape: "servers", specs };
  }
  if (isRecord(json.mcp)) {
    const mcp = json.mcp;
    if (isRecord(mcp.servers)) {
      addAll(mcp.servers);
      return { shape: "mcp.servers", specs };
    }
    if (addAll(mcp)) return { shape: "mcp", specs };
  }
  return { shape: "unknown", specs };
}

/**
 * TOML configs (Codex `~/.codex/config.toml`). Same normalization as JSON;
 * `mcp_servers` is the Codex convention, the others are accepted for parity.
 */
export function parseTomlConfig(
  text: string,
  sourcePath: string,
  clientHint = "codex"
): ParsedConfig {
  const json = parseToml(text) as unknown;
  if (!isRecord(json)) throw new Error("config root is not a table");
  const specs: ServerSpec[] = [];

  const addAll = (container: unknown): boolean => {
    if (!isRecord(container)) return false;
    let added = false;
    for (const [name, raw] of Object.entries(container)) {
      const spec = normalizeEntry(name, raw, clientHint, sourcePath);
      if (spec) {
        specs.push(spec);
        added = true;
      }
    }
    return added;
  };

  if (isRecord(json.mcp_servers)) {
    addAll(json.mcp_servers);
    return { shape: "toml:mcp_servers", specs };
  }
  if (isRecord(json.mcpServers)) {
    addAll(json.mcpServers);
    return { shape: "toml:mcpServers", specs };
  }
  if (isRecord(json.mcp)) {
    const mcp = json.mcp;
    if (isRecord(mcp.servers)) {
      addAll(mcp.servers);
      return { shape: "toml:mcp.servers", specs };
    }
    if (addAll(mcp)) return { shape: "toml:mcp", specs };
  }
  return { shape: "toml:unknown", specs };
}