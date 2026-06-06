import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { writeState, readState, type AgentRigState } from "../core/state.js";
import { loadManifest } from "../core/knowledge.js";
import { install, baseVars } from "../core/install.js";
import { linkSurfaces } from "../core/surfaces.js";
import { resolveSrc } from "../core/knowledge.js";
import { auditHarness } from "../core/audit.js";
import { color, log } from "../core/logger.js";
import { ActivityMonitor } from "../core/activity.js";
import { getProvider } from "../agent/index.js";
import { buildUpdatePrompt, SYSTEM_MESSAGE } from "../prompts/index.js";
import { renderAudit } from "./eval.js";
import { join } from "../core/fsutil.js";
import pkg from "../version.js";

export interface UpdateOptions {
  dryRun?: boolean;
  model?: string;
  verbose?: boolean;
  skipAgent?: boolean;
}

function hashFile(path: string): string | null {
  if (!existsSync(path)) return null;
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/**
 * Re-sync the latest canonical best practices into a repo. Files whose installed content differs
 * from the latest canonical content are refreshed; the agent then reconciles repo customizations.
 * Templates (AGENTS.md) are never overwritten deterministically — they are handed to the agent.
 */
export async function updateCommand(repoRoot: string, options: UpdateOptions): Promise<number> {
  const state = readState(repoRoot);
  if (!state) {
    log.error("No AgentRig harness here. Run `agentrig init` first.");
    return 1;
  }
  const manifest = loadManifest();

  // Determine which non-template artifacts have drifted from canonical.
  const changed: string[] = [];
  const refreshable = manifest.artifacts.filter((a) => a.kind !== "template");
  for (const artifact of refreshable) {
    if (artifact.kind === "dir") {
      // For directories, refresh on any knowledge version bump (coarse but predictable).
      if (state.knowledgeVersion !== manifest.knowledgeVersion) changed.push(artifact.dest);
      continue;
    }
    const srcHash = hashFile(resolveSrc(artifact.src));
    const destHash = hashFile(join(repoRoot, artifact.dest));
    if (srcHash !== destHash) changed.push(artifact.dest);
  }
  const templates = manifest.artifacts.filter((a) => a.kind === "template").map((a) => a.dest);

  log.info(color.bold(`AgentRig — updating harness (knowledge ${state.knowledgeVersion} → ${manifest.knowledgeVersion})\n`));

  if (changed.length === 0 && state.knowledgeVersion === manifest.knowledgeVersion) {
    log.ok("already up to date — no canonical files changed.");
    return 0;
  }

  if (options.dryRun) {
    log.step("dry run — would refresh these canonical files:");
    for (const c of changed) log.info(`  ${c}`);
    log.info("\n  And ask the agent to reconcile templates:");
    for (const t of templates) log.info(color.dim(`  ${t}`));
    return 0;
  }

  // Deterministically re-copy the changed non-template artifacts (preserves none of the local edits
  // on those files — they are AgentRig-owned). Templates are left to the agent.
  log.step("refreshing canonical artifacts…");
  const onlyChanged = {
    ...manifest,
    artifacts: manifest.artifacts.filter((a) => a.kind !== "template" && changed.includes(a.dest)),
  };
  const { installed } = install(repoRoot, onlyChanged, { vars: baseVars(repoRoot) });
  log.ok(`refreshed ${installed.length} artifacts`);

  // Ensure vendor-surface symlinks exist (added in later knowledge versions).
  const surfaces = linkSurfaces(repoRoot);
  if (surfaces.created.length) log.ok(`linked surfaces: ${surfaces.created.join(", ")} → .agents`);

  // Agent reconciles templates + any repo-specific content.
  if (!options.skipAgent) {
    const provider = getProvider();
    const pre = await provider.preflight();
    if (pre.ok) {
      log.ok(`agent ready (${pre.detail})`);
      log.step("reconciling repo-specific content…");
      const monitor = new ActivityMonitor().start();
      const convo = await provider.startConversation({
        cwd: repoRoot,
        ...(options.model ? { model: options.model } : {}),
        systemMessage: SYSTEM_MESSAGE,
        onEvent: monitor.handle,
      });
      try {
        const summary = await convo.send(buildUpdatePrompt([...changed, ...templates]));
        monitor.stop();
        log.ok("reconciliation complete");
        if (options.verbose) log.info(color.dim(summary));
      } finally {
        monitor.stop();
        await convo.end();
      }
    } else {
      log.warn(`agent unavailable (${pre.detail}); skipped reconciliation of templates.`);
    }
  }

  // Merge installed records (replace entries with same id).
  const byId = new Map(state.installed.map((i) => [i.id, i]));
  for (const i of installed) byId.set(i.id, i);
  const newState: AgentRigState = {
    ...state,
    agentrigVersion: pkg.version,
    knowledgeVersion: manifest.knowledgeVersion,
    updatedAt: new Date().toISOString(),
    installed: [...byId.values()],
  };
  writeState(repoRoot, newState);
  log.ok("updated .agentrig/state.json");

  log.info("");
  renderAudit(auditHarness(repoRoot));
  return 0;
}
