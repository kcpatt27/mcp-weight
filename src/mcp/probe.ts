import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { ProbeResult, RawTool, ServerSpec } from "../types.js";

class ProbeTimeoutError extends Error {}

export async function probeServer(spec: ServerSpec, timeoutMs: number): Promise<ProbeResult> {
  const client = new Client({ name: "mcp-weight", version: "0.1.0" });
  let timer: ReturnType<typeof setTimeout> | undefined;

  const run = (async () => {
    const transport = buildTransport(spec);
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
    /* handled via Promise.race below; prevents unhandled rejection on timeout */
  });

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new ProbeTimeoutError(`timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
  });

  try {
    const { tools, serverVersion } = await Promise.race([run, timeout]);
    return { status: "ok", tools, serverVersion };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = err instanceof ProbeTimeoutError ? "timeout" : "error";
    return { status, error: message, tools: [] };
  } finally {
    if (timer) clearTimeout(timer);
    try {
      await client.close();
    } catch {
      /* already closed or never connected */
    }
  }
}

function buildTransport(spec: ServerSpec) {
  if (spec.transport === "http") {
    const headers = { ...(spec.headers ?? {}) };
    return new StreamableHTTPClientTransport(new URL(spec.url as string), {
      requestInit: Object.keys(headers).length ? { headers } : undefined,
    });
  }

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