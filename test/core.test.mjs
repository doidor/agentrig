import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, writeFileSync, appendFileSync, rmSync, readFileSync, lstatSync } from "node:fs";
import { join } from "node:path";
import { makeRepo, cleanup, repoRoot, freshInstall } from "./helpers.mjs";

import { loadManifest } from "../dist/core/knowledge.js";
import { install, baseVars, addOnlyCopy, skillsInventory } from "../dist/core/install.js";
import { auditHarness } from "../dist/core/audit.js";
import { linkSurfaces } from "../dist/core/surfaces.js";

test("deterministic install yields a 100% harness score", () => {
  const dir = freshInstall();
  try {
    const report = auditHarness(dir);
    assert.equal(report.harnessScore, 100, "expected full harness score");
    assert.ok(report.results.every((r) => r.score === 1), "every check should be full credit");
    assert.equal(report.source, "repo", "should audit against the installed checks.json");
  } finally {
    cleanup(dir);
  }
}); 

test("audit penalizes a missing artifact", () => {
  const dir = freshInstall();
  try {
    rmSync(join(dir, ".mcp.json"));
    const report = auditHarness(dir);
    assert.ok(report.harnessScore < 100, "score should drop when an artifact is removed");
    assert.ok(report.results.some((r) => r.id === "mcp" && r.score === 0), "mcp check should fail");
  } finally {
    cleanup(dir);
  }
});

test("roles run distinct models (single-model-bias check)", () => {
  const dir = freshInstall();
  try {
    // Make developer and reviewer share a model -> partial credit.
    const devYml = join(dir, ".agentrig/agents/developer.yml");
    writeFileSync(devYml, readFileSync(devYml, "utf8").replace(/^model:.*$/m, "model: gpt-5"));
    const report = auditHarness(dir);
    const check = report.results.find((r) => r.id === "roles-distinct-models");
    assert.equal(check.score, 0.5, "sharing a model should be partial credit");
  } finally {
    cleanup(dir);
  }
});

test("addOnlyCopy adds missing files and preserves drifted ones", () => {
  const dir = freshInstall();
  try {
    const manifest = loadManifest();
    const rules = manifest.artifacts.find((a) => a.id === "rules");
    const src = join(repoRoot, "knowledge", rules.src);
    const dest = join(dir, rules.dest);

    // Drift an existing file and delete another.
    appendFileSync(join(dest, "coding-standards.md"), "\n- LOCAL EDIT\n");
    rmSync(join(dest, "security.md"));

    const r = addOnlyCopy(dir, src, dest);
    assert.ok(r.added.some((p) => p.endsWith("security.md")), "deleted file should be re-added");
    assert.ok(r.drifted.some((p) => p.endsWith("coding-standards.md")), "edited file should be reported as drift");
    assert.ok(
      readFileSync(join(dest, "coding-standards.md"), "utf8").includes("LOCAL EDIT"),
      "local edit must be preserved (not clobbered)",
    );
  } finally {
    cleanup(dir);
  }
});

test("linkSurfaces creates idempotent symlinks to .agents", () => {
  const dir = makeRepo();
  install(dir, loadManifest(), { vars: baseVars(dir) }); // install WITHOUT surfaces
  try {
    const first = linkSurfaces(dir);
    assert.ok(first.created.includes(".claude"), ".claude should be created");
    assert.ok(lstatSync(join(dir, ".claude")).isSymbolicLink(), ".claude should be a symlink");
    assert.ok(existsSync(join(dir, ".claude", "skills")), "symlink should resolve into .agents/skills");

    const second = linkSurfaces(dir);
    assert.equal(second.created.length, 0, "second run should create nothing (idempotent)");
  } finally {
    cleanup(dir);
  }
});

test("skillsInventory lists installed skills from the manifest", () => {
  const inv = skillsInventory(loadManifest());
  for (const name of ["self-verify", "harness-eval", "verify-loop", "skill-authoring"]) {
    assert.ok(inv.includes(`\`${name}\``), `inventory should mention ${name}`);
  }
});
