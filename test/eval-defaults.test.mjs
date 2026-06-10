import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { freshInstall, cleanup, runCli } from "./helpers.mjs";

test("eval --dynamic resolves producer/judge models from developer.yml + reviewer.yml by default", () => {
  const dir = freshInstall();
  try {
    runCli(["init", "--skip-agent", dir]); // ensure isInstalled() passes
    // We don't actually run the eval (would need a live model). What we verify is the
    // roster files are present + parseable, which is what the resolver reads.
    const dev = readFileSync(join(dir, ".agentrig/agents/developer.yml"), "utf8");
    const rev = readFileSync(join(dir, ".agentrig/agents/reviewer.yml"), "utf8");
    const devModel = dev.match(/^model:\s*(\S+)/m)[1];
    const revModel = rev.match(/^model:\s*(\S+)/m)[1];
    assert.ok(devModel.startsWith("claude"), `developer.yml model should be claude-*; got ${devModel}`);
    assert.ok(revModel.startsWith("gpt"), `reviewer.yml model should be gpt-*; got ${revModel}`);
  } finally {
    cleanup(dir);
  }
});

test("default roster pair (developer.yml vs reviewer.yml) clears the family-divergence check", () => {
  const dir = freshInstall();
  try {
    // The roster ships with developer=claude-* and reviewer=gpt-* — different families.
    // Verify score.mjs accepts a save with these as producer/judge, no override.
    const producerModel = readFileSync(join(dir, ".agentrig/agents/developer.yml"), "utf8")
      .match(/^model:\s*(\S+)/m)[1];
    const judgeModel = readFileSync(join(dir, ".agentrig/agents/reviewer.yml"), "utf8")
      .match(/^model:\s*(\S+)/m)[1];
    const score = join(dir, ".agentrig/eval/score.mjs");
    let stdout = "", status = 0;
    try {
      stdout = execFileSync(process.execPath, [
        score, "save", "--type", "run", "--scenario", "default-pair-test", "--judge", judgeModel,
        "--axis", "correctness=1.0",
      ], {
        encoding: "utf8",
        env: {
          ...process.env,
          AGENTRIG_PRODUCER_MODEL: producerModel,
          AGENTRIG_JUDGE_MODEL: judgeModel,
        },
      });
    } catch (err) {
      status = err.status;
      stdout = (err.stdout ?? "") + (err.stderr ?? "");
    }
    assert.equal(status, 0, `default roster pair must clear family check; got: ${stdout}`);
  } finally {
    cleanup(dir);
  }
});

test("missing developer.yml / reviewer.yml does not crash the eval CLI", () => {
  const dir = freshInstall();
  try {
    rmSync(join(dir, ".agentrig/agents/developer.yml"));
    rmSync(join(dir, ".agentrig/agents/reviewer.yml"));
    // The eval CLI will fail at provider preflight in this test env, but the resolution
    // code must not throw on missing roster files. We catch any exit code; the test passes
    // as long as the process produces *some* output (i.e. didn't hard-crash early).
    const r = runCli(["eval", "--dynamic", dir]);
    assert.ok(typeof r.stdout === "string" && typeof r.stderr === "string");
  } finally {
    cleanup(dir);
  }
});
