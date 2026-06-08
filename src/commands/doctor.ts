import { auditHarness } from "../core/audit.js";
import { readState, isInstalled } from "../core/state.js";
import { validateSetupSteps } from "../core/setupsteps.js";
import { color, log } from "../core/logger.js";
import { getProvider } from "../agent/index.js";

export interface DoctorOptions {
  json?: boolean;
}

/** Quick health check: is a harness installed, is the agent reachable, and what is the score. */
export async function doctorCommand(repoRoot: string, options: DoctorOptions): Promise<number> {
  const installed = isInstalled(repoRoot);
  const state = readState(repoRoot);
  const report = auditHarness(repoRoot);
  const setup = validateSetupSteps(repoRoot);
  const provider = getProvider();
  const pre = await provider.preflight();

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          installed,
          knowledgeVersion: state?.knowledgeVersion ?? null,
          harnessScore: report.harnessScore,
          setupSteps: setup,
          agent: { provider: provider.name, ...pre },
        },
        null,
        2,
      ),
    );
    return installed && pre.ok ? 0 : 1;
  }

  log.info(color.bold("AgentRig — doctor\n"));
  log.info(`  harness installed : ${installed ? color.green("yes") : color.red("no")}`);
  if (state) log.info(`  knowledge version : ${state.knowledgeVersion}`);
  log.info(`  harness score     : ${report.harnessScore}%`);
  const setupStatus = !setup.present
    ? color.dim("not present")
    : setup.ok
      ? color.green(setup.warnings.length ? `valid (${setup.warnings.length} warning)` : "valid")
      : color.red(`${setup.errors.length} error(s)`);
  log.info(`  setup-steps.yml   : ${setupStatus}`);
  log.info(`  agent (${provider.name})     : ${pre.ok ? color.green(pre.detail) : color.red(pre.detail)}`);
  if (!installed) log.info(color.dim("\n  Run `agentrig init` to install a harness."));
  return installed && pre.ok ? 0 : 1;
}
