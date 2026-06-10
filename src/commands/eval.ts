import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { auditHarness, type AuditReport } from "../core/audit.js";
import { join } from "../core/fsutil.js";
import { isInstalled } from "../core/state.js";
import { color, log } from "../core/logger.js";
import { getProvider } from "../agent/index.js";
import { AgentTimeoutError } from "../agent/provider.js";
import { listScenarios, locateScenario, loadScenario } from "../core/scenario-runner.js";
import { runDynamicEval } from "./eval-dynamic.js";
import { scaffoldScenarios } from "./eval-scaffold.js";

interface ResolvedModel {
  src: string;
  value: string;
}

/** Pick the first non-empty model in the precedence chain. */
function resolveModel(chain: { src: string; value: string | null | undefined }[]): ResolvedModel | null {
  for (const c of chain) {
    if (c.value && c.value.trim()) return { src: c.src, value: c.value.trim() };
  }
  return null;
}

/** Read the `model:` key from each role yaml in the roster. Best-effort + tolerant of missing
 *  roles so a partially-installed harness doesn't crash the eval. */
function readRosterModels(repoRoot: string): { developer: string | null; reviewer: string | null; judge: string | null } {
  const readModel = (relPath: string): string | null => {
    const abs = join(repoRoot, relPath);
    if (!existsSync(abs)) return null;
    const text = readFileSync(abs, "utf8");
    const m = text.match(/^\s*model\s*:\s*(.+?)\s*$/m);
    return m ? m[1]!.trim() : null;
  };
  return {
    developer: readModel(".agentrig/agents/developer.yml"),
    reviewer: readModel(".agentrig/agents/reviewer.yml"),
    judge: readModel(".agentrig/agents/judge.yml"),
  };
}

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
  model?: string;             // back-compat: alias for producerModel
  producerModel?: string;
  judgeModel?: string;
  allowSameFamily?: boolean;
  trials?: number;            // P4: per-scenario trial count
  seed?: number;              // P4: pass-through seed for reproducibility
  min?: number;
  verbose?: boolean;
  scenario?: string;
  variant?: string;
  timeoutMinutes?: number;
  rubric?: boolean;
  scaffold?: boolean;         // generate repo-specific scenarios via an agent turn
  scaffoldCount?: number;     // how many to generate (default 2)
}

export async function evalCommand(repoRoot: string, options: EvalOptions): Promise<number> {
  if (options.rubric) {
    return renderRubric(repoRoot, Boolean(options.json));
  }
  if (options.scaffold) {
    if (!isInstalled(repoRoot)) {
      log.error("No harness installed. Run `agentrig init` before `agentrig eval --scaffold`.");
      return 1;
    }
    try {
      const res = await scaffoldScenarios(repoRoot, {
        count: options.scaffoldCount ?? 2,
        ...(options.producerModel ?? options.model ? { producerModel: options.producerModel ?? options.model! } : {}),
        ...(options.timeoutMinutes ? { timeoutMinutes: options.timeoutMinutes } : {}),
      });
      if (options.json) console.log(JSON.stringify(res, null, 2));
      return res.invalid.length === 0 ? 0 : 1;
    } catch (err) {
      log.error(`scaffold failed: ${(err as Error).message}`);
      return 1;
    }
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
  const variant = options.variant ?? "harness";
  // Default trial count: 1 for single-scenario, 5 when running A/B against a variant (so
  // harness-lift comparisons are never single-trial coin flips).
  const trials = options.trials ?? (variant === "harness" && options.scenario ? 1 : variant === "baseline" ? 5 : 1);

  // Producer/judge model resolution chain (highest precedence first):
  //   1. explicit --producer-model / --judge-model
  //   2. AGENTRIG_PRODUCER_MODEL / AGENTRIG_JUDGE_MODEL env vars (same vars score.mjs reads)
  //   3. --model flag (legacy back-compat — only sets the producer)
  //   4. .agentrig/agents/developer.yml model → producer
  //      .agentrig/agents/reviewer.yml model → judge
  //      (the roster already enforces these are different families via the install-audit check)
  //   5. nothing → provider falls back to its own default
  const rosterModels = readRosterModels(repoRoot);
  const producerResolved = resolveModel(
    [
      { src: "--producer-model", value: options.producerModel },
      { src: "AGENTRIG_PRODUCER_MODEL", value: process.env.AGENTRIG_PRODUCER_MODEL },
      { src: "--model", value: options.model },
      { src: ".agentrig/agents/developer.yml", value: rosterModels.developer },
    ],
  );
  const judgeResolved = resolveModel(
    [
      { src: "--judge-model", value: options.judgeModel },
      { src: "AGENTRIG_JUDGE_MODEL", value: process.env.AGENTRIG_JUDGE_MODEL },
      { src: ".agentrig/agents/reviewer.yml", value: rosterModels.reviewer },
    ],
  );
  const producerModel = producerResolved?.value;
  const judgeModel = judgeResolved?.value;

  // Per-run artifacts directory + meta.json.
  const runId = `run-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const artifactsDirAbs = join(repoRoot, ".agentrig", "eval", "results", "runs", runId);
  const artifactsDirRel = join(".agentrig", "eval", "results", "runs", runId);
  mkdirSync(artifactsDirAbs, { recursive: true });
  const startedAt = new Date().toISOString();
  const meta: Record<string, unknown> = {
    runId,
    startedAt,
    producerProvider: provider.name,
    producerModel: producerModel ?? null,
    producerModelSource: producerResolved?.src ?? null,
    judgeProvider: provider.name,
    judgeModel: judgeModel ?? null,
    judgeModelSource: judgeResolved?.src ?? null,
    allowSameFamily: Boolean(options.allowSameFamily),
    trials,
    seed: options.seed ?? null,
    scenario: options.scenario ?? "all",
    variant,
    gitHead: gitHead(repoRoot),
  };
  writeFileSync(join(artifactsDirAbs, "meta.json"), JSON.stringify(meta, null, 2));

  const scopeLabel = options.scenario ? `scenario "${options.scenario}"` : "all scenarios";
  log.step(`running dynamic harness evaluation — ${scopeLabel} [variant: ${variant}, n=${trials}]…`);
  log.info(color.dim(`  Run ${runId}; scores + artifacts under ${artifactsDirRel}/`));
  if (producerModel) {
    log.info(color.dim(`  Producer: ${producerModel}   ← ${producerResolved!.src}`));
  } else {
    log.info(color.dim("  Producer: (provider default — no producer-model resolved)"));
  }
  if (judgeModel) {
    log.info(color.dim(`  Judge:    ${judgeModel}   ← ${judgeResolved!.src}`));
  } else {
    log.info(color.dim("  Judge:    (not set — soft axes will be recorded as na)"));
  }

  let timedOut = false;
  try {
    const outcomes = await runDynamicEval(repoRoot, {
      variant,
      trials,
      artifactsDir: artifactsDirAbs,
      artifactsDirRel,
      runId,
      ...(options.scenario ? { scenario: options.scenario } : {}),
      ...(producerModel ? { producerModel } : {}),
      ...(judgeModel ? { judgeModel } : {}),
      ...(options.allowSameFamily ? { allowSameFamily: true } : {}),
      ...(options.timeoutMinutes ? { timeoutMinutes: options.timeoutMinutes } : {}),
      ...(options.seed != null ? { seed: options.seed } : {}),
    });
    const passed = outcomes.filter((o) => o.oraclePassed).length;
    log.ok(`completed ${outcomes.length} trial outcome(s); ${passed} oracle-passing.`);
  } catch (err) {
    if (err instanceof AgentTimeoutError) {
      timedOut = true;
      log.warn(`agent stopped: ${err.message}.`);
    } else {
      log.error(`dynamic eval failed: ${(err as Error).message}`);
      return 1;
    }
  }

  // Finalize the run metadata.
  const finishedAt = new Date().toISOString();
  meta.finishedAt = finishedAt;
  meta.durationMs = Date.parse(finishedAt) - Date.parse(startedAt);
  meta.timedOut = timedOut;
  meta.artifacts = readdirSync(artifactsDirAbs).filter((f) => f !== "meta.json");
  writeFileSync(join(artifactsDirAbs, "meta.json"), JSON.stringify(meta, null, 2));

  // Surface saved results.
  log.info("");
  renderSavedDynamicResults(repoRoot);
  log.info(color.dim(`\n  Run artifacts: ${artifactsDirRel}/`));
  log.info(color.dim("  Compare with baseline: `agentrig eval --dynamic --variant baseline --n 5`, then `node .agentrig/eval/score.mjs compare --scenario <id> --baseline baseline`"));
  return timedOut ? 1 : 0;
}

/** Run the installed score.mjs aggregator and print its report (best-effort). */
function renderSavedDynamicResults(repoRoot: string): void {
  const scoreScript = join(repoRoot, ".agentrig", "eval", "score.mjs");
  if (!existsSync(scoreScript)) return;
  const res = spawnSync(process.execPath, [scoreScript, "report"], { encoding: "utf8" });
  if (res.stdout) process.stdout.write(res.stdout);
}
