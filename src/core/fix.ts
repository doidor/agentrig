import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensureDir } from "./fsutil.js";
import { loadManifest, resolveSrc } from "./knowledge.js";
import { validateModelIds, validateYaml, type ModelFinding, type YamlFinding } from "./validate.js";

/**
 * The model id we substitute when a role yaml references something the SDK no longer recognizes.
 * `auto` is intentional: it always exists in the registry and lets the user pick a real model on
 * the next manual edit. Picking a specific canonical id would lock the harness to whatever model
 * we happened to ship in this knowledge bundle.
 */
const CANONICAL_FALLBACK_MODEL = "auto";

export interface FixAction {
  /** Repo-relative path that was fixed. */
  path: string;
  /** Short human-readable description of what was done. */
  description: string;
  /** Backup file written next to the original (`.bak`), so the user can recover if needed. */
  backup: string;
}

export interface FixResult {
  actions: FixAction[];
  /** Findings the fixer couldn't resolve deterministically (e.g. no canonical source mapped). */
  unresolved: { path: string; reason: string }[];
}

/** Resolve the canonical source file for a destination path, by scanning the manifest. */
function canonicalSourceFor(dest: string): string | null {
  const manifest = loadManifest();
  for (const artifact of manifest.artifacts) {
    if (artifact.dest === dest && (artifact.kind === "file" || artifact.kind === "template")) {
      return resolveSrc(artifact.src);
    }
    if (artifact.kind === "dir" && (dest === artifact.dest || dest.startsWith(`${artifact.dest}/`))) {
      const suffix = dest.slice(artifact.dest.length).replace(/^\//, "");
      return suffix ? join(resolveSrc(artifact.src), suffix) : resolveSrc(artifact.src);
    }
  }
  return null;
}

/** Write a `.bak` copy next to `abs` if one doesn't already exist for this fix pass. */
function backup(abs: string): string {
  const bak = `${abs}.bak`;
  if (existsSync(abs) && !existsSync(bak)) copyFileSync(abs, bak);
  return bak;
}

/** Replace `model: <unknown>` with the canonical fallback inside a role yaml. */
function rewriteModelLine(text: string, fallback: string): string {
  return text.replace(/^(\s*model\s*:\s*)(.+?)(\s*)$/m, (_match, prefix: string, _value: string, trailing: string) => {
    // Preserve trailing whitespace / comments? We keep it simple — strip everything after the value
    // because the SDK won't accept inline comments next to the value either.
    return `${prefix}${fallback}${trailing}`;
  });
}

/**
 * Auto-fix deterministic A1 failures:
 *   - broken YAML (any .agentrig YAML file that doesn't parse) - restore from canonical.
 *   - unknown model id in `.agentrig/agents/*.yml`             - replace with `CANONICAL_FALLBACK_MODEL`.
 *
 * Anything we can't resolve from a canonical artifact (custom YAML files the user added) is
 * surfaced in `unresolved` so the human or the agent reconciler can take it from here.
 */
export function autoFix(
  repoRoot: string,
  options: { yamlFindings?: YamlFinding[]; modelFindings?: ModelFinding[]; dryRun?: boolean } = {},
): FixResult {
  const result: FixResult = { actions: [], unresolved: [] };
  const yamlFindings = options.yamlFindings ?? validateYaml(repoRoot);
  const modelFindings = options.modelFindings ?? validateModelIds(repoRoot);
  const dryRun = Boolean(options.dryRun);

  // 1) Broken YAML: restore from canonical.
  for (const finding of yamlFindings) {
    const src = canonicalSourceFor(finding.path);
    if (!src || !existsSync(src)) {
      result.unresolved.push({
        path: finding.path,
        reason: `no canonical source mapped (parser said: ${finding.error})`,
      });
      continue;
    }
    const abs = join(repoRoot, finding.path);
    if (!dryRun) {
      backup(abs);
      ensureDir(join(abs, ".."));
      copyFileSync(src, abs);
    }
    result.actions.push({
      path: finding.path,
      description: `restored from canonical (was invalid YAML: ${finding.error.split("\n")[0]})`,
      backup: `${finding.path}.bak`,
    });
  }

  // 2) Unknown model ids: replace with the canonical fallback. We do NOT restore the whole file
  //    here — the user's prompt / tier / allowed_tools edits are still good.
  for (const finding of modelFindings) {
    const abs = join(repoRoot, finding.path);
    if (!existsSync(abs)) {
      result.unresolved.push({ path: finding.path, reason: "file vanished during fix pass" });
      continue;
    }
    const text = readFileSync(abs, "utf8");
    const rewritten = rewriteModelLine(text, CANONICAL_FALLBACK_MODEL);
    if (rewritten === text) {
      result.unresolved.push({
        path: finding.path,
        reason: `model line not found while trying to replace "${finding.value}"`,
      });
      continue;
    }
    if (!dryRun) {
      backup(abs);
      writeFileSync(abs, rewritten);
    }
    result.actions.push({
      path: finding.path,
      description: `model "${finding.value}" → "${CANONICAL_FALLBACK_MODEL}" (canonical fallback)${
        finding.suggestions.length ? ` — pick one of: ${finding.suggestions.join(", ")}` : ""
      }`,
      backup: `${finding.path}.bak`,
    });
  }

  return result;
}

/** Exposed for `agentrig fix` UI. */
export { CANONICAL_FALLBACK_MODEL };
