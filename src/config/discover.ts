import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export interface Candidate {
  client: string;
  path: string;
}

function appDataDir(): string {
  return process.env.APPDATA ?? path.join(homedir(), "AppData", "Roaming");
}

function xdgConfigDir(): string {
  return process.env.XDG_CONFIG_HOME ?? path.join(homedir(), ".config");
}

export function globalCandidates(): Candidate[] {
  const home = homedir();
  const list: Candidate[] = [
    { client: "cursor", path: path.join(home, ".cursor", "mcp.json") },
    { client: "claude-code", path: path.join(home, ".claude.json") },
  ];

  if (process.platform === "win32") {
    list.push({
      client: "claude-desktop",
      path: path.join(appDataDir(), "Claude", "claude_desktop_config.json"),
    });
    list.push({ client: "vscode", path: path.join(appDataDir(), "Code", "User", "mcp.json") });
  } else if (process.platform === "darwin") {
    list.push({
      client: "claude-desktop",
      path: path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json"),
    });
    list.push({
      client: "vscode",
      path: path.join(home, "Library", "Application Support", "Code", "User", "mcp.json"),
    });
  } else {
    list.push({
      client: "claude-desktop",
      path: path.join(xdgConfigDir(), "Claude", "claude_desktop_config.json"),
    });
    list.push({
      client: "vscode",
      path: path.join(xdgConfigDir(), "Code", "User", "mcp.json"),
    });
  }

  list.push({ client: "opencode", path: path.join(xdgConfigDir(), "opencode", "opencode.jsonc") });
  list.push({ client: "opencode", path: path.join(xdgConfigDir(), "opencode", "opencode.json") });
  list.push({ client: "codex", path: path.join(home, ".codex", "config.toml") });
  return list;
}

export function projectCandidates(cwd: string): Candidate[] {
  return [
    { client: "cursor", path: path.join(cwd, ".cursor", "mcp.json") },
    { client: "claude-code", path: path.join(cwd, ".mcp.json") },
    { client: "opencode", path: path.join(cwd, "opencode.jsonc") },
    { client: "opencode", path: path.join(cwd, "opencode.json") },
    { client: "vscode", path: path.join(cwd, ".vscode", "mcp.json") },
    { client: "codex", path: path.join(cwd, ".codex", "config.toml") },
  ];
}

/**
 * Project configs from `cwd` up to the git root (inclusive), nearest first.
 * Stops after the first ancestor containing `.git`, or at the filesystem root.
 */
export function projectCandidatesUp(cwd: string): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  let dir = path.resolve(cwd);
  for (let depth = 0; depth < 12; depth++) {
    for (const c of projectCandidates(dir)) {
      if (seen.has(c.path)) continue;
      seen.add(c.path);
      if (existsSync(c.path)) out.push(c);
    }
    if (existsSync(path.join(dir, ".git"))) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return out;
}

export function discoverExisting(cwd: string): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const c of [...projectCandidatesUp(cwd), ...globalCandidates()]) {
    if (seen.has(c.path)) continue;
    seen.add(c.path);
    if (existsSync(c.path)) out.push(c);
  }
  return out;
}

export function clientForPath(p: string): string {
  const base = path.basename(p).toLowerCase();
  const norm = p.replace(/\\/g, "/").toLowerCase();
  if (norm.includes("/.cursor/") || norm.includes("/cursor/")) return "cursor";
  if (base === ".claude.json" || base === ".mcp.json") return "claude-code";
  if (norm.includes("claude_desktop_config")) return "claude-desktop";
  if (base === "opencode.jsonc" || base === "opencode.json" || norm.includes("/opencode/"))
    return "opencode";
  if (base === "config.toml" && norm.includes("/.codex/")) return "codex";
  if (norm.includes("/.vscode/") || (base === "mcp.json" && norm.includes("/code/")))
    return "vscode";
  return "custom";
}