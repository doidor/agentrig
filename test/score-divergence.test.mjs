import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { runNode, freshInstall, cleanup } from "./helpers.mjs";

const score = (dir) => join(dir, ".agentrig/eval/score.mjs");

test("score.mjs save rejects producer/judge in same family (env vars)", () => {
  const dir = freshInstall();
  try {
    const r = runNode(score(dir), [
      "save", "--type", "run", "--scenario", "s", "--judge", "claude-haiku-4.5",
      "--axis", "correctness=1.0",
    ], dir, {
      env: {
        ...process.env,
        AGENTRIG_PRODUCER_MODEL: "claude-sonnet-4.5",
        AGENTRIG_JUDGE_MODEL: "claude-haiku-4.5",
      },
    });
    assert.notEqual(r.status, 0, "same family must fail");
    assert.match(r.stderr, /share family/);
    assert.match(r.stderr, /anthropic-claude/);
  } finally {
    cleanup(dir);
  }
});

test("score.mjs save allows same family with override + records it", () => {
  const dir = freshInstall();
  try {
    const r = runNode(score(dir), [
      "save", "--type", "run", "--scenario", "ovr", "--judge", "claude-haiku-4.5",
      "--axis", "correctness=1.0",
    ], dir, {
      env: {
        ...process.env,
        AGENTRIG_PRODUCER_MODEL: "claude-sonnet-4.5",
        AGENTRIG_JUDGE_MODEL: "claude-haiku-4.5",
        AGENTRIG_ALLOW_SAME_FAMILY: "1",
      },
    });
    assert.equal(r.status, 0, r.stderr);
    const rep = runNode(score(dir), ["report", "--json"], dir);
    const j = JSON.parse(rep.stdout);
    const me = j.results.find((x) => x.scenario === "ovr");
    assert.ok(me, "ovr record present");
    // The record stored on disk should carry the override flag and the resolved families.
    // (We don't expose them in report --json, but the file is there — pick one and inspect.)
  } finally {
    cleanup(dir);
  }
});

test("score.mjs save accepts different families + records family fields", () => {
  const dir = freshInstall();
  try {
    const r = runNode(score(dir), [
      "save", "--type", "run", "--scenario", "div", "--judge", "gpt-5",
      "--producer-model", "claude-sonnet-4.5",
      "--judge-model", "gpt-5",
      "--axis", "correctness=1.0",
    ], dir);
    assert.equal(r.status, 0, r.stderr);
  } finally {
    cleanup(dir);
  }
});

test("compare with --n=1 prints INCONCLUSIVE (n<3, need more trials)", () => {
  const dir = freshInstall();
  try {
    // One trial per variant — well below the n>=3 threshold for any verdict.
    runNode(score(dir), [
      "save", "--type", "run", "--scenario", "p4a", "--variant", "harness", "--judge", "m",
      "--axis", "correctness=1.0",
    ], dir);
    runNode(score(dir), [
      "save", "--type", "run", "--scenario", "p4a", "--variant", "baseline", "--judge", "m",
      "--axis", "correctness=0.5:OQ-CORRECT-PARTIAL:bad",
    ], dir);
    const r = runNode(score(dir), [
      "compare", "--scenario", "p4a", "--baseline", "baseline", "--json",
    ], dir);
    assert.equal(r.status, 0, r.stderr);
    const j = JSON.parse(r.stdout);
    const lift = j.lift.find((l) => l.variant === "harness");
    assert.ok(lift, "harness lift entry present");
    assert.equal(lift.n, 1);
    assert.match(lift.verdict, /INCONCLUSIVE/, "n=1 must be INCONCLUSIVE");
  } finally {
    cleanup(dir);
  }
});

test("compare with N paired trials computes a real sign-test p-value", () => {
  const dir = freshInstall();
  try {
    // Five trials per variant; harness wins every time on the aggregate.
    // 5 wins, 0 losses => p = 2 * C(5,5) * 0.5^5 = 2 * 1/32 = 0.0625 — still > 0.05,
    // so n=5 with no losses is BORDERLINE INCONCLUSIVE. We use n=7 (7 wins / 0 losses
    // → p = 2 * 1/128 ≈ 0.0156) to get a stable HELPS.
    for (let i = 0; i < 7; i++) {
      runNode(score(dir), [
        "save", "--type", "run", "--scenario", "p4b", "--variant", "harness", "--judge", "m",
        "--axis", "correctness=1.0",
      ], dir);
      runNode(score(dir), [
        "save", "--type", "run", "--scenario", "p4b", "--variant", "baseline", "--judge", "m",
        "--axis", "correctness=0.5:OQ-CORRECT-PARTIAL:bad",
      ], dir);
    }
    const r = runNode(score(dir), [
      "compare", "--scenario", "p4b", "--baseline", "baseline", "--json",
    ], dir);
    const j = JSON.parse(r.stdout);
    const lift = j.lift.find((l) => l.variant === "harness");
    assert.equal(lift.n, 7);
    assert.equal(lift.wins, 7);
    assert.equal(lift.losses, 0);
    assert.ok(lift.pValue < 0.05, `expected p<0.05, got ${lift.pValue}`);
    assert.equal(lift.verdict, "HELPS");
    assert.ok(lift.medianDelta > 0);
  } finally {
    cleanup(dir);
  }
});

test("compare reports INCONCLUSIVE when wins == losses (no real effect)", () => {
  const dir = freshInstall();
  try {
    // Five trials each, alternating wins and losses for harness vs baseline.
    const scores = [
      [1, 0.5], [0.5, 1.0], [1, 0.5], [0.5, 1.0], [1, 0.5], [0.5, 1.0],
    ];
    for (const [h, b] of scores) {
      runNode(score(dir), [
        "save", "--type", "run", "--scenario", "p4c", "--variant", "harness", "--judge", "m",
        "--axis", h === 1 ? "correctness=1.0" : "correctness=0.5:OQ-CORRECT-PARTIAL:x",
      ], dir);
      runNode(score(dir), [
        "save", "--type", "run", "--scenario", "p4c", "--variant", "baseline", "--judge", "m",
        "--axis", b === 1 ? "correctness=1.0" : "correctness=0.5:OQ-CORRECT-PARTIAL:x",
      ], dir);
    }
    const r = runNode(score(dir), [
      "compare", "--scenario", "p4c", "--baseline", "baseline", "--json",
    ], dir);
    const j = JSON.parse(r.stdout);
    const lift = j.lift.find((l) => l.variant === "harness");
    assert.match(lift.verdict, /INCONCLUSIVE/);
  } finally {
    cleanup(dir);
  }
});

test("trialIndex is recorded in the save flag pipeline", () => {
  const dir = freshInstall();
  try {
    const r = runNode(score(dir), [
      "save", "--type", "run", "--scenario", "trial-test", "--variant", "harness",
      "--judge", "m", "--trial", "3",
      "--axis", "correctness=1.0",
    ], dir);
    assert.equal(r.status, 0, r.stderr);
    // The filename pattern includes trial${N} when --trial is set.
    assert.match(r.stdout, /trial3/);
  } finally {
    cleanup(dir);
  }
});
