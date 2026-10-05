export type TransportKind = "stdio" | "http";

export interface ServerSpec {
  name: string;
  client: string;
  sourcePath: string;
  transport: TransportKind;
  command?: string;
  args?: string[];
  cwd?: string;
  url?: string;
  /** Values are used only to launch the server; never serialized into reports. */
  env?: Record<string, string>;
  /** Values are used only to reach the server; never serialized into reports. */
  headers?: Record<string, string>;
  envKeys?: string[];
  headerKeys?: string[];
  enabled: boolean;
}

export interface RawTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
  [k: string]: unknown;
}

export type ProbeStatus = "ok" | "error" | "timeout";

export interface ProbeResult {
  status: ProbeStatus;
  error?: string;
  serverVersion?: string;
  tools: RawTool[];
}

export interface ToolMeasure {
  name: string;
  tokens: number;
  chars: number;
  estimate: number;
  descriptionChars: number;
  schemaChars: number;
}

export interface ServerReport {
  name: string;
  client: string;
  sourcePath: string;
  transport: TransportKind;
  enabled: boolean;
  status: ProbeStatus | "disabled";
  error?: string;
  serverVersion?: string;
  envKeys?: string[];
  headerKeys?: string[];
  tools: ToolMeasure[];
  totalTokens: number;
  totalChars: number;
}

export interface ScanReport {
  schemaVersion: 1;
  tool: { name: string; version: string };
  tokenizer: { name: string; note: string };
  scannedAt: string;
  contextWindow: number;
  servers: ServerReport[];
  totals: {
    servers: number;
    ok: number;
    failed: number;
    disabled: number;
    tools: number;
    tokens: number;
    chars: number;
  };
}