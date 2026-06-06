import { auditHarness, type AuditReport } from "../core/audit.js";
import { isInstalled } from "../core/state.js";
import { color, log } from "../core/logger.js";
import { ActivityMonitor } from "../core/activity.js";
import { getProvider } from "../agent/index.js";
import { buildDynamicEvalPrompt, SYSTEM_MESSAGE } from "../prompts/index.js";

export function renderAudit(report: AuditReport): void {
  log.info(color.bold("AgentRig — harness audit"));
  log.info(color.dim(`  checks source: ${report.source}\n`));
  for (const r of [...report.results].sort((a, b) => a.principle - b.principle || a.id.localeCompare(b.id))) {
    const tag =
      r.score === 1 ? color.green("PASS") : r.score === 0.5 ? color.yellow("PART") : color.red("FAIL");
    log.info(`  [${tag}] P${r.principle} ${r.title}`);
    if (r.evidence) log.info(color.dim(`         ↳ ${r.evidence}`));
  }
  const full = report.results.filter((r) => r.score === 1).length;
  const scoreColor = report.harnessScore >= 80 ? color.green : report.harnessScore >= 50 ? color.yellow : color.red;
  log.info(`\n  ${color.bold("Harness Score")}: ${scoreColor(`${report.harnessScore}%`)}  (${full}/${report.results.length} full credit)`);
}

export interface EvalOptions {
  mode: "static" | "dynamic";
  json?: boolean;
  model?: string;
  min?: number;
  verbose?: boolean;
}

export async function evalCommand(repoRoot: string, options: EvalOptions): Promise<number> {
  if (options.mode === "static") {
    const report = auditHarness(repoRoot);
    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      if (!isInstalled(repoRoot)) {
        log.warn("No AgentRig harness detected here (auditing against canonical checks anyway).");
        log.warn("Run `agentrig init` to install one.\n");
      }
      renderAudit(report);
    }
    if (options.min != null && report.harnessScore < options.min) {
      log.error(`Harness Score ${report.harnessScore}% is below required ${options.min}%`);
      return 1;
    }
    return 0;
  }

  // Dynamic: drive the harness behavioral eval through the agent.
  if (!isInstalled(repoRoot)) {
    log.error("No harness installed. Run `agentrig init` before `agentrig eval --dynamic`.");
    return 1;
  }
  const provider = getProvider();
  const pre = await provider.preflight();
  if (!pre.ok) {
    log.error(`Agent unavailable: ${pre.detail}`);
    return 1;
  }
  log.ok(`agent ready (${pre.detail})`);
  log.step("running dynamic harness evaluation (this calls the model)…");
  log.info(color.dim("  live activity below; this can take several minutes.\n"));
  const monitor = new ActivityMonitor().start();
  const convo = await provider.startConversation({
    cwd: repoRoot,
    ...(options.model ? { model: options.model } : {}),
    systemMessage: SYSTEM_MESSAGE,
    onEvent: monitor.handle,
  });
  try {
    const summary = await convo.send(buildDynamicEvalPrompt());
    monitor.stop();
    log.info("\n" + summary);
  } finally {
    monitor.stop();
    await convo.end();
  }
  log.ok("dynamic eval complete — see `node .agentrig/eval/score.mjs report`");
  return 0;
}
