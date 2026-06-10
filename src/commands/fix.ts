import { isInstalled } from "../core/state.js";
import { autoFix } from "../core/fix.js";
import { runValidation } from "../core/validate.js";
import { color, log } from "../core/logger.js";

export interface FixOptions {
  dryRun?: boolean;
  json?: boolean;
}

/**
 * Apply deterministic auto-fixes for A1 failures the audit would otherwise leave broken:
 * invalid YAML and unknown model ids. No agent or network needed.
 */
export function fixCommand(repoRoot: string, options: FixOptions): number {
  if (!isInstalled(repoRoot)) {
    log.error("No AgentRig harness here. Run `agentrig init` first.");
    return 1;
  }
  const validation = runValidation(repoRoot);
  if (!validation.hasBlockers) {
    if (options.json) console.log(JSON.stringify({ ok: true, actions: [], unresolved: [] }, null, 2));
    else log.ok("Nothing to fix — no broken YAML or unknown model ids.");
    return 0;
  }

  const result = autoFix(repoRoot, {
    yamlFindings: validation.yaml,
    modelFindings: validation.models,
    dryRun: options.dryRun,
  });

  if (options.json) {
    console.log(JSON.stringify({ ok: result.unresolved.length === 0, ...result, dryRun: Boolean(options.dryRun) }, null, 2));
    return result.unresolved.length === 0 ? 0 : 1;
  }

  log.info(color.bold(`AgentRig — fix${options.dryRun ? " (dry run)" : ""}\n`));
  if (result.actions.length === 0) {
    log.warn("No deterministic fix available for the findings — see `unresolved` below.");
  }
  for (const a of result.actions) {
    log.ok(`${a.path}: ${a.description}`);
    if (!options.dryRun) log.info(color.dim(`  ↳ backup written to ${a.backup}`));
  }
  if (result.unresolved.length) {
    log.info("");
    log.warn(`${result.unresolved.length} unresolved finding(s) — manual reconciliation needed:`);
    for (const u of result.unresolved) log.info(`  ${color.yellow("·")} ${u.path}: ${u.reason}`);
  }
  log.info("");
  log.info(color.dim(options.dryRun
    ? "Re-run without --dry-run to apply these changes."
    : "Review with `git diff` and revert any `.bak` backups you don't need."));
  return result.unresolved.length === 0 ? 0 : 1;
}
