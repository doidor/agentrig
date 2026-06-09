/**
 * Dynamic eval orchestrator (P3-P4). Owns the per-scenario flow:
 *   seed worktree -> producer conv (in worktree) -> capture diff
 *   -> run oracle (hard axes) -> judge conv (separate, different family)
 *   -> save record via score.mjs with both producer+judge model metadata.
 *
 * --n controls trial count; each trial is an independent seed+producer+oracle+judge cycle.
 * --variant tags the records so `score.mjs compare --baseline` can compute lift.
 *
 * For `variant=baseline` the producer prompt explicitly tells the agent to ignore AGENTS.md/
 * rules/skills; the same scenario otherwise runs identically. That's the harness on/off A/B.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, cpSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { color, log } from "../core/logger.js";
import { ActivityMonitor } from "../core/activity.js";
import { getProvider } from "../agent/index.js";
import { AgentTimeoutError } from "../agent/provider.js";
import {
  listScenarios,
  locateScenario,
  loadScenario,
  loadOracle,
  seedWorktree,
  runOracle,
  oracleAxisScores,
  oracleAxesToFlags,
  captureDiff,
  type ScenarioPaths,
} from "../core/scenario-runner.js";
import { modelFamily, sameFamily } from "../core/model-family.js";
import { buildProducerPrompt, buildJudgePrompt, SYSTEM_MESSAGE } from "../prompts/index.js";

export interface DynamicRunOptions {
  scenario?: string;
  variant: "harness" | "baseline" | string;
  trials: number;
  seed?: number;
  producerModel?: string;
  judgeModel?: string;
  allowSameFamily?: boolean;
  timeoutMinutes?: number;
  artifactsDir: string;        // absolute
  artifactsDirRel: string;     // repo-relative for logging
  runId: string;
}

interface ScenarioOutcome {
  scenario: string;
  trialIndex: number;
  oraclePassed: boolean;
  saveExit: number;
  notes: string;
}

/** Stage the AgentRig harness (AGENTS.md + .agents/ + .agentrig/) into a worktree for the
 *  "harness" variant so the producer agent sees the same instructions/skills/rules an
 *  AgentRig-installed repo would have. Skipped for the "baseline" variant. */
function stageHarnessInto(worktree: string, repoRoot: string, variant: string): void {
  if (variant === "baseline") return;
  for (const rel of ["AGENTS.md", ".agents", ".agentrig"]) {
    const src = join(repoRoot, rel);
    if (!existsSync(src)) continue;
    cpSync(src, join(worktree, rel), { recursive: true });
  }
}

/** Save a scenario score by shelling out to the installed score.mjs (single source of truth
 *  for the on-disk format + validation). Returns the child exit status. */
function saveScoreViaScript(
  repoRoot: string,
  type: string,
  scenarioId: string,
  axisFlags: string[],
  opts: { variant: string; runId: string; producerModel: string; judgeModel: string; allowSameFamily: boolean },
): { status: number; stdout: string; stderr: string } {
  const script = join(repoRoot, ".agentrig", "eval", "score.mjs");
  const args = [
    script,
    "save",
    "--type", type,
    "--task", scenarioId,
    "--scenario", scenarioId,
    "--judge", opts.judgeModel || "n/a",
    "--variant", opts.variant,
    "--run", opts.runId,
    ...axisFlags.flatMap((f) => ["--axis", f]),
  ];
  // Producer/judge metadata is appended via env so score.mjs can record + validate without
  // adding new positional flags. The new flags are picked up by env in score.mjs's save.
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    AGENTRIG_PRODUCER_MODEL: opts.producerModel || "",
    AGENTRIG_JUDGE_MODEL: opts.judgeModel || "",
    AGENTRIG_ALLOW_SAME_FAMILY: opts.allowSameFamily ? "1" : "",
  };
  const res = spawnSync(process.execPath, args, { encoding: "utf8", env });
  return { status: res.status ?? 1, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
}

/** Read judge soft scores from <artifactsDir>/<scenario>.<trial>.judge.json (judge writes
 *  this file via the prompt — provider-agnostic so we don't depend on tool-calling APIs). */
function readJudgeScores(artifactsDir: string, scenarioId: string, trial: number): { axes: { name: string; score: number; code?: string; evidence?: string; confidence?: number }[] } | null {
  const path = join(artifactsDir, `${scenarioId}.trial${trial}.judge.json`);
  if (!existsSync(path)) return null;
  try {
    const obj = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(obj?.axes) ? obj : null;
  } catch {
    return null;
  }
}

function judgeAxesToFlags(judgeOut: { axes: { name: string; score: number; code?: string; evidence?: string; confidence?: number }[] }): string[] {
  return judgeOut.axes.map((a) => {
    if (a.confidence === 0) return `${a.name}=na`;
    if (a.score >= 1) return `${a.name}=1.0`;
    const code = a.code || "";
    const ev = (a.evidence || "judge-scored").replace(/:/g, ";").slice(0, 200);
    return `${a.name}=${a.score}:${code}:${ev}`;
  });
}

/** Run one trial of one scenario: producer → oracle → judge → save. */
async function runOneTrial(
  repoRoot: string,
  paths: ScenarioPaths,
  trial: number,
  opts: DynamicRunOptions,
): Promise<ScenarioOutcome> {
  const fm = loadScenario(paths);
  const oracle = loadOracle(paths);
  const wt = seedWorktree(paths.fixtureDir, opts.runId, `${fm.id}.trial${trial}`);
  log.info(color.dim(`    [${fm.id} trial ${trial + 1}/${opts.trials}] worktree ${wt}`));
  stageHarnessInto(wt, repoRoot, opts.variant);

  // ---- 1. Producer ----
  // The dogfood scenario skips the producer entirely — the oracle runs `agentrig init` itself.
  const promptText = readFileSync(paths.promptMd, "utf8");
  const isDogfood = fm.id === "agentrig-init-on-empty-repo";
  let producerTranscript = "";

  if (!isDogfood) {
    const provider = getProvider();
    const monitor = new ActivityMonitor().start();
    const convo = await provider.startConversation({
      cwd: wt,
      systemMessage: SYSTEM_MESSAGE,
      onEvent: monitor.handle,
      ...(opts.producerModel ? { model: opts.producerModel } : {}),
      ...(opts.timeoutMinutes ? { maxMs: opts.timeoutMinutes * 60 * 1000 } : {}),
    });
    try {
      producerTranscript = await convo.send(buildProducerPrompt(promptText, opts.variant));
    } catch (err) {
      monitor.stop();
      if (err instanceof AgentTimeoutError) {
        log.warn(`      producer timed out: ${err.message}`);
        producerTranscript = `[producer timed out: ${err.message}]`;
      } else {
        throw err;
      }
    } finally {
      monitor.stop();
      await convo.end();
    }
  }

  // ---- 2. Oracle ----
  const oracleEnv: Record<string, string> = {};
  if (isDogfood) oracleEnv.AGENTRIG_CLI = resolve(repoRoot, "dist/cli.js");
  const oracleResults = runOracle(wt, oracle, oracleEnv);
  const oracleAxes = oracleAxisScores(oracleResults);
  const oracleFlags = oracleAxesToFlags(oracleAxes, fm.type);
  const oraclePassed = oracleAxes.every((a) => a.score === 1);

  // Persist diff + transcript so regressions are inspectable.
  const diff = captureDiff(wt);
  writeFileSync(join(opts.artifactsDir, `${fm.id}.trial${trial}.diff.patch`), diff);
  writeFileSync(join(opts.artifactsDir, `${fm.id}.trial${trial}.transcript.md`), producerTranscript || "(no producer transcript — dogfood scenario)");
  writeFileSync(join(opts.artifactsDir, `${fm.id}.trial${trial}.oracle.json`), JSON.stringify({ axes: oracleAxes, raw: oracleResults }, null, 2));

  // ---- 3. Judge ----
  let judgeFlags: string[] = [];
  const wantJudge = Array.isArray(fm.judge_axes) && fm.judge_axes.length > 0;
  if (wantJudge) {
    if (opts.judgeModel) {
      const provider = getProvider();
      const monitor = new ActivityMonitor().start();
      const judgeOutPath = join(opts.artifactsDir, `${fm.id}.trial${trial}.judge.json`);
      const judgeCwd = join(opts.artifactsDir, `judge.${fm.id}.trial${trial}`);
      mkdirSync(judgeCwd, { recursive: true });
      // The judge sees ONLY: prompt, diff, transcript, oracle results, brief. NOT the producer worktree.
      writeFileSync(join(judgeCwd, "prompt.md"), promptText);
      writeFileSync(join(judgeCwd, "diff.patch"), diff);
      writeFileSync(join(judgeCwd, "transcript.md"), producerTranscript || "");
      writeFileSync(join(judgeCwd, "oracle.json"), JSON.stringify(oracleAxes, null, 2));
      if (paths.judgeBriefMd) writeFileSync(join(judgeCwd, "judge_brief.md"), readFileSync(paths.judgeBriefMd, "utf8"));
      const convo = await provider.startConversation({
        cwd: judgeCwd,
        systemMessage: SYSTEM_MESSAGE,
        onEvent: monitor.handle,
        ...(opts.judgeModel ? { model: opts.judgeModel } : {}),
        ...(opts.timeoutMinutes ? { maxMs: Math.max(1, Math.floor((opts.timeoutMinutes ?? 30) / 3)) * 60 * 1000 } : {}),
      });
      try {
        await convo.send(buildJudgePrompt({
          scenario: fm.id,
          type: fm.type,
          judgeAxes: fm.judge_axes ?? [],
          outputJsonPath: judgeOutPath,
          rubricPath: resolve(repoRoot, ".agentrig/eval/axes.json"),
        }));
      } catch (err) {
        if (err instanceof AgentTimeoutError) log.warn(`      judge timed out: ${err.message}`);
        else throw err;
      } finally {
        monitor.stop();
        await convo.end();
      }
      const judgeOut = readJudgeScores(opts.artifactsDir, fm.id, trial);
      if (judgeOut) judgeFlags = judgeAxesToFlags(judgeOut);
      else log.warn(`      judge did not write ${judgeOutPath} — soft axes recorded as na`);
    }
    // If no judge model OR judge failed to write, mark soft axes na so they're excluded from rollup.
    if (judgeFlags.length === 0) judgeFlags = (fm.judge_axes ?? []).map((a) => `${a}=na`);
  }

  // ---- 4. Save ----
  const allFlags = [...oracleFlags, ...judgeFlags];
  const saved = saveScoreViaScript(repoRoot, fm.type, fm.id, allFlags, {
    variant: opts.variant,
    runId: opts.runId,
    producerModel: opts.producerModel ?? "",
    judgeModel: opts.judgeModel ?? "",
    allowSameFamily: Boolean(opts.allowSameFamily),
  });
  const notes = saved.stderr ? saved.stderr.split("\n").filter(Boolean).slice(-2).join(" | ") : "";
  if (saved.status !== 0) log.warn(`      score.mjs save failed (${saved.status}): ${notes}`);

  return { scenario: fm.id, trialIndex: trial, oraclePassed, saveExit: saved.status, notes };
}

/** Run every scenario × every trial. Returns one outcome per (scenario, trial). */
export async function runDynamicEval(repoRoot: string, opts: DynamicRunOptions): Promise<ScenarioOutcome[]> {
  const ids = opts.scenario ? [opts.scenario] : listScenarios(repoRoot);
  const outcomes: ScenarioOutcome[] = [];

  // Family enforcement up-front so we fail fast (before the first model call).
  if (opts.producerModel && opts.judgeModel && !opts.allowSameFamily) {
    if (sameFamily(opts.producerModel, opts.judgeModel)) {
      throw new Error(
        `producer "${opts.producerModel}" and judge "${opts.judgeModel}" share family "${modelFamily(opts.producerModel)}". ` +
        `Pass --allow-same-family to override (recorded in every result).`,
      );
    }
  }

  for (const id of ids) {
    const paths = locateScenario(repoRoot, id);
    if (!paths) {
      log.warn(`scenario "${id}" not found — skipping`);
      continue;
    }
    log.step(`scenario ${color.bold(id)} (${opts.trials} trial${opts.trials > 1 ? "s" : ""})`);
    for (let trial = 0; trial < opts.trials; trial++) {
      try {
        const outcome = await runOneTrial(repoRoot, paths, trial, opts);
        outcomes.push(outcome);
      } catch (err) {
        log.error(`scenario ${id} trial ${trial + 1} failed: ${(err as Error).message}`);
        outcomes.push({ scenario: id, trialIndex: trial, oraclePassed: false, saveExit: 1, notes: (err as Error).message });
      }
    }
  }
  return outcomes;
}
