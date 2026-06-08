import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { freshInstall, cleanup } from "./helpers.mjs";
import { compileSurfaces } from "../dist/core/compile.js";

test("compileSurfaces projects every local + remote surface", () => {
  const dir = freshInstall();
  try {
    const r = compileSurfaces(dir);
    const expect = [
      ".github/copilot-instructions.md",
      "CLAUDE.md",
      ".vscode/mcp.json",
      ".github/copilot/mcp.json",
    ];
    for (const p of expect) assert.ok(existsSync(join(dir, p)), `${p} should exist`);
    assert.ok(existsSync(join(dir, ".github/instructions/security.instructions.md")));
    assert.ok(existsSync(join(dir, ".cursor/rules/security.mdc")));
    assert.ok(existsSync(join(dir, ".github/workflows/copilot-setup-steps.yml")));
    assert.ok(r.generated.length >= 10);
  } finally {
    cleanup(dir);
  }
});

test("copilot-instructions carries the Critical Rules and points to AGENTS.md", () => {
  const dir = freshInstall();
  try {
    const text = readFileSync(join(dir, ".github/copilot-instructions.md"), "utf8");
    assert.match(text, /Instructions are the source of truth/);
    assert.match(text, /AGENTS\.md/);
    assert.match(text, /\.github\/instructions/);
  } finally {
    cleanup(dir);
  }
});

test("path-scoped instructions carry applyTo from the rule globs", () => {
  const dir = freshInstall();
  try {
    const text = readFileSync(join(dir, ".github/instructions/security.instructions.md"), "utf8");
    assert.match(text, /^applyTo:\s*"\*\*\/\*"/m);
  } finally {
    cleanup(dir);
  }
});

test("cursor rules carry globs + alwaysApply", () => {
  const dir = freshInstall();
  try {
    const text = readFileSync(join(dir, ".cursor/rules/security.mdc"), "utf8");
    assert.match(text, /^globs:\s*\*\*\/\*/m);
    assert.match(text, /^alwaysApply:\s*true/m);
  } finally {
    cleanup(dir);
  }
});

test("CLAUDE.md imports AGENTS.md", () => {
  const dir = freshInstall();
  try {
    assert.match(readFileSync(join(dir, "CLAUDE.md"), "utf8"), /@AGENTS\.md/);
  } finally {
    cleanup(dir);
  }
});

test("compile mirrors arbitrary AGENTS.md additions into copilot-instructions.md and CLAUDE.md", () => {
  const dir = freshInstall();
  try {
    appendFileSync(
      join(dir, "AGENTS.md"),
      "\n## My custom section\n\nUNIQUE_AGENTS_MARKER lives only in AGENTS.md before compile.\n",
    );
    compileSurfaces(dir);
    const copilot = readFileSync(join(dir, ".github/copilot-instructions.md"), "utf8");
    const claude = readFileSync(join(dir, "CLAUDE.md"), "utf8");
    assert.match(copilot, /My custom section/);
    assert.match(copilot, /UNIQUE_AGENTS_MARKER/);
    assert.match(claude, /My custom section/);
    assert.match(claude, /UNIQUE_AGENTS_MARKER/);
    assert.doesNotMatch(copilot, /<!--\s*AGENTRIG:[\w-]+:(start|end)\s*-->/);
    assert.doesNotMatch(claude, /<!--\s*AGENTRIG:[\w-]+:(start|end)\s*-->/);
  } finally {
    cleanup(dir);
  }
});

test(".vscode/mcp.json uses the VS Code `servers` key", () => {
  const dir = freshInstall();
  try {
    const json = JSON.parse(readFileSync(join(dir, ".vscode/mcp.json"), "utf8"));
    assert.ok(json.servers, "should have a top-level `servers` key");
    assert.ok(json.servers.github, "should carry the github server");
  } finally {
    cleanup(dir);
  }
});

test("compile is idempotent and never clobbers a user-owned setup-steps file", () => {
  const dir = freshInstall();
  try {
    const setup = join(dir, ".github/workflows/copilot-setup-steps.yml");
    appendFileSync(setup, "\n# my custom step marker\n");
    const r = compileSurfaces(dir);
    assert.ok(r.skipped.some((s) => s.path.endsWith("copilot-setup-steps.yml")), "setup-steps should be skipped");
    assert.match(readFileSync(setup, "utf8"), /my custom step marker/, "user edit preserved");
  } finally {
    cleanup(dir);
  }
});

test("editing a rule reprojects into instructions + cursor", () => {
  const dir = freshInstall();
  try {
    writeFileSync(
      join(dir, ".agents/rules/coding-standards.md"),
      `---\nglobs: ["src/**/*.ts"]\ndescription: TS only\npriority: 3\n---\n\n# Standards\n\n- UNIQUE_MARKER rule\n`,
    );
    compileSurfaces(dir);
    const instr = readFileSync(join(dir, ".github/instructions/coding-standards.instructions.md"), "utf8");
    assert.match(instr, /applyTo:\s*"src\/\*\*\/\*\.ts"/);
    assert.match(instr, /UNIQUE_MARKER/);
    const mdc = readFileSync(join(dir, ".cursor/rules/coding-standards.mdc"), "utf8");
    assert.match(mdc, /alwaysApply:\s*false/);
  } finally {
    cleanup(dir);
  }
});
