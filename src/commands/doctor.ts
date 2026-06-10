import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { auditHarness } from "../core/audit.js";
import { readState, isInstalled } from "../core/state.js";
import { validateSetupSteps } from "../core/setupsteps.js";
import { runValidation } from "../core/validate.js";
import { color, log } from "../core/logger.js";
import { getProvider } from "../agent/index.js";
import { join } from "../core/fsutil.js";
import pkg from "../version.js";

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

/**
 * Detect when the global `agentrig` binary resolves to a development checkout (typically via
 * `npm link` or `npm install -g <local-path>`). When linked, the CLI shipped on npm may already
 * be ahead — and the user's `agentrig --version` looks "current" only because they're running
 * their own working copy. We surface both the realpath and the latest npm version so they can
 * decide whether to `npm install -g @doidor/agentrig@latest`.
 */
function detectInstallProvenance(): {
  argv1: string;
  realpath: string;
  source: "registry" | "linked-checkout" | "unknown";
  npmLatest: string | null;
  current: string;
} {
  const argv1 = process.argv[1] ?? "";
  let real = argv1;
  try { real = realpathSync(argv1); } catch { /* ignore */ }
  // A registry install lives under <prefix>/lib/node_modules/<scope>/<name>/…
  // A linked install resolves to a path WITHOUT a `node_modules/<scope>/<name>` ancestor.
  const source: "registry" | "linked-checkout" | "unknown" = /[\\/]node_modules[\\/]@?[^\\/]+[\\/][^\\/]+[\\/]/.test(real)
    ? "registry"
    : argv1
      ? "linked-checkout"
      : "unknown";
  // Best-effort latest-version probe (3s timeout). Offline / unreachable → null, no harm.
  const res = spawnSync("npm", ["view", "@doidor/agentrig", "version"], { encoding: "utf8", timeout: 3000 });
  const npmLatest = res.status === 0 ? res.stdout.trim() : null;
  return { argv1, realpath: real, source, npmLatest, current: pkg.version };
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
  const provenance = detectInstallProvenance();
  // Validation (broken YAML / unknown model ids). These are FATAL — a doctor that returns 0 on
  // a broken install gives the operator a false sense of safety.
  const validation = installed ? runValidation(repoRoot) : { yaml: [], models: [], hasBlockers: false };
  // Worst judge below 80% agreement = a real concern (P5 gate). Missing calibration = warning only.
  const CALIB_THRESHOLD = 0.8;
  const worstJudge = calibration.sort((a, b) => a.agreement - b.agreement)[0] ?? null;
  const calibrationOk = !worstJudge || worstJudge.agreement >= CALIB_THRESHOLD;
  const versionStale = provenance.npmLatest && provenance.npmLatest !== provenance.current;

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
          install: provenance,
          validation,
        },
        null,
        2,
      ),
    );
    return installed && pre.ok && calibrationOk && !validation.hasBlockers ? 0 : 1;
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

  // Validation hard-failures bubble up under their own heading.
  if (validation.yaml.length || validation.models.length) {
    log.info("");
    log.info(color.bold("  Validation"));
    for (const y of validation.yaml) log.info(`  ${color.red("✗")} ${y.path}: invalid YAML — ${y.error.split("\n")[0]}`);
    for (const m of validation.models) {
      const hint = m.suggestions.length ? `  ${color.dim(`did you mean: ${m.suggestions.join(", ")}?`)}` : "";
      log.info(`  ${color.red("✗")} ${m.path}: unknown model "${m.value}"${hint}`);
    }
    log.info(color.dim("  Run `agentrig fix` to repair these deterministically from canonical."));
  }

  // Install provenance + version freshness.
  log.info("");
  log.info(color.bold("  Install"));
  log.info(`  agentrig version      : ${provenance.current}${versionStale ? color.yellow(`  (npm latest: ${provenance.npmLatest})`) : color.green("  (latest)")}`);
  if (provenance.source === "linked-checkout") {
    log.info(`  install source        : ${color.yellow("linked checkout")}  ${color.dim(`→ ${provenance.realpath}`)}`);
    log.info(color.dim("  Your `agentrig` binary points to a local dev checkout. Run `npm install -g @doidor/agentrig@latest` to switch back to the published version."));
  } else if (provenance.source === "registry") {
    log.info(`  install source        : ${color.green("npm registry")}  ${color.dim(`→ ${provenance.realpath}`)}`);
  } else {
    log.info(`  install source        : ${color.dim("unknown")}`);
  }

  if (calibration.length === 0) {
    log.info(`  judge calibration     : ${color.dim("no calibration runs yet (see .agentrig/eval/calibration/README.md)")}`);
  } else {
    for (const c of calibration.sort((a, b) => a.agreement - b.agreement)) {
      const mark = c.agreement >= CALIB_THRESHOLD ? color.green("ok") : color.red(`below ${CALIB_THRESHOLD * 100}% threshold`);
      log.info(`  judge ${c.judge.padEnd(15)} : ${(c.agreement * 100).toFixed(1)}% agreement, bias ${c.bias.toFixed(2)}  ${mark}`);
    }
  }

  if (!installed) log.info(color.dim("\n  Run `agentrig init` to install a harness."));
  return installed && pre.ok && calibrationOk && !validation.hasBlockers ? 0 : 1;
}
