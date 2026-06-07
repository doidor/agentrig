import { isInstalled } from "../core/state.js";
import { color, log } from "../core/logger.js";
import { ActivityMonitor } from "../core/activity.js";
import { getProvider } from "../agent/index.js";
import { AgentTimeoutError } from "../agent/provider.js";
import { buildImplementPrompt, SYSTEM_MESSAGE } from "../prompts/index.js";
import {
  readStateLabels,
  readLimits,
  ghAvailable,
  listReadyIssues,
  claimIssue,
  commentIssue,
  createWorktree,
  worktreeBranch,
  isGitRepo,
} from "../core/harness.js";

export interface RunOptions {
  once?: boolean;
  watch?: boolean;
  intervalSec?: number;
  max?: number;
  label?: string;
  dryRun?: boolean;
  model?: string;
  verbose?: boolean;
}

/**
 * Minimal orchestration engine (MVP). One tick: ingest ready GitHub issues, claim each (label swap),
 * implement it in a hermetic worktree via the developer agent with self-verify, and post a progress
 * comment. It deliberately stops short of pushing/PR/merge (low reversibility) — that stays human-
 * or later-stage-gated. The full DAG contract lives in `.agentrig/harness/ORCHESTRATION.md`.
 */
export async function runCommand(repoRoot: string, options: RunOptions): Promise<number> {
  if (!isInstalled(repoRoot)) {
    log.error("No AgentRig harness here. Run `agentrig init` first.");
    return 1;
  }
  if (!isGitRepo(repoRoot)) {
    log.error("Not a git repository — the engine needs git worktrees.");
    return 1;
  }
  if (!options.dryRun && !ghAvailable()) {
    log.error("`gh` is not installed or not authenticated — needed to read/claim issues.");
    return 1;
  }

  const labels = readStateLabels(repoRoot);
  const limits = readLimits(repoRoot);
  const readyLabel = options.label ?? labels.queued ?? "agentrig-ready";
  const startedLabel = labels.implementing ?? "agentrig-started";
  const max = options.max ?? limits.max_concurrent_agents ?? 4;

  log.info(color.bold(`AgentRig — engine (MVP)`));
  log.info(color.dim(`  ready label: ${readyLabel} → started: ${startedLabel} · max/tick: ${max}\n`));

  const tick = async (): Promise<void> => {
    const issues = listReadyIssues(repoRoot, readyLabel, max).slice(0, max);
    if (issues.length === 0) {
      log.info(color.dim(`  no open issues labelled "${readyLabel}".`));
      return;
    }
    log.step(`processing ${issues.length} ready issue(s)…`);

    if (options.dryRun) {
      for (const issue of issues) log.info(`  would implement #${issue.number}: ${issue.title}`);
      return;
    }

    const provider = getProvider();
    const pre = await provider.preflight();
    if (!pre.ok) {
      log.error(`Agent unavailable: ${pre.detail}`);
      return;
    }
    log.ok(`agent ready (${pre.detail})`);

    for (const issue of issues) {
      const agentId = `issue-${issue.number}`;
      if (!claimIssue(repoRoot, issue.number, readyLabel, startedLabel)) {
        log.warn(`#${issue.number}: could not claim (already taken?) — skipping`);
        continue;
      }
      const worktree = createWorktree(repoRoot, agentId);
      log.step(`#${issue.number} "${issue.title}" → ${worktreeBranch(agentId)}`);

      const monitor = new ActivityMonitor().start();
      const convo = await provider.startConversation({
        cwd: worktree,
        systemMessage: SYSTEM_MESSAGE,
        onEvent: monitor.handle,
        ...(options.model ? { model: options.model } : {}),
      });
      try {
        const summary = await convo.send(
          buildImplementPrompt(issue, limits.max_diff_chars ?? 50000),
        );
        monitor.stop();
        commentIssue(
          repoRoot,
          issue.number,
          `🤖 AgentRig implemented this on branch \`${worktreeBranch(agentId)}\` (worktree).\n\n${summary}`,
        );
        log.ok(`#${issue.number} done — summary posted to the issue`);
      } catch (err) {
        monitor.stop();
        const msg = err instanceof AgentTimeoutError ? err.message : (err as Error).message;
        log.error(`#${issue.number} failed: ${msg}`);
        commentIssue(repoRoot, issue.number, `🤖 AgentRig could not complete this: ${msg}`);
      } finally {
        monitor.stop();
        await convo.end();
      }
    }
  };

  if (options.watch) {
    const intervalMs = (options.intervalSec ?? 120) * 1000;
    log.info(color.dim(`  watching every ${options.intervalSec ?? 120}s (Ctrl-C to stop)\n`));
    // eslint-disable-next-line no-constant-condition
    while (true) {
      await tick();
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  await tick();
  return 0;
}
