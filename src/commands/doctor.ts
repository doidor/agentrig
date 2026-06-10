import { existsSync, readdirSync, readFileSync } from "node:fs";
import { auditHarness } from "../core/audit.js";
import { readState, isInstalled } from "../core/state.js";
import { validateSetupSteps } from "../core/setupsteps.js";
import { color, log } from "../core/logger.js";
import { getProvider } from "../agent/index.js";
import { join } from "../core/fsutil.js";

export interface DoctorOptions {
  json?: boolean;
}

/** Aggregate calibration results per judge (mirror of score.mjs calibrate --report). Returns
 *  the worst judge (lowest agreement) so doctor can decide whether to flag a warning. */
function summarizeCalibration(repoRoot: string): { judge: string; n: number; agreement: number; bias: number }[] {
  const dir = join(repoRoot, ".agentrig/eval/calibration/results");
  if (!existsSync(dir)) return [];
  const byJudge = new Map<string, { agreementSum: number; biasSum: number; n: number }>();
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    try {
      const rec = JSON.parse(readFileSync(join(dir, f), "utf8"));
      const j = rec.judgeModel ?? "unknown";
      const acc = byJudge.get(j) ?? { agreementSum: 0, biasSum: 0, n: 0 };
      acc.agreementSum += rec.agreement ?? 0;
      acc.biasSum += rec.bias ?? 0;
      acc.n += 1;
      byJudge.set(j, acc);
    } catch { /* skip */ }
  }
  return [...byJudge.entries()].map(([judge, v]) => ({
    judge,
    n: v.n,
    agreement: v.n ? v.agreementSum / v.n : 0,
    bias: v.n ? v.biasSum / v.n : 0,
  }));
}

/** Quick health check: is a harness installed, is the agent reachable, and what is the score. */
export async function doctorCommand(repoRoot: string, options: DoctorOptions): Promise<number> {
  const installed = isInstalled(repoRoot);
  const state = readState(repoRoot);
  const report = auditHarness(repoRoot);
  const setup = validateSetupSteps(repoRoot);
  const provider = getProvider();
  const pre = await provider.preflight();
  const calibration = summarizeCalibration(repoRoot);
  // Worst judge below 80% agreement = a real concern (P5 gate). Missing calibration = warning only.
  const CALIB_THRESHOLD = 0.8;
  const worstJudge = calibration.sort((a, b) => a.agreement - b.agreement)[0] ?? null;
  const calibrationOk = !worstJudge || worstJudge.agreement >= CALIB_THRESHOLD;

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          installed,
          knowledgeVersion: state?.knowledgeVersion ?? null,
          installCompleteness: report.harnessScore,
          qualityProbes: report.qualityScore,
          setupSteps: setup,
          agent: { provider: provider.name, ...pre },
          calibration: { threshold: CALIB_THRESHOLD, judges: calibration, ok: calibrationOk },
        },
        null,
        2,
      ),
    );
    return installed && pre.ok && calibrationOk ? 0 : 1;
  }

  log.info(color.bold("AgentRig — doctor\n"));
  log.info(`  harness installed     : ${installed ? color.green("yes") : color.red("no")}`);
  if (state) log.info(`  knowledge version     : ${state.knowledgeVersion}`);
  log.info(`  install completeness  : ${report.harnessScore}%`);
  log.info(`  quality probes        : ${report.qualityScore}%`);
  const setupStatus = !setup.present
    ? color.dim("not present")
    : setup.ok
      ? color.green(setup.warnings.length ? `valid (${setup.warnings.length} warning)` : "valid")
      : color.red(`${setup.errors.length} error(s)`);
  log.info(`  setup-steps.yml       : ${setupStatus}`);
  log.info(`  agent (${provider.name})         : ${pre.ok ? color.green(pre.detail) : color.red(pre.detail)}`);

  if (calibration.length === 0) {
    log.info(`  judge calibration     : ${color.dim("no calibration runs yet (see .agentrig/eval/calibration/README.md)")}`);
  } else {
    for (const c of calibration.sort((a, b) => a.agreement - b.agreement)) {
      const mark = c.agreement >= CALIB_THRESHOLD ? color.green("ok") : color.red(`below ${CALIB_THRESHOLD * 100}% threshold`);
      log.info(`  judge ${c.judge.padEnd(15)} : ${(c.agreement * 100).toFixed(1)}% agreement, bias ${c.bias.toFixed(2)}  ${mark}`);
    }
  }

  if (!installed) log.info(color.dim("\n  Run `agentrig init` to install a harness."));
  return installed && pre.ok && calibrationOk ? 0 : 1;
}
