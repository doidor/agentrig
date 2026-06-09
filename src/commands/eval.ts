import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { auditHarness, type AuditReport } from "../core/audit.js";
import { join } from "../core/fsutil.js";
import { isInstalled } from "../core/state.js";
import { color, log } from "../core/logger.js";
import { ActivityMonitor } from "../core/activity.js";
import { getProvider } from "../agent/index.js";
import { AgentTimeoutError } from "../agent/provider.js";
import { buildDynamicEvalPrompt, SYSTEM_MESSAGE } from "../prompts/index.js";
import { listScenarios, locateScenario, loadScenario } from "../core/scenario-runner.js";

/** Print what the dynamic eval measures: rubric types/axes/issue-codes + installed scenarios. */
export function renderRubric(repoRoot: string, asJson: boolean): number {
  const axesPath = join(repoRoot, ".agentrig", "eval", "axes.json");
  if (!existsSync(axesPath)) {
    log.error("No rubric found (.agentrig/eval/axes.json). Run `agentrig init` first.");
    return 1;
  }
  const axes = JSON.parse(readFileSync(axesPath, "utf8"));
  // Use the scenario-runner discovery so we pick up the new directory layout.
  const scenarios: { id: string; type: string; scope: string }[] = [];
  for (const id of listScenarios(repoRoot)) {
    const paths = locateScenario(repoRoot, id);
    if (!paths) continue;
    try {
      const fm = loadScenario(paths);
      scenarios.push({ id: fm.id, type: fm.type, scope: fm.scope ?? "" });
    } catch {
      scenarios.push({ id, type: "run", scope: "" });
    }
  }

  if (asJson) {
    console.log(JSON.stringify({ passThreshold: axes.passThreshold, tiers: axes.tiers, types: axes.types, scenarios }, null, 2));
    return 0;
  }

  // Helper to render codes from either v1 (["CODE",...]) or v2 ({codes,...}) axis shape.
  const renderCodes = (spec: unknown): string => {
    if (Array.isArray(spec)) return spec.join(", ");
    if (spec && typeof spec === "object" && Array.isArray((spec as { codes?: unknown[] }).codes)) {
      const meta = spec as { codes: string[]; weight?: number; veto?: boolean };
      const flags: string[] = [];
      if (meta.weight != null && meta.weight !== 1) flags.push(`weight=${meta.weight}`);
      if (meta.veto) flags.push("VETO");
      return meta.codes.join(", ") + (flags.length ? ` [${flags.join(", ")}]` : "");
    }
    return "";
  };

  log.info(color.bold("AgentRig — what the dynamic eval measures\n"));
  log.info(color.dim(`  Source of truth: .agentrig/eval/axes.json + RUBRIC.md + scenarios/. Tiers ${(axes.tiers || [0, 0.5, 1]).join("/")}, pass ≥ ${axes.passThreshold}.\n`));
  for (const [type, def] of Object.entries<{ label: string; categories: Record<string, Record<string, unknown>> }>(axes.types)) {
    log.info(`  ${color.bold(type.toUpperCase())} — ${def.label}`);
    for (const [cat, axesMap] of Object.entries(def.categories)) {
      log.info(`    ${color.cyan(cat)}`);
      for (const [axis, spec] of Object.entries(axesMap)) {
        log.info(`      ${axis.padEnd(20)} ${color.dim(`codes: ${renderCodes(spec)}`)}`);
      }
    }
  }
  log.info(`\n  ${color.bold("Scenarios")} (.agentrig/eval/scenarios/):`);
  for (const s of scenarios) log.info(`    ${s.id.padEnd(28)} ${color.dim(`[${s.type}${s.scope ? ", " + s.scope : ""}]`)}`);
  log.info(color.dim("\n  Run them: agentrig eval --dynamic [--scenario <id>]"));
  return 0;
}

/** Best-effort current git HEAD sha of the repo (for replayable run metadata). */
function gitHead(repoRoot: string): string | null {
  const res = spawnSync("git", ["-C", repoRoot, "rev-parse", "HEAD"], { encoding: "utf8" });
  return res.status === 0 ? res.stdout.trim() : null;
}

export function renderAudit(report: AuditReport): void {
  log.info(color.bold("AgentRig — install completeness audit"));
  log.info(color.dim(`  checks source: ${report.source}`));
  log.info(color.dim("  what this proves: every canonical artifact is present and minimally well-formed."));
  log.info(color.dim("  what this does NOT prove: that those artifacts work, or that agents respect them.\n"));

  const sortFn = (a: { principle: number; id: string }, b: { principle: number; id: string }) =>
    a.principle - b.principle || a.id.localeCompare(b.id);
  const completeness = report.results.filter((r) => r.layer === "completeness").sort(sortFn);
  const quality = report.results.filter((r) => r.layer === "quality").sort(sortFn);
  const tagFor = (s: number) =>
    s === 1 ? color.green("PASS") : s === 0.5 ? color.yellow("PART") : color.red("FAIL");
  const printOne = (r: { score: number; principle: number; title: string; evidence: string }) => {
    log.info(`  [${tagFor(r.score)}] P${r.principle} ${r.title}`);
    if (r.evidence) log.info(color.dim(`         ↳ ${r.evidence}`));
  };

  if (completeness.length) {
    log.info(color.bold("  Layer A1 — structural completeness"));
    for (const r of completeness) printOne(r);
  }
  if (quality.length) {
    log.info("");
    log.info(color.bold("  Layer A2 — quality probes"));
    for (const r of quality) printOne(r);
  }

  const fullC = completeness.filter((r) => r.score === 1).length;
  const fullQ = quality.filter((r) => r.score === 1).length;
  const colorFor = (pct: number) => (pct >= 80 ? color.green : pct >= 50 ? color.yellow : color.red);
  log.info("");
  log.info(`  ${color.bold("Install Completeness")}: ${colorFor(report.harnessScore)(`${report.harnessScore}%`)}  (${fullC}/${completeness.length} full credit)`);
  if (quality.length) {
    log.info(`  ${color.bold("Quality Probes")}:      ${colorFor(report.qualityScore)(`${report.qualityScore}%`)}  (${fullQ}/${quality.length} full credit)`);
  }
}

export interface EvalOptions {
  mode: "static" | "dynamic";
  json?: boolean;
  model?: string;
  min?: number;
  verbose?: boolean;
  scenario?: string;
  variant?: string;
  timeoutMinutes?: number;
  rubric?: boolean;
}

export async function evalCommand(repoRoot: string, options: EvalOptions): Promise<number> {
  if (options.rubric) {
    return renderRubric(repoRoot, Boolean(options.json));
  }
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
      log.error(`Install Completeness ${report.harnessScore}% is below required ${options.min}%`);
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
  const variant = options.variant ?? "harness";

  // Create a per-run artifacts directory + meta.json (CLI-owned; the agent fills diff/output).
  const runId = `run-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const artifactsDirAbs = join(repoRoot, ".agentrig", "eval", "results", "runs", runId);
  const artifactsDirRel = join(".agentrig", "eval", "results", "runs", runId);
  mkdirSync(artifactsDirAbs, { recursive: true });
  const startedAt = new Date().toISOString();
  const meta: Record<string, unknown> = {
    runId,
    startedAt,
    producerProvider: provider.name,
    producerModel: options.model ?? null,
    judgeProvider: null,  // filled in P3 when producer/judge are split into separate conversations
    judgeModel: null,
    scenario: options.scenario ?? "all",
    variant,
    gitHead: gitHead(repoRoot),
  };
  writeFileSync(join(artifactsDirAbs, "meta.json"), JSON.stringify(meta, null, 2));

  log.step(`running dynamic harness evaluation — ${scopeLabel}${variant ? ` [variant: ${variant}]` : ""} (this calls the model)…`);
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
    const summary = await convo.send(buildDynamicEvalPrompt(options.scenario, { runId, artifactsDir: artifactsDirRel, ...(variant ? { variant } : {}) }));
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
