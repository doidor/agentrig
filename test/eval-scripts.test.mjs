import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { makeRepo, cleanup, runNode, freshInstall } from "./helpers.mjs";
import { loadManifest } from "../dist/core/knowledge.js";
import { install, baseVars } from "../dist/core/install.js";

const score = (dir) => join(dir, ".agentrig/eval/score.mjs");

test("score.mjs accepts a valid run and computes a confidence-gated aggregate", () => {
  const dir = freshInstall();
  try {
    const r = runNode(score(dir), [
      "save", "--type", "run", "--scenario", "s1", "--judge", "m",
      "--axis", "correctness=1.0",
      "--axis", "scope=0.5:OQ-SCOPE-CHURN:left churn",
      "--axis", "tests=na",
    ], dir);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /aggregate=0\.75/);
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

test("compare --baseline computes harness lift (HELPS/HURTS delta)", () => {
  const dir = freshInstall();
  try {
    runNode(score(dir), ["save", "--type", "run", "--scenario", "s", "--variant", "harness", "--judge", "m", "--axis", "correctness=1.0"], dir);
    runNode(score(dir), ["save", "--type", "run", "--scenario", "s", "--variant", "baseline", "--judge", "m", "--axis", "correctness=0.5:OQ-CORRECT-PARTIAL:x"], dir);
    const cmp = runNode(score(dir), ["compare", "--scenario", "s", "--baseline", "baseline", "--json"], dir);
    const j = JSON.parse(cmp.stdout);
    assert.equal(j.baseline, "baseline");
    const harnessLift = j.lift.find((l) => l.variant === "harness");
    assert.equal(harnessLift.aggregateDelta, 0.5, "harness should beat baseline by 0.5");
    assert.equal(harnessLift.axisDelta.correctness, 0.5);
  } finally {
    cleanup(dir);
  }
});

test("installed static-audit.mjs reports 100%", () => {
  const dir = freshInstall();
  try {
    const r = runNode(join(dir, ".agentrig/eval/static-audit.mjs"), ["--json"], dir);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(JSON.parse(r.stdout).harnessScore, 100);
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
    assert.equal(json.harnessScore, 100);
    assert.ok((json.evals.results || json.evals.scenarios).length >= 1);
  } finally {
    cleanup(dir);
  }
});
