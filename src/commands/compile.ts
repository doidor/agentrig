import { isInstalled } from "../core/state.js";
import { compileSurfaces } from "../core/compile.js";
import { color, log } from "../core/logger.js";

export interface CompileOptions {
  json?: boolean;
}

/** Re-project the canonical source (AGENTS.md + rules) into every agent surface, local and remote. */
export function compileCommand(repoRoot: string, options: CompileOptions): number {
  if (!isInstalled(repoRoot)) {
    log.error("No AgentRig harness here. Run `agentrig init` first.");
    return 1;
  }
  const result = compileSurfaces(repoRoot);
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }
  log.info(color.bold("AgentRig — compiling agent surfaces\n"));
  for (const p of result.generated) log.info(`  ${color.green("✚")} ${p}`);
  for (const s of result.skipped) log.info(color.dim(`  · ${s.path} — ${s.reason}`));
  log.ok(`\nprojected ${result.generated.length} file(s) for local + remote agents`);
  log.info(color.dim("  Commit these so web/remote agents (GitHub Copilot) and other CLIs benefit too."));
  return 0;
}
