import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  locateScenario,
  listScenarios,
  loadScenario,
  loadOracle,
  seedWorktree,
  runOracle,
  oracleAxisScores,
  oracleAxesToFlags,
  parseDiffStats,
  captureDiff,
} from "../dist/core/scenario-runner.js";

const repoRoot = process.cwd();

test("listScenarios discovers the bundled scenario dirs", () => {
  const scenarios = listScenarios(repoRoot);
  assert.ok(scenarios.includes("fix-failing-test"));
  assert.ok(scenarios.includes("add-small-feature"));
  assert.ok(scenarios.includes("review-catches-bug"));
  assert.ok(scenarios.includes("agentrig-init-on-empty-repo"));
  // Underscore-prefixed entries (e.g. _legacy/) must NOT appear.
  assert.ok(!scenarios.some((s) => s.startsWith("_")));
});

test("loadScenario strips the --- frontmatter wrapper", () => {
  const paths = locateScenario(repoRoot, "fix-failing-test");
  assert.ok(paths);
  const fm = loadScenario(paths);
  assert.equal(fm.id, "fix-failing-test");
  assert.equal(fm.type, "run");
  assert.ok(Array.isArray(fm.oracle_axes));
});

test("loadOracle returns an empty checks array when oracle.yml is missing", () => {
  const noOracleDir = mkdtempSync(join(tmpdir(), "agentrig-runner-test-"));
  try {
    mkdirSync(join(noOracleDir, "fixture"), { recursive: true });
    writeFileSync(join(noOracleDir, "scenario.yml"), "id: tmp\ntype: run\nscope: patch\n");
    const paths = {
      root: noOracleDir,
      scenarioYml: join(noOracleDir, "scenario.yml"),
      promptMd: join(noOracleDir, "prompt.md"),
      oracleYml: join(noOracleDir, "oracle.yml"),
      fixtureDir: join(noOracleDir, "fixture"),
      readmeMd: join(noOracleDir, "README.md"),
      judgeBriefMd: null,
    };
    const oracle = loadOracle(paths);
    assert.deepEqual(oracle.checks, []);
  } finally {
    rmSync(noOracleDir, { recursive: true, force: true });
  }
});

test("seedWorktree single-dir layout produces one commit", () => {
  const paths = locateScenario(repoRoot, "fix-failing-test");
  const wt = seedWorktree(paths.fixtureDir, "test-runner", "fix-failing-test-single");
  try {
    // Worktree must contain the fixture files at the top level.
    assert.ok(readFileSync(join(wt, "package.json"), "utf8").includes("fix-failing-test"));
    assert.ok(readFileSync(join(wt, "src/math.js"), "utf8").includes("divide"));
  } finally {
    rmSync(wt, { recursive: true, force: true });
  }
});

test("seedWorktree baseline+change layout produces two commits + the diff", () => {
  const paths = locateScenario(repoRoot, "review-catches-bug");
  const wt = seedWorktree(paths.fixtureDir, "test-runner", "review-catches-bug-test");
  try {
    // Worktree must reflect the post-change state (the planted bug).
    const pag = readFileSync(join(wt, "src/pagination.js"), "utf8");
    assert.ok(pag.includes("pageSize * page + 1"), "post-change content must be present");
    // captureDiff against HEAD with no further edits is empty.
    const diff = captureDiff(wt);
    assert.equal(diff, "");
  } finally {
    rmSync(wt, { recursive: true, force: true });
  }
});

test("parseDiffStats counts adds/removes per file", () => {
  const diff = `diff --git a/a.txt b/a.txt
--- a/a.txt
+++ b/a.txt
@@ -1,2 +1,3 @@
 line1
+added1
+added2
-removed1
diff --git a/b.txt b/b.txt
--- a/b.txt
+++ b/b.txt
@@ -0,0 +1,1 @@
+only-add
`;
  const stats = parseDiffStats(diff);
  const a = stats.find((s) => s.path === "a.txt");
  const b = stats.find((s) => s.path === "b.txt");
  assert.equal(a.added, 2);
  assert.equal(a.removed, 1);
  assert.equal(b.added, 1);
  assert.equal(b.removed, 0);
});

test("oracle: cmd exit_zero check passes/fails correctly", () => {
  const paths = locateScenario(repoRoot, "fix-failing-test");
  const wt = seedWorktree(paths.fixtureDir, "test-runner", "cmd-check");
  try {
    const oracle = {
      checks: [
        { id: "true", type: "cmd", cmd: "true", expect: "exit_zero", axis: "correctness" },
        { id: "false", type: "cmd", cmd: "false", expect: "exit_zero", axis: "correctness" },
      ],
    };
    const r = runOracle(wt, oracle);
    assert.equal(r.find((x) => x.id === "true").score, 1);
    assert.equal(r.find((x) => x.id === "false").score, 0);
  } finally {
    rmSync(wt, { recursive: true, force: true });
  }
});

test("oracle on UNTOUCHED fix-failing-test worktree fails correctness", () => {
  const paths = locateScenario(repoRoot, "fix-failing-test");
  const oracle = loadOracle(paths);
  const wt = seedWorktree(paths.fixtureDir, "test-runner", "untouched");
  try {
    const results = runOracle(wt, oracle);
    const correctness = results.find((r) => r.id === "tests-green");
    assert.equal(correctness.score, 0, "broken fixture must fail tests-green");
    // diff-bounded passes because no edits yet.
    assert.equal(results.find((r) => r.id === "diff-bounded").score, 1);
  } finally {
    rmSync(wt, { recursive: true, force: true });
  }
});

test("oracle on hand-applied correct fix passes all axes", () => {
  const paths = locateScenario(repoRoot, "fix-failing-test");
  const oracle = loadOracle(paths);
  const wt = seedWorktree(paths.fixtureDir, "test-runner", "fixed");
  try {
    const mathFile = join(wt, "src/math.js");
    writeFileSync(
      mathFile,
      readFileSync(mathFile, "utf8").replace(
        "return a / b;",
        'if (b === 0) throw new Error("divide by zero"); return a / b;',
      ),
    );
    const results = runOracle(wt, oracle);
    for (const r of results) {
      assert.equal(r.score, 1, `expected ${r.id} to pass on a correct fix: ${r.evidence}`);
    }
    const axes = oracleAxisScores(results);
    assert.equal(axes.find((a) => a.axis === "correctness").score, 1);
  } finally {
    rmSync(wt, { recursive: true, force: true });
  }
});

test("oracleAxisScores collapses multi-check axes with min()", () => {
  const results = [
    { id: "a1", axis: "correctness", score: 1, evidence: "" },
    { id: "a2", axis: "correctness", score: 0, evidence: "bug" },
    { id: "b1", axis: "scope", score: 0.5, evidence: "churn" },
  ];
  const axes = oracleAxisScores(results);
  const correctness = axes.find((a) => a.axis === "correctness");
  assert.equal(correctness.score, 0, "min of {1, 0} = 0");
  assert.match(correctness.evidence, /a2/);
  assert.equal(axes.find((a) => a.axis === "scope").score, 0.5);
});

test("oracleAxesToFlags emits 1.0 for PASS and code:evidence for FAIL", () => {
  const flags = oracleAxesToFlags(
    [
      { axis: "correctness", score: 1, evidence: "" },
      { axis: "scope", score: 0.5, evidence: "diff too big" },
    ],
    "run",
  );
  assert.deepEqual(flags, ["correctness=1.0", "scope=0.5:OQ-SCOPE-UNRELATED:diff too big"]);
});

test("dogfood scenario: end-to-end (no producer, oracle does everything)", () => {
  const paths = locateScenario(repoRoot, "agentrig-init-on-empty-repo");
  const oracle = loadOracle(paths);
  const wt = seedWorktree(paths.fixtureDir, "test-runner", "dogfood");
  try {
    const env = { AGENTRIG_CLI: join(repoRoot, "dist/cli.js") };
    const results = runOracle(wt, oracle, env);
    for (const r of results) {
      assert.equal(r.score, 1, `dogfood oracle "${r.id}" failed: ${r.evidence}`);
    }
  } finally {
    rmSync(wt, { recursive: true, force: true });
  }
});

test("dogfood scenario fails when AGENTRIG_CLI is broken", () => {
  const paths = locateScenario(repoRoot, "agentrig-init-on-empty-repo");
  const oracle = loadOracle(paths);
  const wt = seedWorktree(paths.fixtureDir, "test-runner", "dogfood-broken");
  try {
    const env = { AGENTRIG_CLI: "/does/not/exist.js" };
    const results = runOracle(wt, oracle, env);
    const init = results.find((r) => r.id === "agentrig-init-succeeds");
    assert.equal(init.score, 0, "must FAIL when the CLI path is bogus");
  } finally {
    rmSync(wt, { recursive: true, force: true });
  }
});
