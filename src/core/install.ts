import { writeFileSync } from "node:fs";
import { basename } from "node:path";
import { copyPath, ensureDir, readText, substitute, join } from "./fsutil.js";
import { resolveSrc, type Artifact, type Manifest } from "./knowledge.js";
import type { InstalledArtifact } from "./state.js";

export interface InstallOptions {
  dryRun?: boolean;
  vars?: Record<string, string>;
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
}

/** Default template variables derived without an agent. The agent fills the rest later. */
export function baseVars(repoRoot: string): Record<string, string> {
  return {
    REPO_NAME: basename(repoRoot),
  };
}

/**
 * Deterministically lay down the canonical harness artifacts. This guarantees a baseline harness
 * (and a passing audit) regardless of the agent; the agent then tailors content afterwards.
 */
export function install(repoRoot: string, manifest: Manifest, options: InstallOptions = {}): InstallResult {
  const vars = options.vars ?? baseVars(repoRoot);
  const installed: InstalledArtifact[] = [];
  const plan: InstallPlanItem[] = [];
  const now = new Date().toISOString();

  for (const artifact of manifest.artifacts) {
    plan.push({ id: artifact.id, principle: artifact.principle, dest: artifact.dest, kind: artifact.kind });
    if (options.dryRun) continue;

    const src = resolveSrc(artifact.src);
    const dest = join(repoRoot, artifact.dest);

    if (artifact.kind === "template") {
      const text = readText(src);
      if (text == null) throw new Error(`template source missing: ${artifact.src}`);
      ensureDir(join(dest, ".."));
      writeFileSync(dest, substitute(text, vars));
    } else {
      copyPath(src, dest, artifact.mode);
    }

    installed.push({
      id: artifact.id,
      dest: artifact.dest,
      knowledgeVersion: manifest.knowledgeVersion,
      installedAt: now,
    });
  }

  return { installed, plan };
}
