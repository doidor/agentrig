import { join } from "node:path";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { basename } from "node:path";
import { homedir } from "node:os";
import { readText } from "./fsutil.js";

/** Read `labels.state_map` (state -> label) from the installed state machine. */
export function readStateLabels(repoRoot: string): Record<string, string> {
  const text = readText(join(repoRoot, ".agentrig", "harness", "state-machine.yml"));
  if (!text) return {};
  const lines = text.split("\n");
  const map: Record<string, string> = {};
  let inStateMap = false;
  let baseIndent: number | null = null;
  for (const line of lines) {
    if (/^\s*state_map:\s*$/.test(line)) {
      inStateMap = true;
      baseIndent = null;
      continue;
    }
    if (!inStateMap) continue;
    if (line.trim() === "") continue;
    const indent = line.length - line.trimStart().length;
    const m = line.match(/^\s*([a-z_]+)\s*:\s*([A-Za-z0-9_-]+)\s*$/);
    if (baseIndent === null && m) baseIndent = indent;
    if (m && indent === baseIndent) map[m[1]!] = m[2]!;
    else if (!m && indent <= (baseIndent ?? 0)) break;
  }
  return map;
}

/** Read the numeric `limits:` block from the installed state machine. */
export function readLimits(repoRoot: string): Record<string, number> {
  const text = readText(join(repoRoot, ".agentrig", "harness", "state-machine.yml"));
  if (!text) return {};
  const out: Record<string, number> = {};
  const block = text.split(/^\s*limits:\s*$/m)[1];
  if (!block) return out;
  for (const line of block.split("\n")) {
    const m = line.match(/^\s{2,}([a-z_]+)\s*:\s*(\d+)\s*$/);
    if (m) out[m[1]!] = Number(m[2]);
    else if (/^\S/.test(line) && line.trim() !== "") break;
  }
  return out;
}

export function ghAvailable(): boolean {
  try {
    execFileSync("gh", ["auth", "status"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export interface ReadyIssue {
  number: number;
  title: string;
  body: string;
}

/** List open issues carrying the ready label. */
export function listReadyIssues(repoRoot: string, label: string, limit: number): ReadyIssue[] {
  try {
    const out = execFileSync(
      "gh",
      ["issue", "list", "--label", label, "--state", "open", "--limit", String(limit), "--json", "number,title,body"],
      { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    return JSON.parse(out) as ReadyIssue[];
  } catch {
    return [];
  }
}

/** Compare-and-set claim: swap the ready label for the started label. Returns false if it fails. */
export function claimIssue(repoRoot: string, n: number, ready: string, started: string): boolean {
  try {
    execFileSync("gh", ["issue", "edit", String(n), "--add-label", started, "--remove-label", ready], {
      cwd: repoRoot,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

export function commentIssue(repoRoot: string, n: number, body: string): void {
  try {
    execFileSync("gh", ["issue", "comment", String(n), "--body", body], { cwd: repoRoot, stdio: "ignore" });
  } catch {
    /* best-effort */
  }
}

/** Create (or reuse) a hermetic worktree for an agent; returns its path. */
export function createWorktree(repoRoot: string, agentId: string): string {
  const base = process.env.AGENTRIG_WORKTREE_BASE ?? join(homedir(), ".agentrig", "worktrees", basename(repoRoot));
  const dir = join(base, agentId);
  const branch = `agentrig/${agentId}`;
  execFileSync("git", ["-C", repoRoot, "worktree", "prune", "--expire", "now"], { stdio: "ignore" });
  const existing = execFileSync("git", ["-C", repoRoot, "worktree", "list", "--porcelain"], { encoding: "utf8" });
  if (!existing.includes(`worktree ${dir}\n`)) {
    execFileSync("git", ["-C", repoRoot, "worktree", "add", "-B", branch, dir], { stdio: "ignore" });
  }
  return dir;
}

export function worktreeBranch(agentId: string): string {
  return `agentrig/${agentId}`;
}

export function isGitRepo(repoRoot: string): boolean {
  return existsSync(join(repoRoot, ".git")) ||
    (() => {
      try {
        execFileSync("git", ["-C", repoRoot, "rev-parse", "--git-dir"], { stdio: "ignore" });
        return true;
      } catch {
        return false;
      }
    })();
}
