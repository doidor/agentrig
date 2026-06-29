---
name: resolve-conflicts
description: Rebase the PR branch onto the default branch, resolve conflicts keeping both intents, and verify mergeability before pushing.
triggers:
  - conflict_detected
  - PR branch is behind / not mergeable
allowed-tools: Bash Read Grep Glob
---

# resolve-conflicts (principles 4, 7)

Rebase the existing PR branch onto the default branch and resolve conflicts. You are **repairing**,
not reviewing — do not bounce the task back without resolving and pushing.

## Steps
1. **Fetch and rebase** onto the default branch. Do not merge the default branch into the PR branch
   unless a human explicitly asks for a merge commit.
2. **Resolve each conflict** keeping the intent of *both* changes.
3. **Apply repo-local workflow skills** if any match this repo's merge / validation / release flow.
4. **Verify mergeability** — run the smallest test set that covers the touched files, with concise
   output (e.g. `-q` / `--tb=short`) to avoid flooding context.
5. **Continue the rebase, then push** the existing PR branch.
6. Leave the branch rebased onto, and mergeable with, the default branch.

## Repair-mode rules
- Do not declare done without resolving and pushing the fix.
- If the conflict cannot be resolved safely, explain the blocker on the PR, then move the task to
  `parked`. Run `self-verify` before handoff.
