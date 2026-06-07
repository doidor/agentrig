import { existsSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { auditHarness, type AuditReport } from "../core/audit.js";
import { join } from "../core/fsutil.js";
import { isInstalled } from "../core/state.js";
import { color, log } from "../core/logger.js";
import { ActivityMonitor } from "../core/activity.js";
import { getProvider } from "../agent/index.js";
import { AgentTimeoutError } from "../agent/provider.js";
import { buildDynamicEvalPrompt, SYSTEM_MESSAGE } from "../prompts/index.js";

/** Best-effort current git HEAD sha of the repo (for replayable run metadata). */
function gitHead(repoRoot: string): string | null {
  const res = spawnSync("git", ["-C", repoRoot, "rev-parse", "HEAD"], { encoding: "utf8" });
  return res.status === 0 ? res.stdout.trim() : null;
}

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
  scenario?: string;
  timeoutMinutes?: number;
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
  const scopeLabel = options.scenario ? `scenario "${options.scenario}"` : "all scenarios";

  // Create a per-run artifacts directory + meta.json (CLI-owned; the agent fills diff/output).
  const runId = `run-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const artifactsDirAbs = join(repoRoot, ".agentrig", "eval", "results", "runs", runId);
  const artifactsDirRel = join(".agentrig", "eval", "results", "runs", runId);
  mkdirSync(artifactsDirAbs, { recursive: true });
  const startedAt = new Date().toISOString();
  const meta: Record<string, unknown> = {
    runId,
    startedAt,
    provider: provider.name,
    model: options.model ?? null,
    scenario: options.scenario ?? "all",
    gitHead: gitHead(repoRoot),
  };
  writeFileSync(join(artifactsDirAbs, "meta.json"), JSON.stringify(meta, null, 2));

  log.step(`running dynamic harness evaluation — ${scopeLabel} (this calls the model)…`);
  log.info(color.dim(`  Run ${runId}; scores + artifacts under ${artifactsDirRel}/`));
  log.info(color.dim("  Live activity below; this can take many minutes.\n"));

  const monitor = new ActivityMonitor().start();
  const conversationOptions = {
    cwd: repoRoot,
    systemMessage: SYSTEM_MESSAGE,
    onEvent: monitor.handle,
    ...(options.model ? { model: options.model } : {}),
    ...(options.timeoutMinutes ? { maxMs: options.timeoutMinutes * 60 * 1000 } : {}),
  };
  const convo = await provider.startConversation(conversationOptions);
  let timedOut = false;
  try {
    const summary = await convo.send(buildDynamicEvalPrompt(options.scenario, { runId, artifactsDir: artifactsDirRel }));
    monitor.stop();
    log.info("\n" + summary);
  } catch (err) {
    monitor.stop();
    if (err instanceof AgentTimeoutError) {
      timedOut = true;
      log.warn(`agent stopped: ${err.message}.`);
      log.warn("Any scenarios that finished were still saved — showing them below.");
    } else {
      throw err;
    }
  } finally {
    monitor.stop();
    await convo.end();
  }

  // Finalize the run metadata.
  const finishedAt = new Date().toISOString();
  meta.finishedAt = finishedAt;
  meta.durationMs = Date.parse(finishedAt) - Date.parse(startedAt);
  meta.timedOut = timedOut;
  meta.artifacts = readdirSync(artifactsDirAbs).filter((f) => f !== "meta.json");
  writeFileSync(join(artifactsDirAbs, "meta.json"), JSON.stringify(meta, null, 2));

  // Always surface whatever was saved, even on timeout.
  log.info("");
  renderSavedDynamicResults(repoRoot);
  log.info(color.dim(`\n  Run artifacts: ${artifactsDirRel}/ (meta.json + any diff/output the run saved)`));
  log.info(color.dim("  Re-run a single scenario with: agentrig eval --dynamic --scenario <id>"));
  log.info(color.dim("  Raise the cap with: --timeout <minutes>"));
  return timedOut ? 1 : 0;
}

/** Run the installed score.mjs aggregator and print its report (best-effort). */
function renderSavedDynamicResults(repoRoot: string): void {
  const scoreScript = join(repoRoot, ".agentrig", "eval", "score.mjs");
  if (!existsSync(scoreScript)) return;
  const res = spawnSync(process.execPath, [scoreScript, "report"], { encoding: "utf8" });
  if (res.stdout) process.stdout.write(res.stdout);
}
