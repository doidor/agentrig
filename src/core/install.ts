import { writeFileSync, existsSync, statSync, readdirSync, readFileSync, chmodSync, copyFileSync } from "node:fs";
import { basename, dirname, relative } from "node:path";
import { copyPath, ensureDir, readText, substitute, join } from "./fsutil.js";
import { resolveSrc, type Artifact, type Manifest } from "./knowledge.js";
import type { InstalledArtifact } from "./state.js";

export interface AddOnlyResult {
  added: string[];   // repo-relative paths that were newly copied
  drifted: string[]; // repo-relative paths that exist and differ from canonical (left untouched)
}

/**
 * Add-only refresh: copy any canonical file that does not exist in the destination, and report
 * (without overwriting) existing files whose content drifted from canonical. Works for a single
 * file or a directory tree. Used by `update` so tailored content is never clobbered.
 */
export function addOnlyCopy(repoRoot: string, src: string, dest: string, mode?: string, apply = true): AddOnlyResult {
  const result: AddOnlyResult = { added: [], drifted: [] };
  const rel = (p: string) => relative(repoRoot, p) || p;

  const walk = (s: string, d: string): void => {
    if (statSync(s).isDirectory()) {
      for (const entry of readdirSync(s)) walk(join(s, entry), join(d, entry));
      return;
    }
    if (!existsSync(d)) {
      if (apply) {
        ensureDir(dirname(d));
        copyFileSync(s, d);
        if (mode) chmodSync(d, parseInt(mode, 8));
      }
      result.added.push(rel(d));
    } else if (!readFileSync(s).equals(readFileSync(d))) {
      result.drifted.push(rel(d));
    }
  };

  if (existsSync(src)) walk(src, dest);
  return result;
}

export interface InstallOptions {
  dryRun?: boolean;
  vars?: Record<string, string>;
  /**
   * When true (the default), existing destination files are left untouched and reported in
   * `preserved`. This makes `init` safe to run on a repo that already has agent content. Set
   * to false to clobber existing files (`init --force`, or `update` for overwrite-policy
   * artifacts where refreshing is the whole point).
   */
  preserve?: boolean;
}

export interface InstallPlanItem {
  id: string;
  principle: number;
  dest: string;
  kind: Artifact["kind"];
}

export interface InstallResult {
  installed: InstalledArtifact[];
  plan: InstallPlanItem[];
  /** Repo-relative paths whose existing content was preserved (skipped). */
  preserved: string[];
}

/** Default template variables derived without an agent. The agent fills the rest later. */
export function baseVars(repoRoot: string): Record<string, string> {
  return {
    REPO_NAME: basename(repoRoot),
  };
}

/**
 * Build the skills-inventory markdown block. Used both at install time (via `{{SKILLS_INVENTORY}}`
 * template substitution) and later by the marker populator that refreshes AGENTS.md on `compile`
 * and `update`.
 *
 * Source-of-truth precedence:
 *   1) When `repoRoot` is provided AND `<repoRoot>/.agents/skills` exists, enumerate the
 *      directory on disk — this picks up user-added skills (e.g. project-specific markbook-*)
 *      alongside the AgentRig-bundled ones. Descriptions come from each skill's `SKILL.md`.
 *   2) Otherwise (or as a fallback for missing SKILL.md descriptions), use the AgentRig manifest.
 *
 * The dual path keeps `agentrig init` deterministic (the freshly-installed repo doesn't have any
 * user skills yet, so manifest entries are the right source) while letting `agentrig compile`
 * and `update` produce a TRUE inventory of what's actually installed.
 */
export function skillsInventory(manifest: Manifest, repoRoot?: string): string {
  const descByName = new Map<string, string>();
  // Manifest-known skills come first (always available even before .agents/skills/ exists).
  for (const artifact of manifest.artifacts) {
    const m = /^\.agents\/skills\/([^/]+)$/.exec(artifact.dest);
    if (!m) continue;
    const name = m[1]!;
    const skillMd = readText(join(resolveSrc(artifact.src), "SKILL.md"));
    const desc = skillMd ? extractFrontmatterValue(skillMd, "description") : null;
    if (!descByName.has(name)) descByName.set(name, desc ?? "");
  }
  // On-disk enumeration: walk every direct child of `.agents/skills/` so user-added skills
  // (not in the AgentRig manifest) show up too. Description preference: installed SKILL.md
  // beats manifest fallback so descriptions stay accurate after a `skill-improver` edit.
  let names: string[];
  const skillsDir = repoRoot ? join(repoRoot, ".agents", "skills") : null;
  if (skillsDir && existsSync(skillsDir)) {
    const onDisk = readdirSync(skillsDir).filter((entry) => {
      if (entry.startsWith(".") || entry.startsWith("_")) return false;
      return statSync(join(skillsDir, entry)).isDirectory();
    });
    for (const name of onDisk) {
      const skillMd = readText(join(skillsDir, name, "SKILL.md"));
      const desc = skillMd ? extractFrontmatterValue(skillMd, "description") : null;
      if (desc) descByName.set(name, desc);
      else if (!descByName.has(name)) descByName.set(name, "");
    }
    names = [...new Set([...onDisk, ...descByName.keys()])];
  } else {
    names = [...descByName.keys()];
  }
  names.sort();
  const lines = names.map((name) => {
    const desc = descByName.get(name) ?? "";
    return `- \`${name}\`${desc ? ` — ${desc}` : ""}`;
  });
  return lines.length ? lines.join("\n") : "_(no skills installed)_";
}

function extractFrontmatterValue(text: string, key: string): string | null {
  if (!text.startsWith("---")) return null;
  const end = text.indexOf("\n---", 3);
  const fm = end < 0 ? text : text.slice(0, end);
  const match = fm.match(new RegExp("^\\s*" + key + "\\s*:\\s*(.+)\\s*$", "m"));
  return match ? match[1]!.trim() : null;
}

/**
 * Deterministically lay down the canonical harness artifacts. This guarantees a baseline harness
 * (and a passing audit) regardless of the agent; the agent then tailors content afterwards.
 *
 * By default (`preserve: true`) existing destination files/dirs are left untouched and reported
 * via `preserved`, so `init` is safe to run on a repo that already has agent content. Pass
 * `preserve: false` to overwrite everything (used by `init --force` and by `update` for
 * overwrite-policy machinery refresh).
 */
export function install(repoRoot: string, manifest: Manifest, options: InstallOptions = {}): InstallResult {
  const vars = { SKILLS_INVENTORY: skillsInventory(manifest), ...(options.vars ?? baseVars(repoRoot)) };
  const preserve = options.preserve !== false;
  const installed: InstalledArtifact[] = [];
  const plan: InstallPlanItem[] = [];
  const preserved: string[] = [];
  const now = new Date().toISOString();

  for (const artifact of manifest.artifacts) {
    plan.push({ id: artifact.id, principle: artifact.principle, dest: artifact.dest, kind: artifact.kind });
    if (options.dryRun) continue;

    const src = resolveSrc(artifact.src);
    const dest = join(repoRoot, artifact.dest);

    if (artifact.kind === "template") {
      if (preserve && existsSync(dest)) {
        preserved.push(artifact.dest);
        continue;
      }
      const text = readText(src);
      if (text == null) throw new Error(`template source missing: ${artifact.src}`);
      ensureDir(join(dest, ".."));
      writeFileSync(dest, substitute(text, vars));
    } else if (artifact.kind === "dir") {
      if (preserve) {
        // Recursively copy only files that don't already exist; report the rest as preserved.
        const addOnly = addOnlyCopy(repoRoot, src, dest, artifact.mode);
        if (addOnly.drifted.length) preserved.push(...addOnly.drifted);
      } else {
        copyPath(src, dest, artifact.mode);
      }
    } else {
      // kind: "file"
      if (preserve && existsSync(dest)) {
        preserved.push(artifact.dest);
        continue;
      }
      copyPath(src, dest, artifact.mode);
    }

    installed.push({
      id: artifact.id,
      dest: artifact.dest,
      knowledgeVersion: manifest.knowledgeVersion,
      installedAt: now,
    });
  }

  return { installed, plan, preserved };
}
