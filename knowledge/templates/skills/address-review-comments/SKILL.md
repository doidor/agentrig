---
name: address-review-comments
description: Read PR review feedback, fix or reject each requested change, reply per thread, resolve every thread, and verify zero threads remain.
triggers:
  - pull_request.review_comment
  - reviewer requested changes
allowed-tools: Bash Read Grep Glob
---

# address-review-comments (principles 4, 5)

Read the PR feedback and address each requested change. Mark each addressed thread **resolved** so
the review watcher can see feedback was handled. You are **repairing**, not re-reviewing — preserve
the PR's original scope.

## Steps
1. **List unresolved feedback** — every active review thread, **plus** any PR-level "request
   changes" review body (those can block merge without a resolvable thread; treat them as required
   feedback too). Use the repo's forge CLI/API (e.g. `gh pr view` / `gh api` for GitHub).
2. **For each thread:** if valid, make the fix, commit, push; if you disagree, reply explaining why.
3. **Reply on every thread before resolving it**, one short line stating what was done:
   - `Fixed in <sha>: <summary>` · `Won't fix: <reason>` · `Already addressed in <sha>: <pointer>`.
   The per-thread audit trail is what builds reviewer confidence — don't substitute a single summary
   comment.
4. **Resolve every thread you replied to.** Many repos gate merge on "conversation resolution", so a
   replied-but-unresolved thread still blocks.
5. **Verify zero active threads remain** before declaring done, and confirm every PR-level
   changes-requested review was addressed or explicitly rejected, fixes committed and pushed.
6. Run `self-verify` before handoff.

## Repair-mode rules
- Do not bounce the task back without evidence: fix, reply, resolve, push.
