import { existsSync, lstatSync, readlinkSync, symlinkSync } from "node:fs";
import { join } from "node:path";

/** Vendor surface dirs that should all point at the one canonical source (`.agents`). */
export const SURFACE_DIRS = [".claude", ".copilot", ".opencode", ".codex"];
export const CANONICAL_SURFACE = ".agents";

export interface SurfaceLinkResult {
  created: string[];
  skipped: { dir: string; reason: string }[];
}

/**
 * Mirror the canonical agent source (`.agents/`) to every vendor surface via symlinks, so an
 * agent's skills/rules/wiki work regardless of which CLI (`.claude`, `.copilot`, `.opencode`,
 * `.codex`) loads them (principle 11). Idempotent and safe: never clobbers a real directory; tolerates
 * platforms that disallow symlinks.
 */
export function linkSurfaces(repoRoot: string): SurfaceLinkResult {
  const created: string[] = [];
  const skipped: { dir: string; reason: string }[] = [];

  if (!existsSync(join(repoRoot, CANONICAL_SURFACE))) {
    return { created, skipped: SURFACE_DIRS.map((dir) => ({ dir, reason: "no .agents source" })) };
  }

  for (const dir of SURFACE_DIRS) {
    const target = join(repoRoot, dir);
    if (existsSync(target) || isSymlink(target)) {
      if (isSymlink(target) && safeReadlink(target) === CANONICAL_SURFACE) {
        skipped.push({ dir, reason: "already linked" });
      } else {
        skipped.push({ dir, reason: "exists (left untouched)" });
      }
      continue;
    }
    try {
      symlinkSync(CANONICAL_SURFACE, target, "dir");
      created.push(dir);
    } catch (err) {
      skipped.push({ dir, reason: `symlink failed: ${(err as Error).message}` });
    }
  }
  return { created, skipped };
}

function isSymlink(p: string): boolean {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

function safeReadlink(p: string): string | null {
  try {
    return readlinkSync(p);
  } catch {
    return null;
  }
}
