import { join } from "node:path";
import { readText } from "./fsutil.js";
import { knowledgeRoot } from "./paths.js";

export type ArtifactKind = "file" | "dir" | "template";

export interface Artifact {
  id: string;
  principle: number;
  src: string;
  dest: string;
  kind: ArtifactKind;
  merge?: string;
  mode?: string;
}

export interface Manifest {
  knowledgeVersion: string;
  description?: string;
  artifacts: Artifact[];
}

export interface CheckDef {
  id: string;
  principle: number;
  title: string;
  type: string;
  weight?: number;
  [key: string]: unknown;
}

export function loadManifest(): Manifest {
  const root = knowledgeRoot();
  const text = readText(join(root, "manifest.json"));
  if (!text) throw new Error("knowledge/manifest.json not found");
  return JSON.parse(text) as Manifest;
}

export function loadPrinciples(): string {
  const root = knowledgeRoot();
  return readText(join(root, "PRINCIPLES.md")) ?? "";
}

/** Resolve a manifest `src` (relative to knowledge/ root) to an absolute path. */
export function resolveSrc(src: string): string {
  return join(knowledgeRoot(), src);
}

/**
 * Load the canonical checks shipped with AgentRig. Used by the deterministic audit when the target
 * repo has no installed `.agentrig/eval/checks.json` of its own.
 */
export function loadCanonicalChecks(): CheckDef[] {
  const root = knowledgeRoot();
  const text = readText(join(root, "templates", "eval", "checks.json"));
  if (!text) return [];
  return (JSON.parse(text).checks ?? []) as CheckDef[];
}
