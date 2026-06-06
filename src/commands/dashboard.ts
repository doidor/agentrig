import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "../core/fsutil.js";
import { isInstalled } from "../core/state.js";
import { log } from "../core/logger.js";

export interface DashboardOptions {
  json?: boolean;
  html?: string | boolean;
  noTasks?: boolean;
}

/**
 * Render the harness dashboard. The real implementation is the dependency-free
 * `.agentrig/dashboard/dashboard.mjs` installed in the repo (so it also runs without the global
 * CLI); this command is a thin convenience wrapper that forwards flags.
 */
export function dashboardCommand(repoRoot: string, options: DashboardOptions): number {
  const script = join(repoRoot, ".agentrig", "dashboard", "dashboard.mjs");
  if (!existsSync(script)) {
    if (!isInstalled(repoRoot)) {
      log.error("No AgentRig harness here. Run `agentrig init` first.");
    } else {
      log.error("Dashboard not installed. Run `agentrig update` to add it.");
    }
    return 1;
  }

  const passthrough: string[] = [];
  if (options.json) passthrough.push("--json");
  if (options.noTasks) passthrough.push("--no-tasks");
  if (options.html) {
    passthrough.push("--html");
    if (typeof options.html === "string") passthrough.push(options.html);
  }

  const result = spawnSync(process.execPath, [script, ...passthrough], { stdio: "inherit" });
  return result.status ?? 0;
}
