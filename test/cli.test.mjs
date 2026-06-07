import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { makeRepo, cleanup, runCli } from "./helpers.mjs";

test("--version prints a semver", () => {
  const r = runCli(["--version"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout.trim(), /^\d+\.\d+\.\d+$/);
});

test("--help exits 0 and lists commands", () => {
  const r = runCli(["--help"]);
  assert.equal(r.status, 0);
  for (const cmd of ["init", "update", "eval", "doctor", "dashboard"]) {
    assert.match(r.stdout, new RegExp(`\\b${cmd}\\b`));
  }
});

test("unknown command exits non-zero", () => {
  const r = runCli(["frobnicate"]);
  assert.notEqual(r.status, 0);
});

test("init --skip-agent installs a harness and eval --static reports 100%", () => {
  const dir = makeRepo();
  try {
    const init = runCli(["init", "--skip-agent", dir]);
    assert.equal(init.status, 0, init.stderr);
    assert.ok(existsSync(join(dir, "AGENTS.md")));
    assert.ok(existsSync(join(dir, ".agentrig/state.json")));

    const ev = runCli(["eval", "--static", "--json", dir]);
    assert.equal(ev.status, 0, ev.stderr);
    assert.equal(JSON.parse(ev.stdout).harnessScore, 100);
  } finally {
    cleanup(dir);
  }
});

test("eval --static --min gate fails on an empty repo", () => {
  const dir = makeRepo();
  try {
    const r = runCli(["eval", "--static", "--min", "50", dir]);
    assert.notEqual(r.status, 0, "empty repo should be below the min threshold");
  } finally {
    cleanup(dir);
  }
});

test("init --dry-run does not write files", () => {
  const dir = makeRepo();
  try {
    const r = runCli(["init", "--dry-run", dir]);
    assert.equal(r.status, 0);
    assert.ok(!existsSync(join(dir, "AGENTS.md")), "dry-run must not write");
  } finally {
    cleanup(dir);
  }
});
