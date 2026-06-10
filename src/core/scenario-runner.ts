import { existsSync, readFileSync, mkdirSync, writeFileSync, statSync, readdirSync, cpSync, rmSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import YAML from "yaml";
import { sameFamily } from "./model-family.js";

/**
 * Fixture-based scenario runner.
 *
 * Each scenario is a directory under `.agentrig/eval/scenarios/<id>/` containing:
 *   - `scenario.yml`       — frontmatter (id, type, scope, judge_axes, oracle_axes, ...)
 *   - `prompt.md`          — the exact task handed to the producer agent
 *   - `fixture/`           — mini-repo seeded into the throwaway worktree
 *   - `oracle.yml`         — deterministic checks (cmd / diff_stats / diff_files)
 *   - `judge_brief.md`     — post-scoring reveal for calibration (optional)
 *   - `README.md`          — human description
 *
 * The runner ONLY does the deterministic part: it seeds the fixture, invokes
 * the producer hook, captures the diff, and applies oracle checks. The
 * "judge stage" (LLM-driven scoring for soft axes) is wired in by the eval
 * command (P3) — this module exposes the data it needs.
 */

export interface ScenarioFrontmatter {
  id: string;
  type: "run" | "spec" | "review";
  scope: string;
  principle_focus?: number[];
  oracle_axes?: string[];   // axes scored by the deterministic oracle
  judge_axes?: string[];    // axes scored by the LLM judge (P3)
  base_commit?: string;
  description?: string;
  /** Marks scenarios that ship with `agentrig init` as language-agnostic templates rather than
   *  repo-specific tests. The dynamic eval excludes them by default — the user wants signal about
   *  THEIR repo, not about generic JS micro-fixtures. Use `eval --dynamic --include-bundled` to
   *  opt in (e.g. when smoke-testing the harness itself). Hand-written or scaffolded scenarios
   *  omit this field. */
  bundled?: boolean;
}

export interface OracleCheck {
  id: string;
  type: "cmd" | "diff_stats" | "diff_files" | "file_contains" | "file_missing";
  axis: string;
  // type: cmd
  cmd?: string;
  expect?: "exit_zero" | "exit_nonzero";
  // type: diff_stats
  max_added_lines?: number;
  max_removed_lines?: number;
  max_files?: number;
  // type: diff_files
  allowed?: string[];
  forbidden?: string[];
  // type: file_contains / file_missing
  path?: string;
  pattern?: string;
}

export interface OracleSpec {
  checks: OracleCheck[];
}

export interface OracleResult {
  id: string;
  axis: string;
  score: 0 | 0.5 | 1;
  evidence: string;
}

export interface ScenarioPaths {
  root: string;          // .agentrig/eval/scenarios/<id>/
  scenarioYml: string;
  promptMd: string;
  oracleYml: string;
  fixtureDir: string;
  readmeMd: string;
  judgeBriefMd: string | null;
}

export function locateScenario(repoRoot: string, id: string): ScenarioPaths | null {
  const root = resolve(repoRoot, ".agentrig", "eval", "scenarios", id);
  if (!existsSync(root) || !statSync(root).isDirectory()) return null;
  return {
    root,
    scenarioYml: join(root, "scenario.yml"),
    promptMd: join(root, "prompt.md"),
    oracleYml: join(root, "oracle.yml"),
    fixtureDir: join(root, "fixture"),
    readmeMd: join(root, "README.md"),
    judgeBriefMd: existsSync(join(root, "judge_brief.md")) ? join(root, "judge_brief.md") : null,
  };
}

export function listScenarios(repoRoot: string): string[] {
  const dir = resolve(repoRoot, ".agentrig", "eval", "scenarios");
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".") || entry.startsWith("_")) continue;
    const abs = join(dir, entry);
    if (!statSync(abs).isDirectory()) continue;
    if (existsSync(join(abs, "scenario.yml"))) out.push(entry);
  }
  return out.sort();
}

export function loadScenario(paths: ScenarioPaths): ScenarioFrontmatter {
  if (!existsSync(paths.scenarioYml)) {
    throw new Error(`scenario.yml missing in ${paths.root}`);
  }
  // Accept both plain YAML and "--- ... ---" frontmatter-style wrappers (for consistency
  // with skill files). Strip the wrapper before parsing so we get a single document.
  let text = readFileSync(paths.scenarioYml, "utf8").trim();
  if (text.startsWith("---")) {
    const end = text.indexOf("\n---", 3);
    if (end > 0) text = text.slice(4, end).trim();
  }
  const fm = YAML.parse(text);
  if (!fm?.id) throw new Error(`scenario.yml in ${paths.root} missing required 'id'`);
  return fm as ScenarioFrontmatter;
}

export function loadOracle(paths: ScenarioPaths): OracleSpec {
  if (!existsSync(paths.oracleYml)) return { checks: [] };
  const spec = YAML.parse(readFileSync(paths.oracleYml, "utf8")) as OracleSpec;
  return { checks: Array.isArray(spec?.checks) ? spec.checks : [] };
}

/** Seed a throwaway worktree from a scenario fixture and `git init` it so we can take diffs.
 *
 * Layouts supported:
 *   1. `fixture/` directly — single baseline commit.
 *   2. `fixture/baseline/` (+ optional `fixture/change/`) — for review scenarios:
 *      commit baseline first, then overlay change as a second commit so the producer
 *      reviewer sees a real `HEAD vs HEAD~1` diff.
 */
export function seedWorktree(fixtureDir: string, runId: string, scenarioId: string): string {
  if (!existsSync(fixtureDir)) throw new Error(`fixture missing: ${fixtureDir}`);
  const wt = join(tmpdir(), "agentrig-eval", runId, scenarioId);
  if (existsSync(wt)) rmSync(wt, { recursive: true, force: true });
  mkdirSync(wt, { recursive: true });

  const baselineDir = join(fixtureDir, "baseline");
  const changeDir = join(fixtureDir, "change");
  const hasBaselineLayout = existsSync(baselineDir) && statSync(baselineDir).isDirectory();

  if (hasBaselineLayout) {
    cpSync(baselineDir, wt, { recursive: true });
  } else {
    cpSync(fixtureDir, wt, { recursive: true });
  }

  // Make it a git repo so we can diff the agent's work against the fixture baseline.
  spawnSync("git", ["init", "-q"], { cwd: wt });
  spawnSync("git", ["config", "user.email", "eval@agentrig.local"], { cwd: wt });
  spawnSync("git", ["config", "user.name", "AgentRig Eval"], { cwd: wt });
  spawnSync("git", ["add", "-A"], { cwd: wt });
  spawnSync("git", ["commit", "-q", "-m", "fixture baseline"], { cwd: wt });

  // For the two-commit layout, overlay `change/` and commit again.
  if (hasBaselineLayout && existsSync(changeDir) && statSync(changeDir).isDirectory()) {
    cpSync(changeDir, wt, { recursive: true, force: true });
    spawnSync("git", ["add", "-A"], { cwd: wt });
    spawnSync("git", ["commit", "-q", "-m", "fixture change (under review)"], { cwd: wt });
  }

  return wt;
}

/** Capture the unified diff (vs baseline) the producer left in the worktree. */
export function captureDiff(worktree: string): string {
  // git diff HEAD picks up tracked + staged changes; we also need to include untracked files.
  spawnSync("git", ["add", "-A"], { cwd: worktree });
  const res = spawnSync("git", ["diff", "--cached"], { cwd: worktree, encoding: "utf8" });
  return res.stdout || "";
}

/** Parse a unified diff into per-file stats. Small enough to roll by hand; avoids a parser dep. */
export interface DiffFileStat {
  path: string;
  added: number;
  removed: number;
}
export function parseDiffStats(diff: string): DiffFileStat[] {
  const files = new Map<string, DiffFileStat>();
  let cur: DiffFileStat | null = null;
  for (const line of diff.split(/\r?\n/)) {
    const fileHeader = line.match(/^\+\+\+ b\/(.+)$/);
    if (fileHeader) {
      const path = fileHeader[1]!;
      cur = files.get(path) ?? { path, added: 0, removed: 0 };
      files.set(path, cur);
      continue;
    }
    if (!cur) continue;
    if (line.startsWith("+") && !line.startsWith("+++")) cur.added++;
    else if (line.startsWith("-") && !line.startsWith("---")) cur.removed++;
  }
  return [...files.values()];
}

/** Run the deterministic oracle. Returns one result per check.
 *  `env` is merged into the child process environment for `cmd`-type checks —
 *  the scenario-runner uses this to inject `AGENTRIG_CLI` for the dogfood scenario.
 */
export function runOracle(worktree: string, oracle: OracleSpec, env: Record<string, string> = {}): OracleResult[] {
  const diff = captureDiff(worktree);
  const stats = parseDiffStats(diff);
  const out: OracleResult[] = [];
  for (const c of oracle.checks) {
    out.push(runOracleCheck(worktree, c, diff, stats, env));
  }
  return out;
}

function runOracleCheck(worktree: string, c: OracleCheck, diff: string, stats: DiffFileStat[], env: Record<string, string>): OracleResult {
  switch (c.type) {
    case "cmd": {
      if (!c.cmd) return { id: c.id, axis: c.axis, score: 0, evidence: "cmd: missing" };
      // Scrub NODE_TEST_CONTEXT: when the runner is itself executed inside `node --test`
      // (which the unit tests do), nested `node --test` invocations from oracle cmd
      // checks see that env var and behave as silent subprocesses. Delete it so the
      // oracle's nested tests run as a fresh, independent test process.
      const childEnv: NodeJS.ProcessEnv = { ...process.env, ...env };
      delete childEnv.NODE_TEST_CONTEXT;
      const res = spawnSync(c.cmd, {
        cwd: worktree,
        shell: true,
        encoding: "utf8",
        timeout: 120_000,
        env: childEnv,
      });
      const wantZero = c.expect !== "exit_nonzero";
      const ok = wantZero ? res.status === 0 : res.status !== 0;
      const tail = (res.stdout + res.stderr).split(/\r?\n/).filter(Boolean).slice(-3).join(" | ");
      return ok
        ? { id: c.id, axis: c.axis, score: 1, evidence: "" }
        : { id: c.id, axis: c.axis, score: 0, evidence: `exit=${res.status}${tail ? `: ${tail}` : ""}` };
    }
    case "diff_stats": {
      const totalAdded = stats.reduce((s, x) => s + x.added, 0);
      const totalRemoved = stats.reduce((s, x) => s + x.removed, 0);
      const problems: string[] = [];
      if (c.max_added_lines != null && totalAdded > c.max_added_lines) problems.push(`added ${totalAdded} > ${c.max_added_lines}`);
      if (c.max_removed_lines != null && totalRemoved > c.max_removed_lines) problems.push(`removed ${totalRemoved} > ${c.max_removed_lines}`);
      if (c.max_files != null && stats.length > c.max_files) problems.push(`touched ${stats.length} files > ${c.max_files}`);
      return problems.length === 0
        ? { id: c.id, axis: c.axis, score: 1, evidence: "" }
        : { id: c.id, axis: c.axis, score: 0.5, evidence: problems.join("; ") };
    }
    case "diff_files": {
      const touched = stats.map((s) => s.path);
      const problems: string[] = [];
      if (c.allowed) {
        const extras = touched.filter((p) => !c.allowed!.some((a) => matchGlob(p, a)));
        if (extras.length) problems.push(`unexpected files: ${extras.join(", ")}`);
      }
      if (c.forbidden) {
        const hits = touched.filter((p) => c.forbidden!.some((a) => matchGlob(p, a)));
        if (hits.length) problems.push(`touched forbidden: ${hits.join(", ")}`);
      }
      return problems.length === 0
        ? { id: c.id, axis: c.axis, score: 1, evidence: "" }
        : { id: c.id, axis: c.axis, score: 0, evidence: problems.join("; ") };
    }
    case "file_contains": {
      if (!c.path || !c.pattern) return { id: c.id, axis: c.axis, score: 0, evidence: "missing path/pattern" };
      const abs = join(worktree, c.path);
      if (!existsSync(abs)) return { id: c.id, axis: c.axis, score: 0, evidence: `missing ${c.path}` };
      const text = readFileSync(abs, "utf8");
      return new RegExp(c.pattern).test(text)
        ? { id: c.id, axis: c.axis, score: 1, evidence: "" }
        : { id: c.id, axis: c.axis, score: 0, evidence: `pattern not found in ${c.path}` };
    }
    case "file_missing": {
      if (!c.path) return { id: c.id, axis: c.axis, score: 0, evidence: "missing path" };
      return existsSync(join(worktree, c.path))
        ? { id: c.id, axis: c.axis, score: 0, evidence: `${c.path} still present` }
        : { id: c.id, axis: c.axis, score: 1, evidence: "" };
    }
    default:
      return { id: c.id, axis: c.axis, score: 0, evidence: `unknown oracle check type "${(c as { type: string }).type}"` };
  }
}

/** Trivial glob: supports `*` (single segment) and `**` (any segments). No regex pass-through. */
function matchGlob(path: string, pattern: string): boolean {
  if (pattern === path) return true;
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "::DOUBLE::")
    .replace(/\*/g, "[^/]*")
    .replace(/::DOUBLE::/g, ".*");
  return new RegExp("^" + escaped + "$").test(path);
}

/** Aggregate oracle results into per-axis scores (when an axis has multiple checks, min wins). */
export function oracleAxisScores(results: OracleResult[]): { axis: string; score: number; evidence: string }[] {
  const byAxis = new Map<string, OracleResult[]>();
  for (const r of results) {
    if (!byAxis.has(r.axis)) byAxis.set(r.axis, []);
    byAxis.get(r.axis)!.push(r);
  }
  const out: { axis: string; score: number; evidence: string }[] = [];
  for (const [axis, rs] of byAxis) {
    const score = Math.min(...rs.map((r) => r.score));
    const evidence = rs.filter((r) => r.score < 1).map((r) => `${r.id}: ${r.evidence}`).join("; ");
    out.push({ axis, score, evidence });
  }
  return out;
}

/** Convert oracle output into the --axis flag form score.mjs save expects. */
export function oracleAxesToFlags(scores: { axis: string; score: number; evidence: string }[], type: "run" | "spec" | "review"): string[] {
  const codeMap: Record<string, Record<string, string>> = {
    run: {
      correctness: "OQ-CORRECT-WRONG",
      scope: "OQ-SCOPE-UNRELATED",
      tests: "OQ-TESTS-BROKEN",
      clarity: "OQ-CLARITY-COMPLEXITY",
      self_verification: "AB-VERIFY-SKIPPED",
      gate_compliance: "AB-GATE-SKIPPED",
      tool_discipline: "AB-TOOLS-OVERLIMIT",
      escalation: "AB-ESCALATE-NONE",
      memory: "LT-MEMORY-NOLOG",
      regression_risk: "LT-REGRESS-UNTESTED",
      maintainability: "LT-MAINTAIN-DEBT",
    },
    spec: {
      clarity: "SP-CLARITY-VAGUE",
      acceptance_criteria: "SP-AC-MISSING",
      scope_bounded: "SP-SCOPE-TOOBIG",
      testability: "SP-TEST-NOORACLE",
      context: "SP-CONTEXT-MISSING",
    },
    review: {
      finding_correctness: "RV-FIND-WRONG",
      severity_calibration: "RV-SEV-UNDER",
      false_positive_rate: "RV-FP-NOISE",
      coverage: "RV-COV-MISSEDBUG",
      actionability: "RV-ACT-VAGUE",
      independence: "RV-IND-SAMEMODEL",
      blocking_decision: "RV-BLOCK-WRONGFAIL",
    },
  };
  const codes = codeMap[type] ?? {};
  return scores.map((s) => {
    if (s.score === 1) return `${s.axis}=1.0`;
    const code = codes[s.axis] ?? "";
    const ev = s.evidence.replace(/:/g, ";").slice(0, 200) || "oracle check failed";
    return `${s.axis}=${s.score}:${code}:${ev}`;
  });
}

/** Re-export for the eval command to enforce producer ≠ judge family at run time. */
export { sameFamily };

/** Convenience: pretty-print a relative path (for log lines that mention worktree files). */
export function relPath(repoRoot: string, abs: string): string {
  return relative(repoRoot, abs) || abs;
}

/** Persist a per-scenario artifact bundle next to a run's meta.json. */
export function saveArtifacts(artifactsDir: string, scenarioId: string, kv: Record<string, string>): void {
  mkdirSync(artifactsDir, { recursive: true });
  for (const [name, content] of Object.entries(kv)) {
    writeFileSync(join(artifactsDir, `${scenarioId}.${name}`), content);
  }
}
