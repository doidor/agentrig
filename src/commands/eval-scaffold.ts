/**
 * `agentrig eval --scaffold` orchestrator. Asks the agent to generate repo-specific scenarios
 * alongside the bundled generic ones, then validates each new scenario's structure via the
 * existing scenario-runner load logic. No-ops for invalid output rather than corrupting the
 * eval surface.
 */
import { existsSync, readFileSync } from "node:fs";
import { ActivityMonitor } from "../core/activity.js";
import { color, log } from "../core/logger.js";
import { getProvider } from "../agent/index.js";
import { AgentTimeoutError } from "../agent/provider.js";
import {
  listScenarios,
  locateScenario,
  loadScenario,
  loadOracle,
} from "../core/scenario-runner.js";
import { buildScaffoldScenariosPrompt, SYSTEM_MESSAGE, type ScaffoldExample } from "../prompts/index.js";
import { join } from "../core/fsutil.js";

export interface ScaffoldOptions {
  count: number;
  producerModel?: string;
  timeoutMinutes?: number;
}

export interface ScaffoldResult {
  created: string[];
  validated: string[];
  invalid: { id: string; reason: string }[];
}

/** Discover up to 3 existing scenarios to use as templates for the agent. Prefers
 *  small fixtures so the prompt stays compact. */
function collectExamples(repoRoot: string): ScaffoldExample[] {
  const ids = listScenarios(repoRoot).filter((id) => id !== "agentrig-init-on-empty-repo");
  const out: ScaffoldExample[] = [];
  for (const id of ids.slice(0, 3)) {
    const paths = locateScenario(repoRoot, id);
    if (!paths) continue;
    out.push({
      id,
      scenarioYml: existsSync(paths.scenarioYml) ? readFileSync(paths.scenarioYml, "utf8") : "",
      promptMd: existsSync(paths.promptMd) ? readFileSync(paths.promptMd, "utf8") : "",
      oracleYml: existsSync(paths.oracleYml) ? readFileSync(paths.oracleYml, "utf8") : "",
    });
  }
  return out;
}

/** Pull the allowed axis names from the live axes.json registry so the prompt can constrain
 *  the agent to existing axes (otherwise the new scenario won't score). */
function collectAxesAvailable(repoRoot: string): { types: string[]; axisNames: string[] } {
  const axesPath = join(repoRoot, ".agentrig/eval/axes.json");
  if (!existsSync(axesPath)) return { types: [], axisNames: [] };
  const axes = JSON.parse(readFileSync(axesPath, "utf8"));
  const types = Object.keys(axes.types ?? {});
  const axisNames = new Set<string>();
  for (const t of Object.values<{ categories?: Record<string, Record<string, unknown>> }>(axes.types ?? {})) {
    for (const cat of Object.values(t.categories ?? {})) {
      for (const axis of Object.keys(cat)) axisNames.add(axis);
    }
  }
  return { types, axisNames: [...axisNames].sort() };
}

/** Validate one newly-generated scenario. Catches parse errors + obvious schema gaps
 *  (unknown axes, missing fixture dir) before the user runs `eval --dynamic`. */
function validateScaffoldedScenario(
  repoRoot: string,
  id: string,
  allowedAxes: Set<string>,
): { ok: true } | { ok: false; reason: string } {
  const paths = locateScenario(repoRoot, id);
  if (!paths) return { ok: false, reason: "scenario directory disappeared after agent run" };
  if (!existsSync(paths.fixtureDir)) return { ok: false, reason: "missing fixture/ directory" };
  let fm: ReturnType<typeof loadScenario>;
  try {
    fm = loadScenario(paths);
  } catch (e) {
    return { ok: false, reason: `scenario.yml parse error: ${(e as Error).message}` };
  }
  let oracle: ReturnType<typeof loadOracle>;
  try {
    oracle = loadOracle(paths);
  } catch (e) {
    return { ok: false, reason: `oracle.yml parse error: ${(e as Error).message}` };
  }
  // Every axis referenced (oracle_axes, judge_axes, oracle.checks[].axis) must exist in axes.json.
  const referenced = new Set<string>([
    ...(fm.oracle_axes ?? []),
    ...(fm.judge_axes ?? []),
    ...oracle.checks.map((c) => c.axis),
  ]);
  const unknown = [...referenced].filter((a) => a && !allowedAxes.has(a));
  if (unknown.length) return { ok: false, reason: `unknown axes: ${unknown.join(", ")}` };
  if (!existsSync(paths.promptMd)) return { ok: false, reason: "missing prompt.md" };
  return { ok: true };
}

export async function scaffoldScenarios(repoRoot: string, opts: ScaffoldOptions): Promise<ScaffoldResult> {
  const provider = getProvider();
  const pre = await provider.preflight();
  if (!pre.ok) throw new Error(`agent unavailable: ${pre.detail}`);
  log.ok(`agent ready (${pre.detail})`);

  if (opts.producerModel && provider.validateModel) {
    const v = await provider.validateModel(opts.producerModel);
    if (!v.ok) throw new Error(`model "${opts.producerModel}" not available. ${v.detail ?? ""}`);
  }

  const before = new Set(listScenarios(repoRoot));
  const examples = collectExamples(repoRoot);
  if (examples.length === 0) {
    throw new Error(
      "no existing scenarios found to use as templates. Run `agentrig init` first so the " +
      "generic scenarios are installed at .agentrig/eval/scenarios/.",
    );
  }
  const axesAvailable = collectAxesAvailable(repoRoot);
  if (axesAvailable.axisNames.length === 0) {
    throw new Error("no axes registered at .agentrig/eval/axes.json — run `agentrig init` first.");
  }
  const contextMdPath = join(repoRoot, ".agentrig/context.md");
  const contextMd = existsSync(contextMdPath) ? readFileSync(contextMdPath, "utf8") : "";
  if (!contextMd) {
    log.warn("no .agentrig/context.md found — the agent will investigate the repo itself,");
    log.warn("which adds time. Consider running `agentrig init` (without --skip-agent) first.");
  }

  log.step(`scaffolding ${opts.count} repo-specific scenario(s)…`);
  log.info(color.dim(`  Using ${examples.length} existing scenario(s) as templates: ${examples.map((e) => e.id).join(", ")}`));
  log.info(color.dim(`  Available axes (${axesAvailable.axisNames.length}): ${axesAvailable.axisNames.slice(0, 6).join(", ")}…`));

  const monitor = new ActivityMonitor().start();
  let convo: Awaited<ReturnType<typeof provider.startConversation>> | null = null;
  try {
    convo = await provider.startConversation({
      cwd: repoRoot,
      systemMessage: SYSTEM_MESSAGE,
      onEvent: monitor.handle,
      ...(opts.producerModel ? { model: opts.producerModel } : {}),
      ...(opts.timeoutMinutes ? { maxMs: opts.timeoutMinutes * 60 * 1000 } : {}),
    });
    await convo.send(buildScaffoldScenariosPrompt({
      count: opts.count,
      contextMd,
      examples,
      axesAvailable,
    }));
  } catch (err) {
    if (err instanceof AgentTimeoutError) log.warn(`agent stopped: ${err.message}`);
    else throw err;
  } finally {
    monitor.stop();
    if (convo) await convo.end().catch(() => undefined);
  }

  const after = listScenarios(repoRoot);
  const created = after.filter((id) => !before.has(id));
  const allowed = new Set(axesAvailable.axisNames);
  const validated: string[] = [];
  const invalid: { id: string; reason: string }[] = [];
  for (const id of created) {
    const v = validateScaffoldedScenario(repoRoot, id, allowed);
    if (v.ok) {
      validated.push(id);
      log.ok(`  ${id} — validated`);
    } else {
      invalid.push({ id, reason: v.reason });
      log.error(`  ${id} — INVALID: ${v.reason}`);
    }
  }

  log.info("");
  if (created.length === 0) {
    log.warn("agent produced 0 new scenarios. Re-run with --verbose to see what it did.");
  } else {
    log.ok(`created ${created.length} scenario(s); ${validated.length} valid, ${invalid.length} invalid`);
    if (invalid.length) {
      log.warn("invalid scenarios were NOT deleted; inspect them under .agentrig/eval/scenarios/<id>/");
      log.warn("then either fix them by hand or remove the directory and re-run --scaffold.");
    }
    log.info(color.dim("  Run a new scenario with: agentrig eval --dynamic --scenario <id>"));
  }
  return { created, validated, invalid };
}
