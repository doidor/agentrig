---
name: resolve-conflicts
description: Resolve an authorized branch conflict without discarding either change and verify the result.
allowed-tools: Bash Read Write Edit Grep Glob
---

# Resolve conflicts

1. Confirm the target branch and authorization before fetching, rebasing, or pushing. Inspect the
   worktree; do not discard unrelated or uncommitted changes.
2. If authorized, rebase the existing branch onto the intended base. Resolve each conflict by
   preserving both changes' intent, not by automatically choosing one side. Ask for a decision
   when the two intended behaviors are incompatible.
3. Continue the rebase, verify mergeability where available, and use `self-verify` with the
   repository's `AGENTS.md` **Commands**. Report the observed results.
4. Push only when explicitly authorized; if a rebased branch requires it, use a guarded
   `--force-with-lease`, never an unguarded force push. If blocked, state the exact remaining
   conflict or upstream action instead of claiming completion.
