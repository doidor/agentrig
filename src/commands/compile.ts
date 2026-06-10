import { isInstalled } from "../core/state.js";
import { compileSurfaces } from "../core/compile.js";
import { validateSetupSteps } from "../core/setupsteps.js";
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
  const setup = validateSetupSteps(repoRoot);
  if (options.json) {
    console.log(JSON.stringify({ ...result, setupSteps: setup }, null, 2));
    return setup.ok ? 0 : 1;
  }
  log.info(color.bold("AgentRig — compiling agent surfaces\n"));
  if (result.markers.updated.length) {
    log.ok(`AGENTS.md: refreshed marker block${result.markers.updated.length === 1 ? "" : "s"} — ${result.markers.updated.join(", ")}`);
  }
  for (const p of result.generated) log.info(`  ${color.green("✚")} ${p}`);
  for (const s of result.skipped) log.info(color.dim(`  · ${s.path} — ${s.reason}`));
  log.ok(`\nprojected ${result.generated.length} file(s) for local + remote agents`);
  renderSetupValidation(setup);
  log.info(color.dim("  Commit these so web/remote agents (GitHub Copilot) and other CLIs benefit too."));
  return setup.ok ? 0 : 1;
}

/** Print the copilot-setup-steps.yml validation result. */
export function renderSetupValidation(setup: ReturnType<typeof validateSetupSteps>): void {
  if (!setup.present) return;
  if (setup.ok && setup.warnings.length === 0) {
    log.ok(`copilot-setup-steps.yml is valid (checked: ${setup.checkedWith.join(", ")})`);
    return;
  }
  for (const e of setup.errors) log.error(`copilot-setup-steps.yml: ${e}`);
  for (const w of setup.warnings) log.warn(`copilot-setup-steps.yml: ${w}`);
  if (!setup.ok) log.info(color.dim("  GitHub also validates this workflow on push (Actions tab)."));
}
