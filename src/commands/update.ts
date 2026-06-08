import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { writeState, readState, type AgentRigState } from "../core/state.js";
import { loadManifest, refreshPolicy } from "../core/knowledge.js";
import { install, baseVars, addOnlyCopy } from "../core/install.js";
import { linkSurfaces } from "../core/surfaces.js";
import { compileSurfaces } from "../core/compile.js";
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
  diff?: boolean;
  model?: string;
  verbose?: boolean;
  skipAgent?: boolean;
}

function hashFile(path: string): string | null {
  if (!existsSync(path)) return null;
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** Read-only: show how preserved (tailorable) files differ from the latest canonical version. */
function diffPreserved(repoRoot: string): number {
  const manifest = loadManifest();
  const preserved = manifest.artifacts.filter((a) => a.kind !== "template" && refreshPolicy(a) === "preserve");
  let any = false;
  for (const a of preserved) {
    const { drifted } = addOnlyCopy(repoRoot, resolveSrc(a.src), join(repoRoot, a.dest), a.mode, false);
    for (const relPath of drifted) {
      any = true;
      const repoFile = join(repoRoot, relPath);
      // Map the drifted repo-relative path back to its canonical source file.
      const sub = relPath.slice(a.dest.length).replace(/^\//, "");
      const canonical = sub ? join(resolveSrc(a.src), sub) : resolveSrc(a.src);
      log.info(color.bold(`\n• ${relPath}`) + color.dim("  (preserved; canonical drifted)"));
      const res = spawnSync("diff", ["-u", "--label", "canonical", canonical, "--label", relPath, repoFile], { encoding: "utf8" });
      log.info(res.stdout ? res.stdout.trimEnd() : color.dim("  (binary or unreadable diff)"));
    }
  }
  if (!any) log.ok("no preserved files have drifted from canonical.");
  return 0;
}

/**
 * Re-sync the latest canonical best practices into a repo. Machinery files are overwritten;
 * tailorable artifacts are refreshed add-only (new files added, existing ones preserved) with any
 * canonical drift handed to the agent reconcile. Templates (AGENTS.md) are reconciled by the agent.
 */
export async function updateCommand(repoRoot: string, options: UpdateOptions): Promise<number> {
  const state = readState(repoRoot);
  if (!state) {
    log.error("No AgentRig harness here. Run `agentrig init` first.");
    return 1;
  }
  if (options.diff) {
    log.info(color.bold("AgentRig — drift of preserved files vs canonical\n"));
    return diffPreserved(repoRoot);
  }
  const manifest = loadManifest();
  const versionBump = state.knowledgeVersion !== manifest.knowledgeVersion;
  const refreshable = manifest.artifacts.filter((a) => a.kind !== "template");
  const templates = manifest.artifacts.filter((a) => a.kind === "template").map((a) => a.dest);

  // Split by refresh policy. `overwrite` = AgentRig-owned machinery/docs (replace to stay current);
  // `preserve` = tailorable content (add-only; never clobber existing files).
  const toOverwrite: typeof refreshable = [];
  for (const a of refreshable.filter((a) => refreshPolicy(a) === "overwrite")) {
    if (a.kind === "dir") {
      if (versionBump) toOverwrite.push(a);
    } else if (hashFile(resolveSrc(a.src)) !== hashFile(join(repoRoot, a.dest))) {
      toOverwrite.push(a);
    }
  }

  // Add-only refresh for preserved artifacts: classify first (apply only when not a dry run).
  const added: string[] = [];
  const drifted: string[] = [];
  for (const a of refreshable.filter((a) => refreshPolicy(a) === "preserve")) {
    const r = addOnlyCopy(repoRoot, resolveSrc(a.src), join(repoRoot, a.dest), a.mode, !options.dryRun);
    added.push(...r.added);
    drifted.push(...r.drifted);
  }

  log.info(color.bold(`AgentRig — updating harness (knowledge ${state.knowledgeVersion} → ${manifest.knowledgeVersion})\n`));

  if (toOverwrite.length === 0 && added.length === 0 && drifted.length === 0 && !versionBump) {
    log.ok("already up to date — nothing to refresh.");
    return 0;
  }

  if (options.dryRun) {
    if (toOverwrite.length) {
      log.step("dry run — would overwrite (AgentRig-owned):");
      for (const a of toOverwrite) log.info(`  ${a.dest}`);
    }
    if (added.length) {
      log.step("dry run — would add new files:");
      for (const f of added) log.info(`  ${f}`);
    }
    if (drifted.length) {
      log.step("dry run — preserved (local edits kept); agent would reconcile canonical drift:");
      for (const f of drifted) log.info(color.dim(`  ${f}`));
    }
    log.step("dry run — agent would reconcile templates:");
    for (const t of templates) log.info(color.dim(`  ${t}`));
    return 0;
  }

  // Apply: overwrite machinery (preserved files were already add-only-applied above).
  log.step("refreshing harness…");
  const onlyOverwrite = { ...manifest, artifacts: toOverwrite };
  const { installed } = install(repoRoot, onlyOverwrite, { vars: baseVars(repoRoot), preserve: false });
  log.ok(`overwrote ${installed.length} owned file(s); added ${added.length} new file(s); preserved ${drifted.length} edited file(s)`);

  // Ensure vendor-surface symlinks exist (added in later knowledge versions).
  const surfaces = linkSurfaces(repoRoot);
  if (surfaces.created.length) log.ok(`linked surfaces: ${surfaces.created.join(", ")} → .agents`);

  // Re-project the canonical source into every agent surface (local + remote).
  const compiled = compileSurfaces(repoRoot);
  log.ok(`compiled ${compiled.generated.length} agent-surface file(s)`);

  // The agent reconciles templates plus any preserved files whose canonical version drifted.
  const reconcileList = [...drifted, ...templates];
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
        const summary = await convo.send(buildUpdatePrompt(reconcileList));
        monitor.stop();
        log.ok("reconciliation complete");
        if (options.verbose) log.info(color.dim(summary));
      } finally {
        monitor.stop();
        await convo.end();
      }
    } else {
      log.warn(`agent unavailable (${pre.detail}); skipped reconciliation.`);
    }
  } else if (drifted.length) {
    log.warn(`--skip-agent: ${drifted.length} edited file(s) were preserved; canonical updates to them were NOT applied.`);
    log.warn("Run `agentrig update` (with the agent) to reconcile them, or diff against the templates manually.");
  }

  // Merge installed records: every refreshable artifact is present/current after update.
  const now = new Date().toISOString();
  const byId = new Map(state.installed.map((i) => [i.id, i]));
  for (const a of refreshable) {
    byId.set(a.id, { id: a.id, dest: a.dest, knowledgeVersion: manifest.knowledgeVersion, installedAt: now });
  }
  const newState: AgentRigState = {
    ...state,
    agentrigVersion: pkg.version,
    knowledgeVersion: manifest.knowledgeVersion,
    updatedAt: now,
    installed: [...byId.values()],
  };
  writeState(repoRoot, newState);
  log.ok("updated .agentrig/state.json");

  log.info("");
  renderAudit(auditHarness(repoRoot));
  return 0;
}
