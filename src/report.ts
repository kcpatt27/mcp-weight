import type { ScanReport, ServerReport } from "./types.js";

const fmt = (n: number): string => n.toLocaleString("en-US");
const pad = (s: string, w: number): string => (s.length >= w ? s : s + " ".repeat(w - s.length));
const padL = (s: string, w: number): string =>
  s.length >= w ? s : " ".repeat(w - s.length) + s;

export function buildTotals(servers: ServerReport[]): ScanReport["totals"] {
  let tools = 0;
  let tokens = 0;
  let chars = 0;
  let ok = 0;
  let failed = 0;
  let disabled = 0;
  for (const s of servers) {
    if (s.status === "ok") ok++;
    else if (s.status === "disabled") disabled++;
    else failed++;
    tools += s.tools.length;
    tokens += s.totalTokens;
    chars += s.totalChars;
  }
  return { servers: servers.length, ok, failed, disabled, tools, tokens, chars };
}

export function formatReport(report: ScanReport, verbose = false): string {
  const lines: string[] = [];
  const pct = (tokens: number): string =>
    `${((tokens / report.contextWindow) * 100).toFixed(1)}%`;

  lines.push(`mcp-weight ${report.tool.version} — MCP context weight report`);
  lines.push(`Tokenizer: ${report.tokenizer.name} (${report.tokenizer.note})`);
  lines.push(`Scanned: ${report.scannedAt} · window basis: ${fmt(report.contextWindow)} tokens`);
  lines.push("");

  interface Row {
    client: string;
    server: string;
    tools: string;
    tokens: string;
    est: string;
    status: string;
  }
  const rows: Row[] = report.servers.map((s) => ({
    client: s.client,
    server: s.name,
    tools: s.status === "ok" ? String(s.tools.length) : "-",
    tokens: s.status === "ok" ? fmt(s.totalTokens) : "-",
    est: s.status === "ok" ? `~${fmt(Math.ceil(s.totalChars / 4))}` : "-",
    status: s.status,
  }));

  const headers: Row = {
    client: "CLIENT",
    server: "SERVER",
    tools: "TOOLS",
    tokens: "TOKENS",
    est: "~TOKENS",
    status: "STATUS",
  };
  const width = (key: keyof Row, min: number): number =>
    Math.max(min, ...rows.map((r) => r[key].length));
  const w = {
    client: width("client", headers.client.length),
    server: width("server", headers.server.length),
    tools: width("tools", headers.tools.length),
    tokens: width("tokens", headers.tokens.length),
    est: width("est", headers.est.length),
    status: width("status", headers.status.length),
  };
  const line = (r: Row): string =>
    [
      pad(r.client, w.client),
      pad(r.server, w.server),
      padL(r.tools, w.tools),
      padL(r.tokens, w.tokens),
      padL(r.est, w.est),
      pad(r.status, w.status),
    ].join("  ");

  lines.push(line(headers));
  lines.push(
    [
      "-".repeat(w.client),
      "-".repeat(w.server),
      "-".repeat(w.tools),
      "-".repeat(w.tokens),
      "-".repeat(w.est),
      "-".repeat(w.status),
    ].join("  ")
  );
  for (const r of rows) lines.push(line(r));

  lines.push("");
  const t = report.totals;
  lines.push(
    `Total: ${fmt(t.tools)} tools · ${fmt(t.tokens)} tokens (${pct(t.tokens)} of window) · ` +
      `${t.servers} servers (${t.ok} ok, ${t.failed} failed, ${t.disabled} disabled)`
  );

  // Duplicate server names across clients.
  const counts = new Map<string, number>();
  for (const s of report.servers) counts.set(s.name, (counts.get(s.name) ?? 0) + 1);
  const dupes = [...counts.entries()].filter(([, n]) => n > 1).map(([name]) => name);
  if (dupes.length) {
    lines.push(`Note: configured in multiple places: ${dupes.join(", ")}`);
  }

  const failures = report.servers.filter((s) => s.status === "error" || s.status === "timeout");
  if (failures.length) {
    lines.push("");
    for (const f of failures) {
      lines.push(`! ${f.client}/${f.name}: ${f.status}${f.error ? ` — ${f.error}` : ""}`);
    }
  }

  if (verbose) {
    lines.push("");
    for (const s of report.servers) {
      if (s.status !== "ok" || s.tools.length === 0) continue;
      lines.push(`${s.client}/${s.name} — per tool${s.serverVersion ? ` (${s.serverVersion})` : ""}`);
      for (const tool of [...s.tools].sort((a, b) => b.tokens - a.tokens)) {
        lines.push(
          `  ${padL(String(tool.tokens), 7)}  ${tool.name}  (desc ${tool.descriptionChars}c, schema ${tool.schemaChars}c)`
        );
      }
    }
  }

  return lines.join("\n");
}