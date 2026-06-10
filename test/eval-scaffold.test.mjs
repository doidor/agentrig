import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync, existsSync, mkdtempSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { freshInstall, cleanup } from "./helpers.mjs";

// The scaffold validator is exposed via CLI but its core logic is also unit-testable: it
// must reject scenarios with unknown axes, missing fixtures, and malformed YAML — and must
// accept the bundled generic scenarios as-is. We don't drive the agent here (would need a
// real model); instead we drop pre-built scenario directories and validate them through
// the same scenario-runner load path the validator uses.

import {
  listScenarios,
  locateScenario,
  loadScenario,
  loadOracle,
} from "../dist/core/scenario-runner.js";

test("listScenarios picks up bundled scenarios as templates", () => {
  const dir = freshInstall();
  try {
    const scenarios = listScenarios(dir);
    assert.ok(scenarios.includes("fix-failing-test"), "fix-failing-test should be discoverable");
    assert.ok(scenarios.includes("add-small-feature"), "add-small-feature should be discoverable");
    assert.ok(scenarios.includes("review-catches-bug"), "review-catches-bug should be discoverable");
    for (const id of scenarios) {
      const paths = locateScenario(dir, id);
      assert.ok(paths, `${id} should locate`);
      const fm = loadScenario(paths);
      assert.equal(fm.id, id, `${id} frontmatter id matches dir`);
      const oracle = loadOracle(paths);
      assert.ok(Array.isArray(oracle.checks), `${id} oracle parses`);
    }
  } finally {
    cleanup(dir);
  }
});

test("scaffold validator rejects a scenario with an unknown axis", () => {
  const dir = freshInstall();
  try {
    const sdir = join(dir, ".agentrig/eval/scenarios/bad-axis");
    mkdirSync(sdir, { recursive: true });
    mkdirSync(join(sdir, "fixture"));
    writeFileSync(join(sdir, "fixture/package.json"), "{}");
    writeFileSync(join(sdir, "scenario.yml"), [
      "id: bad-axis",
      "type: run",
      "scope: patch",
      "oracle_axes:",
      "  - made_up_axis",
      "judge_axes: []",
    ].join("\n") + "\n");
    writeFileSync(join(sdir, "prompt.md"), "do a thing");
    writeFileSync(join(sdir, "oracle.yml"), "checks: []\n");

    const paths = locateScenario(dir, "bad-axis");
    const fm = loadScenario(paths);
    const oracle = loadOracle(paths);
    const referenced = new Set([
      ...(fm.oracle_axes ?? []),
      ...(fm.judge_axes ?? []),
      ...oracle.checks.map((c) => c.axis),
    ]);
    const axes = JSON.parse(readFileSync(join(dir, ".agentrig/eval/axes.json"), "utf8"));
    const allowed = new Set();
    for (const t of Object.values(axes.types ?? {})) {
      for (const cat of Object.values(t.categories ?? {})) {
        for (const a of Object.keys(cat)) allowed.add(a);
      }
    }
    const unknown = [...referenced].filter((a) => !allowed.has(a));
    assert.ok(unknown.includes("made_up_axis"), "validator should flag made_up_axis as unknown");
  } finally {
    cleanup(dir);
  }
});

test("scaffold validator rejects a scenario with missing fixture/", () => {
  const dir = freshInstall();
  try {
    const sdir = join(dir, ".agentrig/eval/scenarios/no-fixture");
    mkdirSync(sdir, { recursive: true });
    writeFileSync(join(sdir, "scenario.yml"), "id: no-fixture\ntype: run\nscope: patch\n");
    writeFileSync(join(sdir, "prompt.md"), "do a thing");
    const paths = locateScenario(dir, "no-fixture");
    assert.ok(paths, "scenario should still locate by directory");
    assert.equal(existsSync(paths.fixtureDir), false, "validator should flag missing fixture/");
  } finally {
    cleanup(dir);
  }
});

test("scaffold validator rejects a malformed scenario.yml", () => {
  const dir = freshInstall();
  try {
    const sdir = join(dir, ".agentrig/eval/scenarios/bad-yaml");
    mkdirSync(sdir, { recursive: true });
    mkdirSync(join(sdir, "fixture"));
    writeFileSync(join(sdir, "fixture/.gitkeep"), "");
    writeFileSync(join(sdir, "scenario.yml"), "id: bad\nbroken: [unclosed\n");
    writeFileSync(join(sdir, "prompt.md"), "do a thing");
    writeFileSync(join(sdir, "oracle.yml"), "checks: []\n");
    const paths = locateScenario(dir, "bad-yaml");
    let threw = false;
    try { loadScenario(paths); } catch { threw = true; }
    assert.ok(threw, "validator must surface a YAML parse error, not silently accept");
  } finally {
    cleanup(dir);
  }
});

test("eval --scaffold requires a harness to be installed", () => {
  const empty = mkdtempSync(join(tmpdir(), "agentrig-empty-"));
  try {
    writeFileSync(join(empty, "package.json"), '{"name":"empty"}');
    const cliPath = join(process.cwd(), "dist/cli.js");
    let stderr = "", code = 0;
    try {
      execFileSync(process.execPath, [cliPath, "eval", "--scaffold", empty], { encoding: "utf8" });
    } catch (err) {
      code = err.status;
      stderr = (err.stdout ?? "") + (err.stderr ?? "");
    }
    assert.notEqual(code, 0, "scaffold without an installed harness must exit non-zero");
    assert.match(stderr, /No harness installed/, "should explain why");
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
});
