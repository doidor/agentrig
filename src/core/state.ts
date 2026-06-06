import { join } from "node:path";
import { readText, ensureDir } from "./fsutil.js";
import { writeFileSync, existsSync } from "node:fs";

export interface InstalledArtifact {
  id: string;
  dest: string;
  knowledgeVersion: string;
  installedAt: string;
}

export interface AgentRigState {
  agentrigVersion: string;
  knowledgeVersion: string;
  provider: string;
  model?: string;
  createdAt: string;
  updatedAt: string;
  installed: InstalledArtifact[];
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
