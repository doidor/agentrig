import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { freshInstall, cleanup, runCli } from "./helpers.mjs";
import { validateSetupSteps } from "../dist/core/setupsteps.js";

test("validateSetupSteps passes the generated workflow", () => {
  const dir = freshInstall();
  try {
    const v = validateSetupSteps(dir);
    assert.equal(v.present, true);
    assert.equal(v.ok, true, JSON.stringify(v.errors));
  } finally {
    cleanup(dir);
  }
});

test("validateSetupSteps flags a wrong job name and an over-limit timeout", () => {
  const dir = freshInstall();
  try {
    const p = join(dir, ".github/workflows/copilot-setup-steps.yml");
    const broken = readFileSync(p, "utf8")
      .replace("copilot-setup-steps:", "setup:")
      .replace("contents: read", "contents: read\n    timeout-minutes: 90");
    writeFileSync(p, broken);
    const v = validateSetupSteps(dir);
    assert.equal(v.ok, false);
    assert.ok(v.errors.some((e) => /named exactly/i.test(e)));
    assert.ok(v.errors.some((e) => /max is 59/.test(e)));
  } finally {
    cleanup(dir);
  }
});

test("validateSetupSteps rejects tabs", () => {
  const dir = freshInstall();
  try {
    const p = join(dir, ".github/workflows/copilot-setup-steps.yml");
    writeFileSync(p, readFileSync(p, "utf8") + "\n\tbad: tab\n");
    const v = validateSetupSteps(dir);
    assert.ok(v.errors.some((e) => /tab/.test(e)));
  } finally {
    cleanup(dir);
  }
});

test("eval --rubric prints the rubric types and scenarios", () => {
  const dir = freshInstall();
  try {
    // freshInstall does not write state.json, so install via CLI for the isInstalled gate.
    runCli(["init", "--skip-agent", dir]);
    const r = runCli(["eval", "--rubric", "--json", dir]);
    assert.equal(r.status, 0, r.stderr);
    const j = JSON.parse(r.stdout);
    assert.ok(j.types.run, "should expose the run rubric");
    assert.ok(j.types.run.categories.output_quality.correctness, "should list axis issue codes");
    assert.ok(Array.isArray(j.scenarios) && j.scenarios.length >= 2);
  } finally {
    cleanup(dir);
  }
});
