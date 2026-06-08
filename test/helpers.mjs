import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { loadManifest } from "../dist/core/knowledge.js";
import { install, baseVars } from "../dist/core/install.js";
import { linkSurfaces } from "../dist/core/surfaces.js";
import { compileSurfaces } from "../dist/core/compile.js";

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
export const cli = join(repoRoot, "dist", "cli.js");

/** Install the canonical harness into a fresh temp repo exactly as `init` does (install + surfaces + compile). */
export function freshInstall() {
  const dir = makeRepo();
  install(dir, loadManifest(), { vars: baseVars(dir) });
  linkSurfaces(dir);
  compileSurfaces(dir);
  return dir;
}

/** Make a temp directory; caller cleans up with cleanup(). */
export function tmp() {
  const dir = mkdtempSync(join(tmpdir(), "agentrig-test-"));
  return dir;
}

export function cleanup(dir) {
  rmSync(dir, { recursive: true, force: true });
}

/** Create a minimal repo dir with a package.json. */
export function makeRepo() {
  const dir = tmp();
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "fixture" }));
  return dir;
}

/** Run the built CLI; returns { status, stdout, stderr }. */
export function runCli(args, opts = {}) {
  try {
    const stdout = execFileSync(process.execPath, [cli, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      ...opts,
    });
    return { status: 0, stdout, stderr: "" };
  } catch (err) {
    return { status: err.status ?? 1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
}

/** Run a node script (e.g. an installed .mjs) in a cwd; returns { status, stdout, stderr }. */
export function runNode(scriptPath, args, cwd) {
  try {
    const stdout = execFileSync(process.execPath, [scriptPath, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      cwd,
    });
    return { status: 0, stdout, stderr: "" };
  } catch (err) {
    return { status: err.status ?? 1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
}

export { writeFileSync, mkdirSync, join };
