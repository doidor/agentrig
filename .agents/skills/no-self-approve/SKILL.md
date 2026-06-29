---
name: no-self-approve
description: Never cast an approving review on a PR your own (shared) agent identity authored — approval must come from an independent reviewer.
triggers:
  - before voting / approving on a PR
  - reviewer or judge about to approve
allowed-tools: Bash Read Grep Glob
---

# no-self-approve (principles 9, 10)

Harness agents often authenticate with **one shared bot identity**. Casting an **approve** on a PR
that identity authored — including any harness-created PR on an `agent/<id>/…` branch — is a
**self-approval**: invalid, because approval must come from an independent reviewer (another agent on
the same identity cannot supply it either).

## Rules
- **Always post your review comments / findings** — that work is valuable regardless of who authored
  the PR.
- **Never** cast an approving vote (`approve` / approve-with-suggestions) on a PR authored by your
  own identity. If your verdict is "approve" but you authored it, **abstain** and note that
  independent approval is required.
- Negative verdicts (request changes / reject) on your own PR are fine — you may always ask for
  changes to your own work.

## How to check before approving
- Compare the PR author to your own identity. For GitHub:
  `gh pr view <pr> --json author -q .author.login` vs `gh api user -q .login`.
- If they match (or the branch is an `agent/…` branch you produced), **do not approve — abstain**.
- Prefer a deterministic `pre_merge` gate that rejects `approver == author`, so a slip can never
  merge. This skill is wired into `pre_merge` in the state machine.
