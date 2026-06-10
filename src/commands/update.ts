import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import {
  writeState,
  readState,
  lastReconciliationFor,
  type AgentRigState,
  type ReconciledRecord,
} from "../core/state.js";
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
import { populateAgentsMarkers } from "../core/markers.js";
import { runValidation } from "../core/validate.js";
import { autoFix } from "../core/fix.js";
import pkg from "../version.js";

export interface UpdateOptions {
  dryRun?: boolean;
  diff?: boolean;
  autoFix?: boolean;
  model?: string;
  verbose?: boolean;
  skipAgent?: boolean;
}

function hashFile(path: string): string | null {
  if (!existsSync(path)) return null;
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/**
 * Classify how a preserved file relates to canonical. The classification drives the visual
 * severity in `--diff` and lets a future `--auto-reconcile` decide which files are safe to
 * merge without an agent:
 *   🔴 broken   — file is syntactically invalid (and the validator reports it).
 *   🟢 superset — local fully contains canonical (a local enhancement, safe to keep).
 *   🟡 stale    — canonical fully contains local (canonical strictly newer/more complete).
 *   ⚪ mixed    — both diverged independently; needs human/agent reconciliation.
 */
type DriftSeverity = "broken" | "stale" | "enhancement" | "mixed";

interface ClassifiedDrift {
  path: string;
  severity: DriftSeverity;
  reason: string;
}

function classifyDrift(repoFile: string, canonicalFile: string, brokenPaths: Set<string>, relPath: string): ClassifiedDrift {
  if (brokenPaths.has(relPath)) {
    return { path: relPath, severity: "broken", reason: "fails YAML/syntax validation" };
  }
  const local = readFileSync(repoFile, "utf8");
  const canonical = readFileSync(canonicalFile, "utf8");
  if (local.includes(canonical.trim())) {
    return { path: relPath, severity: "enhancement", reason: "local is a strict superset of canonical" };
  }
  if (canonical.includes(local.trim())) {
    return { path: relPath, severity: "stale", reason: "canonical is a strict superset of local" };
  }
  return { path: relPath, severity: "mixed", reason: "both diverged independently" };
}

function severityBadge(s: DriftSeverity): string {
  switch (s) {
    case "broken": return color.red("🔴 broken");
    case "stale": return color.yellow("🟡 stale");
    case "enhancement": return color.green("🟢 enhancement");
    case "mixed": return color.dim("⚪ mixed");
  }
}

/** Read-only: show how preserved (tailorable) files differ from the latest canonical version. */
function diffPreserved(repoRoot: string): number {
  const manifest = loadManifest();
  const validation = runValidation(repoRoot);
  const brokenPaths = new Set([...validation.yaml.map((y) => y.path)]);
  const preserved = manifest.artifacts.filter((a) => a.kind !== "template" && refreshPolicy(a) === "preserve");
  const classified: ClassifiedDrift[] = [];
  const driftInfos: { rel: string; canonical: string }[] = [];
  for (const a of preserved) {
    const { drifted } = addOnlyCopy(repoRoot, resolveSrc(a.src), join(repoRoot, a.dest), a.mode, false);
    for (const relPath of drifted) {
      const sub = relPath.slice(a.dest.length).replace(/^\//, "");
      const canonical = sub ? join(resolveSrc(a.src), sub) : resolveSrc(a.src);
      driftInfos.push({ rel: relPath, canonical });
      classified.push(classifyDrift(join(repoRoot, relPath), canonical, brokenPaths, relPath));
    }
  }
  if (classified.length === 0) {
    log.ok("no preserved files have drifted from canonical.");
    return 0;
  }

  // Summary first: counts per severity, then the unified diffs grouped by severity.
  const counts: Record<DriftSeverity, number> = { broken: 0, stale: 0, enhancement: 0, mixed: 0 };
  for (const c of classified) counts[c.severity]++;
  log.info(color.bold("Drift summary"));
  log.info(`  ${severityBadge("broken")}: ${counts.broken}   ${severityBadge("stale")}: ${counts.stale}   ${severityBadge("enhancement")}: ${counts.enhancement}   ${severityBadge("mixed")}: ${counts.mixed}`);
  log.info(color.dim("  🔴 fails validation — run `agentrig fix` to restore from canonical."));
  log.info(color.dim("  🟡 canonical has new content your file lacks — review for merge."));
  log.info(color.dim("  🟢 your file is a superset of canonical — likely safe to keep."));
  log.info(color.dim("  ⚪ both diverged independently — needs reconciliation."));

  const order: DriftSeverity[] = ["broken", "stale", "mixed", "enhancement"];
  for (const sev of order) {
    const group = classified.filter((c) => c.severity === sev);
    if (!group.length) continue;
    log.info("");
    log.info(color.bold(`${severityBadge(sev)} (${group.length})`));
    for (const c of group) {
      const info = driftInfos.find((d) => d.rel === c.path)!;
      const repoFile = join(repoRoot, c.path);
      log.info(color.bold(`\n• ${c.path}`) + color.dim(`  — ${c.reason}`));
      const res = spawnSync("diff", ["-u", "--label", "canonical", info.canonical, "--label", c.path, repoFile], { encoding: "utf8" });
      log.info(res.stdout ? res.stdout.trimEnd() : color.dim("  (binary or unreadable diff)"));
    }
  }
  return 0;
}

/** Group a list of repo-relative paths by parent directory for readable enumeration. */
function groupByDir(paths: string[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const p of paths.sort()) {
    const dir = dirname(p) || ".";
    const list = out.get(dir) ?? [];
    list.push(p);
    out.set(dir, list);
  }
  return out;
}

/** Print `count file(s)` with parent-dir grouping when there are more than a handful. */
function logFileList(label: string, paths: string[]): void {
  if (paths.length === 0) return;
  if (paths.length <= 6) {
    log.info(color.dim(`  ${label}:`));
    for (const p of paths) log.info(color.dim(`    · ${p}`));
    return;
  }
  log.info(color.dim(`  ${label} (grouped):`));
  for (const [dir, list] of groupByDir(paths)) {
    log.info(color.dim(`    · ${dir}/  (${list.length})`));
    for (const p of list.slice(0, 3)) log.info(color.dim(`        ${p}`));
    if (list.length > 3) log.info(color.dim(`        … and ${list.length - 3} more`));
  }
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
      logFileList("new", added);
    }
    if (drifted.length) {
      log.step("dry run — preserved (local edits kept); agent would reconcile canonical drift:");
      logFileList("preserved", drifted);
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
  logFileList("added", added);
  if (drifted.length) logFileList("preserved (canonical drifted)", drifted);

  // Ensure vendor-surface symlinks exist (added in later knowledge versions).
  const surfaces = linkSurfaces(repoRoot);
  if (surfaces.created.length) log.ok(`linked surfaces: ${surfaces.created.join(", ")} → .agents`);

  // Repopulate deterministic marker blocks in AGENTS.md BEFORE compile — `compile` does this too
  // but reading from a fresh skills inventory here guarantees the downstream projections see it
  // even when AGENTS.md was a preserved (drifted) file and compile's projection picks up the
  // marker-refreshed body.
  const markerReport = populateAgentsMarkers(repoRoot);
  if (markerReport.updated.length) {
    log.ok(`AGENTS.md: refreshed marker block${markerReport.updated.length === 1 ? "" : "s"} — ${markerReport.updated.join(", ")}`);
  }

  // Re-project the canonical source into every agent surface (local + remote).
  const compiled = compileSurfaces(repoRoot);
  log.ok(`compiled ${compiled.generated.length} agent-surface file(s)`);

  // The agent reconciles templates plus any preserved files whose canonical version drifted —
  // but skip files the user has already consciously diverged on AGAINST the same canonical hash.
  const reconcileNeeded = drifted.filter((rel) => !alreadyDivergedOn(repoRoot, state, rel, refreshable));
  const skippedFromReconcile = drifted.filter((rel) => alreadyDivergedOn(repoRoot, state, rel, refreshable));
  if (skippedFromReconcile.length) {
    log.info(color.dim(`  skipping ${skippedFromReconcile.length} file(s) you previously chose to keep local; canonical hasn't changed since then.`));
  }
  const reconcileList = [...reconcileNeeded, ...templates];
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
    log.warn(`--skip-agent: ${drifted.length} edited file(s) were preserved; canonical updates to them were NOT applied:`);
    logFileList("not reconciled", drifted);
    log.warn("Run `agentrig update` (with the agent) to reconcile them, or diff against the templates manually.");
  }

  // Validate the refreshed install. Hard failures (broken YAML, unknown model id) are fatal
  // unless --auto-fix was passed, in which case we self-heal here.
  const validation = runValidation(repoRoot);
  if (validation.hasBlockers) {
    log.info("");
    if (options.autoFix) {
      log.step("validation found blockers; --auto-fix applying deterministic repairs…");
      const fix = autoFix(repoRoot, { yamlFindings: validation.yaml, modelFindings: validation.models });
      for (const a of fix.actions) log.ok(`${a.path}: ${a.description}`);
      for (const u of fix.unresolved) log.warn(`unresolved: ${u.path} — ${u.reason}`);
      if (fix.unresolved.length) {
        log.error("auto-fix could not resolve every blocker; aborting.");
        return 1;
      }
    } else {
      for (const y of validation.yaml) log.error(`${y.path}: invalid YAML — ${y.error.split("\n")[0]}`);
      for (const m of validation.models) {
        const hint = m.suggestions.length ? `; did you mean ${m.suggestions.join(", ")}?` : "";
        log.error(`${m.path}: unknown model "${m.value}"${hint}`);
      }
      log.error("Refusing to leave a broken install in place. Re-run with --auto-fix to repair from canonical, or `agentrig fix`.");
      return 1;
    }
  }

  // Merge installed records: every refreshable artifact is present/current after update.
  // Also append reconciliation records for every drifted file so a future update can know
  // the user consciously chose to keep this version.
  const now = new Date().toISOString();
  const byId = new Map(state.installed.map((i) => [i.id, i]));
  for (const a of refreshable) {
    byId.set(a.id, { id: a.id, dest: a.dest, knowledgeVersion: manifest.knowledgeVersion, installedAt: now });
  }
  const newReconciliations: ReconciledRecord[] = drifted.map((rel) => ({
    dest: rel,
    knowledgeVersion: manifest.knowledgeVersion,
    decision: "kept-local",
    canonicalHash: canonicalHashFor(rel, refreshable) ?? "",
    decidedAt: now,
  }));
  const newState: AgentRigState = {
    ...state,
    agentrigVersion: pkg.version,
    knowledgeVersion: manifest.knowledgeVersion,
    updatedAt: now,
    installed: [...byId.values()],
    reconciled: [...(state.reconciled ?? []), ...newReconciliations],
  };
  writeState(repoRoot, newState);
  log.ok("updated .agentrig/state.json");

  log.info("");
  renderAudit(auditHarness(repoRoot));
  return 0;
}

/**
 * Resolve the canonical source path for a repo-relative drifted file by scanning the manifest.
 * Returns null when no canonical match exists (e.g. user-added file under a managed dir).
 */
function canonicalPathFor(rel: string, artifacts: ReturnType<typeof loadManifest>["artifacts"]): string | null {
  for (const a of artifacts) {
    if (a.dest === rel) return resolveSrc(a.src);
    if (a.kind === "dir" && rel.startsWith(`${a.dest}/`)) {
      const sub = rel.slice(a.dest.length).replace(/^\//, "");
      return join(resolveSrc(a.src), sub);
    }
  }
  return null;
}

function canonicalHashFor(rel: string, artifacts: ReturnType<typeof loadManifest>["artifacts"]): string | null {
  const p = canonicalPathFor(rel, artifacts);
  return p ? hashFile(p) : null;
}

/**
 * True when the user has previously chosen to keep their local copy of this file AND canonical
 * hasn't changed since that decision. In that case we skip re-prompting on the next update.
 */
function alreadyDivergedOn(
  _repoRoot: string,
  state: AgentRigState,
  rel: string,
  artifacts: ReturnType<typeof loadManifest>["artifacts"],
): boolean {
  const record = lastReconciliationFor(state, rel);
  if (!record || record.decision !== "kept-local") return false;
  const currentCanonical = canonicalHashFor(rel, artifacts);
  return Boolean(currentCanonical) && currentCanonical === record.canonicalHash;
}
