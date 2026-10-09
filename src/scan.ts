import { probeServer } from "./mcp/probe.js";
import { buildTotals } from "./report.js";
import { measureTool, TOKENIZER_NAME, TOKENIZER_NOTE } from "./tokens.js";
import type { ScanReport, ServerReport, ServerSpec } from "./types.js";

export interface ScanOptions {
  timeoutMs: number;
  contextWindow: number;
  tool: { name: string; version: string };
  concurrency?: number;
}

async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (;;) {
      const i = index++;
      if (i >= items.length) return;
      results[i] = await fn(items[i] as T);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function scanSpecs(specs: ServerSpec[], opts: ScanOptions): Promise<ScanReport> {
  const servers = await pool(specs, opts.concurrency ?? 4, async (spec): Promise<ServerReport> => {
    const base = {
      name: spec.name,
      client: spec.client,
      sourcePath: spec.sourcePath,
      transport: spec.transport,
      enabled: spec.enabled,
      envKeys: spec.envKeys,
      headerKeys: spec.headerKeys,
    };
    if (!spec.enabled) {
      return { ...base, status: "disabled", tools: [], totalTokens: 0, totalChars: 0 };
    }
    const res = await probeServer(spec, opts.timeoutMs);
    const tools = res.tools.map(measureTool);
    return {
      ...base,
      status: res.status,
      error: res.error,
      hint: res.hint,
      serverVersion: res.serverVersion,
      tools,
      totalTokens: tools.reduce((a, t) => a + t.tokens, 0),
      totalChars: tools.reduce((a, t) => a + t.chars, 0),
    };
  });

  return {
    schemaVersion: 1,
    tool: opts.tool,
    tokenizer: { name: TOKENIZER_NAME, note: TOKENIZER_NOTE },
    scannedAt: new Date().toISOString(),
    contextWindow: opts.contextWindow,
    servers,
    totals: buildTotals(servers),
  };
}