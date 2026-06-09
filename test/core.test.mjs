import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, writeFileSync, appendFileSync, rmSync, readFileSync, lstatSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { makeRepo, cleanup, repoRoot, freshInstall } from "./helpers.mjs";

import { loadManifest } from "../dist/core/knowledge.js";
import { install, baseVars, addOnlyCopy, skillsInventory } from "../dist/core/install.js";
import { auditHarness } from "../dist/core/audit.js";
import { linkSurfaces } from "../dist/core/surfaces.js";

test("deterministic install yields 100% install completeness", () => {
  const dir = freshInstall();
  try {
    const report = auditHarness(dir);
    assert.equal(report.harnessScore, 100, "expected full structural completeness");
    // Layer A1 (completeness) should be all PASS on a fresh install. Layer A2 (quality probes)
    // may drop because some probes (context.md, no unfilled {{PLACEHOLDER}}) only pass after
    // the agent investigation phase has run.
    const completeness = report.results.filter((r) => r.layer === "completeness");
    assert.ok(completeness.every((r) => r.score === 1), "every completeness check should be full credit");
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

test("roles run distinct model families (single-model-bias check)", () => {
  const dir = freshInstall();
  try {
    // Make developer and reviewer share a model family -> FAIL (not just partial).
    const devYml = join(dir, ".agentrig/agents/developer.yml");
    writeFileSync(devYml, readFileSync(devYml, "utf8").replace(/^model:.*$/m, "model: gpt-5"));
    const report = auditHarness(dir);
    const check = report.results.find((r) => r.id === "roles-distinct-families");
    assert.ok(check, "roles-distinct-families check should exist");
    assert.equal(check.score, 0, "sharing a model family should fail outright (P1 quality probe)");
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

test("install (preserve: true, default) keeps an existing AGENTS.md and reports it", () => {
  const dir = makeRepo();
  try {
    const myAgentsBody = "# My curated AGENTS.md\n\nThis must not be overwritten.\n";
    writeFileSync(join(dir, "AGENTS.md"), myAgentsBody);
    const { preserved } = install(dir, loadManifest(), { vars: baseVars(dir) });
    assert.equal(readFileSync(join(dir, "AGENTS.md"), "utf8"), myAgentsBody, "AGENTS.md content must be preserved verbatim");
    assert.ok(preserved.includes("AGENTS.md"), "AGENTS.md should be reported as preserved");
    assert.ok(existsSync(join(dir, ".mcp.json")), "non-existing artifacts should still be installed");
  } finally {
    cleanup(dir);
  }
});

test("install (preserve: true) keeps an existing .mcp.json", () => {
  const dir = makeRepo();
  try {
    const myMcp = '{"mcpServers": {"custom": {"command": "my-server"}}}';
    writeFileSync(join(dir, ".mcp.json"), myMcp);
    const { preserved } = install(dir, loadManifest(), { vars: baseVars(dir) });
    assert.equal(readFileSync(join(dir, ".mcp.json"), "utf8"), myMcp);
    assert.ok(preserved.includes(".mcp.json"));
  } finally {
    cleanup(dir);
  }
});

test("install (preserve: true) for a directory artifact keeps existing files but adds missing ones", () => {
  const dir = makeRepo();
  try {
    const myRulePath = join(dir, ".agents/rules/my-team-rule.md");
    const canonicalRulePath = join(dir, ".agents/rules/security.md");
    const userPath = join(dir, ".agents/rules/coding-standards.md");
    const userBody = "---\ndescription: my override\n---\n\n# my override\n";
    // Pre-existing user content under a directory artifact's destination:
    //   - my-team-rule.md is something only the user has
    //   - coding-standards.md is something the canonical set ALSO has — user version should win
    mkdirSync(join(dir, ".agents/rules"), { recursive: true });
    writeFileSync(myRulePath, "# my team rule\n");
    writeFileSync(userPath, userBody);
    const { preserved } = install(dir, loadManifest(), { vars: baseVars(dir) });
    // The user's bespoke file must remain untouched.
    assert.equal(readFileSync(myRulePath, "utf8"), "# my team rule\n");
    // The user's override of a canonical file must win.
    assert.equal(readFileSync(userPath, "utf8"), userBody, "user override must beat canonical");
    assert.ok(preserved.some((p) => p.endsWith("coding-standards.md")), "user override should be reported as preserved");
    // The canonical file the user did NOT touch is still installed.
    assert.ok(existsSync(canonicalRulePath), "canonical rules the user didn't override should be installed");
  } finally {
    cleanup(dir);
  }
});

test("install (preserve: false) overwrites an existing AGENTS.md (i.e. `init --force` behavior)", () => {
  const dir = makeRepo();
  try {
    writeFileSync(join(dir, "AGENTS.md"), "# my curated file\n");
    const { preserved } = install(dir, loadManifest(), { vars: baseVars(dir), preserve: false });
    const newBody = readFileSync(join(dir, "AGENTS.md"), "utf8");
    assert.notEqual(newBody, "# my curated file\n", "AGENTS.md must be overwritten when preserve is false");
    assert.match(newBody, /AGENTS/i, "must be the canonical template");
    assert.equal(preserved.length, 0, "nothing should be reported as preserved");
  } finally {
    cleanup(dir);
  }
});
