import { join } from "node:path";
import { readText, ensureDir } from "./fsutil.js";
import { writeFileSync, existsSync } from "node:fs";

export interface InstalledArtifact {
  id: string;
  dest: string;
  knowledgeVersion: string;
  installedAt: string;
}

/**
 * One record per preserved file the user has consciously diverged from canonical on. Lets
 * `agentrig update` (and `--diff`) skip nagging on files where the user explicitly chose to
 * keep their version, and only re-prompt when canonical has changed AGAIN since that decision.
 */
export interface ReconciledRecord {
  /** Repo-relative path of the preserved file. */
  dest: string;
  /** Knowledge version active at the time of the reconcile decision. */
  knowledgeVersion: string;
  /** What the agent / human did: kept local, merged canonical changes, or overwrote with canonical. */
  decision: "kept-local" | "merged" | "overwrote";
  /** SHA-256 of the canonical file at the time of the decision — re-prompt only when canonical drifts past this. */
  canonicalHash: string;
  /** When the decision was made, ISO-8601. */
  decidedAt: string;
}

export interface AgentRigState {
  agentrigVersion: string;
  knowledgeVersion: string;
  provider: string;
  model?: string;
  createdAt: string;
  updatedAt: string;
  installed: InstalledArtifact[];
  /** Per-file history of preserved-file reconciliation decisions. Optional for back-compat. */
  reconciled?: ReconciledRecord[];
}

const STATE_REL = join(".agentrig", "state.json");

export function statePath(repoRoot: string): string {
  return join(repoRoot, STATE_REL);
}

export function readState(repoRoot: string): AgentRigState | null {
  const text = readText(statePath(repoRoot));
  return text ? (JSON.parse(text) as AgentRigState) : null;
}

export function writeState(repoRoot: string, state: AgentRigState): void {
  ensureDir(join(repoRoot, ".agentrig"));
  writeFileSync(statePath(repoRoot), JSON.stringify(state, null, 2) + "\n");
}

export function isInstalled(repoRoot: string): boolean {
  return existsSync(statePath(repoRoot));
}

/** Get the last-recorded reconciliation decision for a given repo-relative path. */
export function lastReconciliationFor(state: AgentRigState | null, dest: string): ReconciledRecord | null {
  if (!state?.reconciled) return null;
  // The list is append-only, so the last matching entry wins.
  for (let i = state.reconciled.length - 1; i >= 0; i--) {
    if (state.reconciled[i]!.dest === dest) return state.reconciled[i]!;
  }
  return null;
}
