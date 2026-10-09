import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { ProbeResult, RawTool, ServerSpec } from "../types.js";

type ClientTransport = Parameters<Client["connect"]>[0];

class ProbeTimeoutError extends Error {}

export interface ErrorClass {
  kind: "auth" | "not-found" | "connection" | "timeout" | "protocol" | "other";
  hint: string;
}

/** Map a raw transport error to an actionable class + hint for the report. */
export function classifyProbeError(message: string): ErrorClass {
  const m = message.toLowerCase();
  if (/(401|403|unauthor|forbidden|invalid[ _-]?token|api[ _-]?key|bearer)/.test(m)) {
    return {
      kind: "auth",
      hint: "remote server likely needs credentials (headers/OAuth); mcp-weight does not perform auth flows",
    };
  }
  if (/(enoent|not recognized|no such file|cannot find module)/.test(m)) {
    return {
      kind: "not-found",
      hint: "command not found — check the path and that its runtime is installed",
    };
  }
  if (/(econnrefused|enotfound|fetch failed|connection closed|socket hang up|network|dns)/.test(m)) {
    return { kind: "connection", hint: "could not reach the server — is it running/installed?" };
  }
  if (/(timed? ?out|timeout)/.test(m)) {
    return { kind: "timeout", hint: "server did not respond within the timeout — raise --timeout if it is slow" };
  }
  if (/(json|parse|protocol|schema|invalid|unexpected token)/.test(m)) {
    return { kind: "protocol", hint: "server responded but not with a valid MCP handshake" };
  }
  return { kind: "other", hint: "" };
}

function failure(err: unknown): ProbeResult {
  const message = err instanceof Error ? err.message : String(err);
  if (err instanceof ProbeTimeoutError) {
    return { status: "timeout", error: message, hint: classifyProbeError(message).hint, tools: [] };
  }
  const classified = classifyProbeError(message);
  return { status: "error", error: message, hint: classified.hint || undefined, tools: [] };
}

async function closeQuietly(client: Client): Promise<void> {
  try {
    await client.close();
  } catch {
    /* never connected, or already closed */
  }
}

async function runClient(
  client: Client,
  transport: ClientTransport,
  timeoutMs: number
): Promise<{ tools: RawTool[]; serverVersion?: string }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = (async () => {
    await client.connect(transport);
    const res = await client.listTools();
    const version = (
      client as unknown as {
        getServerVersion?: () => { name: string; version: string } | undefined;
      }
    ).getServerVersion?.();
    return {
      tools: (res.tools ?? []) as unknown as RawTool[],
      serverVersion: version ? `${version.name}@${version.version}` : undefined,
    };
  })();
  void run.catch(() => {
    /* surfaced via the race below; prevents unhandled rejection on timeout */
  });
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ProbeTimeoutError(`timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([run, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function stdioTransport(spec: ServerSpec): ClientTransport {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === "string") env[k] = v;
  }
  for (const [k, v] of Object.entries(spec.env ?? {})) env[k] = v;
  return new StdioClientTransport({
    command: spec.command as string,
    args: spec.args ?? [],
    cwd: spec.cwd,
    env,
    stderr: "ignore",
  });
}

function requestInit(spec: ServerSpec): RequestInit | undefined {
  const headers = { ...(spec.headers ?? {}) };
  return Object.keys(headers).length ? { headers } : undefined;
}

async function probeStdio(spec: ServerSpec, timeoutMs: number): Promise<ProbeResult> {
  const client = new Client({ name: "mcp-weight", version: "0.1.0" });
  try {
    const { tools, serverVersion } = await runClient(client, stdioTransport(spec), timeoutMs);
    return { status: "ok", tools, serverVersion };
  } catch (err) {
    return failure(err);
  } finally {
    await closeQuietly(client);
  }
}

/** Try Streamable HTTP first, then legacy SSE; report the last error with a hint. */
async function probeHttp(spec: ServerSpec, timeoutMs: number): Promise<ProbeResult> {
  const url = new URL(spec.url as string);
  const attempts: Array<() => ClientTransport> = [
    () => new StreamableHTTPClientTransport(url, { requestInit: requestInit(spec) }),
    () => new SSEClientTransport(url, { requestInit: requestInit(spec) }),
  ];
  let lastError: unknown;
  for (const build of attempts) {
    const client = new Client({ name: "mcp-weight", version: "0.1.0" });
    try {
      const { tools, serverVersion } = await runClient(client, build(), timeoutMs);
      return { status: "ok", tools, serverVersion };
    } catch (err) {
      lastError = err;
      if (err instanceof ProbeTimeoutError) return failure(err);
    } finally {
      await closeQuietly(client);
    }
  }
  return failure(lastError ?? new Error("no HTTP transport succeeded"));
}

export async function probeServer(spec: ServerSpec, timeoutMs: number): Promise<ProbeResult> {
  return spec.transport === "http" ? probeHttp(spec, timeoutMs) : probeStdio(spec, timeoutMs);
}