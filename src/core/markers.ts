import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadManifest } from "./knowledge.js";
import { skillsInventory } from "./install.js";

/**
 * A populator owns one `<!-- AGENTRIG:<name>:start --> ... :end -->` block. Given the repo root
 * it returns the multi-line body that should live between the markers (no leading/trailing
 * whitespace; the writer adds its own newlines).
 */
export type MarkerPopulator = (repoRoot: string) => string | null;

/**
 * Registry of marker populators. Add a new entry here when AGENTS.md grows a new auto-maintained
 * block. Names match the marker token (`<!-- AGENTRIG:<name>:start -->`).
 *
 * Populators that have nothing to contribute (e.g. the agent-authored ones) MUST NOT be listed
 * here; only deterministic, source-of-truth-derived sections belong. Anything not in this map is
 * left untouched.
 */
const POPULATORS: Record<string, MarkerPopulator> = {
  "skills-inventory": (repoRoot) => skillsInventory(loadManifest(), repoRoot),
};

export interface MarkerUpdateResult {
  /** Marker names whose block content was rewritten. */
  updated: string[];
  /** Marker names found but skipped (no populator registered). */
  skipped: string[];
  /** Marker names whose populator returned null (nothing to inject). */
  unchanged: string[];
}

/**
 * Rewrite every populated AGENTRIG marker block in `text` from its registered populator. Returns
 * the new text and a structured report. Markers without a populator are left alone — the AGENTS.md
 * template ships many marker pairs that are intentionally agent-edited (context, dirmap, etc.).
 *
 * Marker blocks may legally nest (e.g. `skills-inventory` sits inside `harness`), so we MUST
 * process them per-name with a regex that pairs `start`/`end` by the same name — a single global
 * regex would let the outer block swallow the inner one.
 */
export function rewriteMarkers(repoRoot: string, text: string): { text: string; report: MarkerUpdateResult } {
  const report: MarkerUpdateResult = { updated: [], skipped: [], unchanged: [] };
  const seen = new Set<string>();
  let working = text;

  // First pass: rewrite every block we have a populator for. The per-name regex makes nesting safe.
  for (const [name, populator] of Object.entries(POPULATORS)) {
    const pair = new RegExp(
      `(<!--\\s*AGENTRIG:${escapeRegex(name)}:start\\s*-->)([\\s\\S]*?)(<!--\\s*AGENTRIG:${escapeRegex(name)}:end\\s*-->)`,
      "g",
    );
    let matched = false;
    working = working.replace(pair, (_match, start: string, body: string, end: string) => {
      matched = true;
      const next = populator(repoRoot);
      if (next == null) return `${start}${body}${end}`;
      // Sandwich the body with single newlines so the marker pair always reads as a block.
      return `${start}\n${next}\n${end}`;
    });
    if (matched) {
      seen.add(name);
      const populated = populator(repoRoot);
      if (populated == null) report.unchanged.push(name);
      else report.updated.push(name);
    }
  }

  // Second pass: enumerate every marker name in the file so we can report the ones with no
  // populator registered (callers may want to log or block on unknown markers later).
  const allNames = new Set<string>();
  for (const m of text.matchAll(/<!--\s*AGENTRIG:([\w-]+):start\s*-->/g)) {
    allNames.add(m[1]!);
  }
  for (const name of allNames) if (!seen.has(name)) report.skipped.push(name);

  // The "updated" report is only meaningful when content actually changed.
  if (working === text) report.updated.length = 0;
  return { text: working, report };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Rewrite AGENTS.md in place using the registered populators. No-op when AGENTS.md doesn't exist
 * or when nothing changed (file is not touched, so `git status` stays clean on idempotent calls).
 */
export function populateAgentsMarkers(repoRoot: string): MarkerUpdateResult {
  const path = join(repoRoot, "AGENTS.md");
  if (!existsSync(path)) return { updated: [], skipped: [], unchanged: [] };
  const original = readFileSync(path, "utf8");
  const { text, report } = rewriteMarkers(repoRoot, original);
  if (text !== original) writeFileSync(path, text);
  return report;
}

/** Names of marker blocks that have a registered deterministic populator. */
export function populatedMarkerNames(): string[] {
  return Object.keys(POPULATORS).sort();
}
