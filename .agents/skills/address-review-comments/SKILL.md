---
name: address-review-comments
description: Address every review thread and top-level change request with a fix or reasoned reply, then check remaining feedback.
allowed-tools: Bash Read Write Edit Grep Glob
---

# Address review comments

1. Read all unresolved review threads and top-level changes-requested review bodies. Record each
   concrete request, including those without a resolvable thread; keep fixes within the task scope.
2. Fix valid findings and explain disagreements with evidence. Follow the repository's
   `AGENTS.md` **Commands** through `self-verify` before reporting a fix as verified.
3. When authorized to update the pull request, reply to each thread with the fix or reason for
   declining, then resolve eligible threads. Do not substitute a single summary comment for
   per-thread replies or make unauthorized commits, pushes, or upstream changes.
4. Recheck active threads and top-level requests. Report any that remain and why; claim completion
   only when all requested feedback has been addressed and every resolvable thread is resolved.
