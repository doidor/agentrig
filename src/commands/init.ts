import { writeState, readState, type AgentRigState } from "../core/state.js";
import { loadManifest } from "../core/knowledge.js";
import { install, baseVars } from "../core/install.js";
import { linkSurfaces } from "../core/surfaces.js";
import { compileSurfaces } from "../core/compile.js";
import { validateSetupSteps } from "../core/setupsteps.js";
import { auditHarness } from "../core/audit.js";
import { color, log } from "../core/logger.js";
import { ActivityMonitor } from "../core/activity.js";
import { getProvider } from "../agent/index.js";
import { buildInvestigatePrompt, buildTailorPrompt, SYSTEM_MESSAGE } from "../prompts/index.js";
import { renderAudit } from "./eval.js";
import { renderSetupValidation } from "./compile.js";
import pkg from "../version.js";

export interface InitOptions {
  dryRun?: boolean;
  model?: string;
  yes?: boolean;
  verbose?: boolean;
  skipAgent?: boolean;
}

export async function initCommand(repoRoot: string, options: InitOptions): Promise<number> {
  const manifest = loadManifest();
  const provider = getProvider();

  log.info(color.bold(`AgentRig — initializing harness in ${repoRoot}\n`));

  if (options.dryRun) {
    const { plan } = install(repoRoot, manifest, { dryRun: true });
    log.step("dry run — would install:");
    for (const item of plan) log.info(`  ${color.dim(`P${item.principle}`)} ${item.dest} (${item.kind})`);
    log.info("\n  Agent prompts that would run:");
    log.info(color.dim("  1) investigate → .agentrig/context.md"));
    log.info(color.dim("  2) tailor AGENTS.md / rules / scenarios to the repo"));
    return 0;
  }

  // Phase 1 (optional): agentic investigation, keeping one conversation for context continuity.
  let convo = null as Awaited<ReturnType<typeof provider.startConversation>> | null;
  let monitor: ActivityMonitor | null = null;
  if (!options.skipAgent) {
    const pre = await provider.preflight();
    if (!pre.ok) {
      log.error(`Agent unavailable: ${pre.detail}`);
      log.warn("Re-run with --skip-agent to install the canonical harness without tailoring.");
      return 1;
    }
    log.ok(`agent ready (${pre.detail})`);
    log.step("investigating the repository…");
    monitor = new ActivityMonitor().start();
    convo = await provider.startConversation({
      cwd: repoRoot,
      ...(options.model ? { model: options.model } : {}),
      systemMessage: SYSTEM_MESSAGE,
      onEvent: monitor.handle,
    });
    const investigation = await convo.send(buildInvestigatePrompt());
    monitor.stop();
    log.ok("investigation written to .agentrig/context.md");
    if (options.verbose) log.info(color.dim(investigation));
  } else {
    log.warn("--skip-agent: installing canonical harness without repo-specific tailoring.");
  }

  // Phase 2: deterministic install of the canonical harness (guarantees a baseline + passing audit).
  log.step("installing canonical harness artifacts…");
  const { installed } = install(repoRoot, manifest, { vars: baseVars(repoRoot) });
  log.ok(`installed ${installed.length} artifacts`);

  // Mirror the canonical source to every vendor surface (.claude/.copilot/.opencode/.codex).
  const surfaces = linkSurfaces(repoRoot);
  if (surfaces.created.length) log.ok(`linked surfaces: ${surfaces.created.join(", ")} → .agents`);

  // Phase 3 (optional): agent tailors the installed files to the repo.
  if (convo) {
    log.step("tailoring the harness to this repository…");
    monitor?.start();
    const summary = await convo.send(buildTailorPrompt(manifest));
    monitor?.stop();
    log.ok("tailoring complete");
    if (options.verbose) log.info(color.dim(summary));
    await convo.end();
  }

  // Phase 4: project the canonical source into every agent surface (local + remote).
  const compiled = compileSurfaces(repoRoot);
  log.ok(`compiled ${compiled.generated.length} agent-surface file(s) (Copilot, Claude, Cursor, MCP, setup-steps)`);
  renderSetupValidation(validateSetupSteps(repoRoot));

  // Record state.
  const now = new Date().toISOString();
  const prev = readState(repoRoot);
  const state: AgentRigState = {
    agentrigVersion: pkg.version,
    knowledgeVersion: manifest.knowledgeVersion,
    provider: provider.name,
    ...(options.model ? { model: options.model } : {}),
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
    installed,
  };
  writeState(repoRoot, state);
  log.ok("wrote .agentrig/state.json");

  // Verify with the static audit.
  log.info("");
  renderAudit(auditHarness(repoRoot));
  log.info(color.dim("\n  Next: review AGENTS.md, then run `agentrig eval --static` anytime."));
  return 0;
}
