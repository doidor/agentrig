import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { makeRepo, cleanup, runCli, freshInstall } from "./helpers.mjs";
import { readStateLabels, readLimits, isGitRepo } from "../dist/core/harness.js";

test("readStateLabels + readLimits parse the installed state machine", () => {
  const dir = freshInstall();
  try {
    const labels = readStateLabels(dir);
    assert.equal(labels.queued, "agentrig-ready");
    assert.equal(labels.implementing, "agentrig-started");

    const limits = readLimits(dir);
    assert.equal(limits.max_concurrent_agents, 4);
    assert.equal(limits.max_diff_chars, 50000);
  } finally {
    cleanup(dir);
  }
});

test("run requires an installed harness", () => {
  const dir = makeRepo();
  try {
    const r = runCli(["run", dir]);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr + r.stdout, /Run `agentrig init`/);
  } finally {
    cleanup(dir);
  }
});

test("run --dry-run reports the resolved ready label without calling a model", () => {
  const dir = makeRepo();
  try {
    runCli(["init", "--skip-agent", dir]); // writes state.json so the harness is "installed"
    execFileSync("git", ["init", "-q", dir]); // engine requires a git repo
    const r = runCli(["run", "--dry-run", dir]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /ready label: agentrig-ready/);
  } finally {
    cleanup(dir);
  }
});

test("isGitRepo detects a git repo", () => {
  const dir = freshInstall(); // makeRepo does not git-init
  try {
    assert.equal(isGitRepo(dir), false);
  } finally {
    cleanup(dir);
  }
});
