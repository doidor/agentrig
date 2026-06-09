import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { makeRepo, cleanup, runNode, freshInstall } from "./helpers.mjs";
import { loadManifest } from "../dist/core/knowledge.js";
import { install, baseVars } from "../dist/core/install.js";

const score = (dir) => join(dir, ".agentrig/eval/score.mjs");

test("score.mjs accepts a valid run and computes a confidence-gated weighted aggregate", () => {
  const dir = freshInstall();
  try {
    const r = runNode(score(dir), [
      "save", "--type", "run", "--scenario", "s1", "--judge", "m",
      "--axis", "correctness=1.0",   // weight 2 (configured as veto)
      "--axis", "scope=0.5:OQ-SCOPE-CHURN:left churn",  // weight 1
      "--axis", "tests=na",          // unobserved -> excluded
    ], dir);
    assert.equal(r.status, 0, r.stderr);
    // weighted: (2*1.0 + 1*0.5) / (2 + 1) = 2.5/3 ≈ 0.8333
    assert.match(r.stdout, /aggregate=0\.83/);
    assert.match(r.stdout, /2\/3 axes observed/); // na excluded
  } finally {
    cleanup(dir);
  }
});

test("score.mjs rejects an invalid issue code", () => {
  const dir = freshInstall();
  try {
    const r = runNode(score(dir), [
      "save", "--type", "run", "--scenario", "s", "--judge", "m",
      "--axis", "scope=0.5:NOT-A-CODE:ev",
    ], dir);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /not valid for axis/);
  } finally {
    cleanup(dir);
  }
});

test("score.mjs rejects a sub-1.0 score without evidence and an off-tier score", () => {
  const dir = freshInstall();
  try {
    const noEvidence = runNode(score(dir), [
      "save", "--type", "run", "--scenario", "s", "--judge", "m",
      "--axis", "scope=0.5:OQ-SCOPE-CHURN",
    ], dir);
    assert.notEqual(noEvidence.status, 0);
    assert.match(noEvidence.stderr, /no evidence/);

    const offTier = runNode(score(dir), [
      "save", "--type", "run", "--scenario", "s", "--judge", "m",
      "--axis", "correctness=0.7",
    ], dir);
    assert.notEqual(offTier.status, 0);
    assert.match(offTier.stderr, /must be one of/);
  } finally {
    cleanup(dir);
  }
});

test("score.mjs report --json uses the results shape and compare groups variants", () => {
  const dir = freshInstall();
  try {
    runNode(score(dir), ["save", "--type", "run", "--scenario", "s", "--variant", "a", "--judge", "m", "--axis", "correctness=1.0"], dir);
    runNode(score(dir), ["save", "--type", "run", "--scenario", "s", "--variant", "b", "--judge", "m", "--axis", "correctness=0.5:OQ-CORRECT-PARTIAL:x"], dir);
    const rep = runNode(score(dir), ["report", "--json"], dir);
    const json = JSON.parse(rep.stdout);
    assert.ok(Array.isArray(json.results), "report --json must expose `results`");
    assert.equal(json.results.length, 2, "two variants -> two results");

    const cmp = runNode(score(dir), ["compare", "--scenario", "s", "--json"], dir);
    const cjson = JSON.parse(cmp.stdout);
    assert.equal(cjson.variants.length, 2);
  } finally {
    cleanup(dir);
  }
});

test("compare --baseline pairs trials and reports medianDelta + sign-test verdict", () => {
  const dir = freshInstall();
  try {
    runNode(score(dir), ["save", "--type", "run", "--scenario", "s", "--variant", "harness", "--judge", "m", "--axis", "correctness=1.0"], dir);
    runNode(score(dir), ["save", "--type", "run", "--scenario", "s", "--variant", "baseline", "--judge", "m", "--axis", "correctness=0.5:OQ-CORRECT-PARTIAL:x"], dir);
    const cmp = runNode(score(dir), ["compare", "--scenario", "s", "--baseline", "baseline", "--json"], dir);
    const j = JSON.parse(cmp.stdout);
    assert.equal(j.baseline, "baseline");
    const harnessLift = j.lift.find((l) => l.variant === "harness");
    assert.equal(harnessLift.n, 1, "one trial per variant");
    assert.equal(harnessLift.medianDelta, 0.5, "harness aggregate is 0.5 higher than baseline on this single pair");
    assert.equal(harnessLift.axisDelta.correctness, 0.5);
    // n=1 is below the n>=3 confidence threshold — verdict is INCONCLUSIVE.
    assert.match(harnessLift.verdict, /INCONCLUSIVE/);
  } finally {
    cleanup(dir);
  }
});

test("installed static-audit.mjs reports 100% install completeness", () => {
  const dir = freshInstall();
  try {
    const r = runNode(join(dir, ".agentrig/eval/static-audit.mjs"), ["--json"], dir);
    assert.equal(r.status, 0, r.stderr);
    const j = JSON.parse(r.stdout);
    assert.equal(j.installCompleteness, 100, "every structural check should be present");
    // quality probes drop below 100 in a freshly-init'd repo because context.md is only
    // created by the agent investigation phase, and AGENTS.md has unfilled placeholders.
    assert.ok(typeof j.qualityProbes === "number", "qualityProbes field present");
  } finally {
    cleanup(dir);
  }
});

test("dashboard.mjs renders eval results without crashing (regression guard)", () => {
  const dir = freshInstall();
  try {
    runNode(score(dir), ["save", "--type", "run", "--scenario", "s", "--judge", "m", "--axis", "correctness=1.0"], dir);
    const r = runNode(join(dir, ".agentrig/dashboard/dashboard.mjs"), ["--no-tasks", "--json"], dir);
    assert.equal(r.status, 0, r.stderr);
    const json = JSON.parse(r.stdout);
    assert.equal(json.installCompleteness, 100);
    assert.ok((json.evals.results || json.evals.scenarios).length >= 1);
  } finally {
    cleanup(dir);
  }
});
