import type { ScanReport, ServerReport } from "./types.js";

export interface ServerDelta {
  key: string;
  name: string;
  client: string;
  change: "added" | "removed" | "changed" | "same";
  beforeTokens: number;
  afterTokens: number;
  deltaTokens: number;
  beforeTools: number;
  afterTools: number;
  beforeStatus: string;
  afterStatus: string;
}

export interface DiffReport {
  schemaVersion: 1;
  beforeScannedAt: string;
  afterScannedAt: string;
  beforeToolVersion: string;
  afterToolVersion: string;
  totals: {
    beforeTokens: number;
    afterTokens: number;
    deltaTokens: number;
    deltaPercent: number;
    beforeTools: number;
    afterTools: number;
    deltaTools: number;
  };
  servers: ServerDelta[];
}

const keyOf = (s: ServerReport): string => `${s.client}/${s.name}`;

export function diffReports(before: ScanReport, after: ScanReport): DiffReport {
  const b = new Map(before.servers.map((s) => [keyOf(s), s]));
  const a = new Map(after.servers.map((s) => [keyOf(s), s]));
  const keys = [...new Set([...b.keys(), ...a.keys()])].sort();

  const servers: ServerDelta[] = keys.map((key) => {
    const bs = b.get(key);
    const as = a.get(key);
    const beforeTokens = bs?.totalTokens ?? 0;
    const afterTokens = as?.totalTokens ?? 0;
    const beforeTools = bs?.tools.length ?? 0;
    const afterTools = as?.tools.length ?? 0;
    const change: ServerDelta["change"] = !bs
      ? "added"
      : !as
        ? "removed"
        : beforeTokens !== afterTokens || beforeTools !== afterTools
          ? "changed"
          : "same";
    const ref = (as ?? bs) as ServerReport;
    return {
      key,
      name: ref.name,
      client: ref.client,
      change,
      beforeTokens,
      afterTokens,
      deltaTokens: afterTokens - beforeTokens,
      beforeTools,
      afterTools,
      beforeStatus: bs?.status ?? "-",
      afterStatus: as?.status ?? "-",
    };
  });

  const beforeTokens = before.totals.tokens;
  const afterTokens = after.totals.tokens;
  return {
    schemaVersion: 1,
    beforeScannedAt: before.scannedAt,
    afterScannedAt: after.scannedAt,
    beforeToolVersion: before.tool.version,
    afterToolVersion: after.tool.version,
    totals: {
      beforeTokens,
      afterTokens,
      deltaTokens: afterTokens - beforeTokens,
      deltaPercent:
        beforeTokens === 0 ? (afterTokens === 0 ? 0 : 100) : ((afterTokens - beforeTokens) / beforeTokens) * 100,
      beforeTools: before.totals.tools,
      afterTools: after.totals.tools,
      deltaTools: after.totals.tools - before.totals.tools,
    },
    servers,
  };
}

export interface Threshold {
  failOver?: number;
  failPercent?: number;
}

export function evaluateThreshold(d: DiffReport, t: Threshold): { failed: boolean; reason?: string } {
  if (t.failOver !== undefined && d.totals.deltaTokens > t.failOver) {
    return { failed: true, reason: `total tokens increased by ${d.totals.deltaTokens} (> --fail-over ${t.failOver})` };
  }
  if (t.failPercent !== undefined && d.totals.deltaPercent > t.failPercent) {
    return {
      failed: true,
      reason: `total tokens increased by ${d.totals.deltaPercent.toFixed(1)}% (> --fail-percent ${t.failPercent})`,
    };
  }
  return { failed: false };
}

const pad = (s: string, w: number): string => (s.length >= w ? s : s + " ".repeat(w - s.length));
const num = (n: number): string => n.toLocaleString("en-US");
const signed = (n: number): string => (n > 0 ? `+${num(n)}` : num(n));

export function formatDiff(d: DiffReport): string {
  const lines: string[] = [];
  const pct = d.totals.deltaPercent >= 0 ? `+${d.totals.deltaPercent.toFixed(1)}%` : `${d.totals.deltaPercent.toFixed(1)}%`;
  lines.push(`mcp-weight diff — ${d.beforeScannedAt} → ${d.afterScannedAt}`);
  lines.push(
    `TOTAL: ${num(d.totals.beforeTokens)} → ${num(d.totals.afterTokens)} tokens (${signed(d.totals.deltaTokens)}, ${pct}) · ` +
      `${d.totals.beforeTools} → ${d.totals.afterTools} tools`
  );
  lines.push("");

  const changed = d.servers.filter((s) => s.change !== "same").sort((a, b) => b.deltaTokens - a.deltaTokens);
  if (changed.length === 0) {
    lines.push("No server changes.");
    return lines.join("\n");
  }

  interface Row {
    change: string;
    client: string;
    server: string;
    tokens: string;
    tools: string;
  }
  const rows: Row[] = changed.map((s) => ({
    change: s.change,
    client: s.client,
    server: s.name,
    tokens: `${num(s.beforeTokens)} → ${num(s.afterTokens)} (${signed(s.deltaTokens)})`,
    tools: `${s.beforeTools} → ${s.afterTools}`,
  }));
  const headers: Row = { change: "CHANGE", client: "CLIENT", server: "SERVER", tokens: "TOKENS", tools: "TOOLS" };
  const width = (k: keyof Row) => Math.max(headers[k].length, ...rows.map((r) => r[k].length));
  const w = { change: width("change"), client: width("client"), server: width("server"), tokens: width("tokens"), tools: width("tools") };
  const line = (r: Row): string => [pad(r.change, w.change), pad(r.client, w.client), pad(r.server, w.server), pad(r.tokens, w.tokens), pad(r.tools, w.tools)].join("  ");
  lines.push(line(headers));
  lines.push(["-".repeat(w.change), "-".repeat(w.client), "-".repeat(w.server), "-".repeat(w.tokens), "-".repeat(w.tools)].join("  "));
  for (const r of rows) lines.push(line(r));
  return lines.join("\n");
}