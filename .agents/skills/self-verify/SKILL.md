---
name: self-verify
description: Run the repository's own checks, record baseline and after evidence, and converge before independent review.
allowed-tools: Bash Read Write Edit Grep Glob
---

# Self-verify

1. Read `AGENTS.md` **Commands** as the source of truth. Before editing, run the available build,
   test, and lint commands or, when a full baseline is too costly, the smallest relevant check.
   Record the exact command and observed result: a feature starts from green, while a fix may
   start from a known red failure. If a check cannot run, record why rather than inventing a result.
2. After changing behavior, run focused checks and the available repository commands. For an
   asynchronous check, trigger or await a result for the current worktree or commit, then inspect
   the output; an earlier green result is not evidence for these changes.
3. If a check is red or behavior changed unintentionally, fix the root cause and rerun. Stop after
   three unsuccessful iterations. If a change needs a human decision or the checks remain red or
   unavailable, report the exact failure, attempts, and blocker; never claim verification or
   request approval on a known broken change.
4. Compare baseline to after results explicitly, check the diff for unrelated changes, and report
   any check you could not run. When a new gotcha arises, record it in an existing wiki or
   knowledge base; if none exists, report its symptom and supporting evidence to the human.
   Do not install a wiki just for this. Hand off to independent review only when the required
   verification has converged.
