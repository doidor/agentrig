---
name: fix-ci
description: Diagnose and fix a failing CI run for the current branch, then re-verify.
triggers:
  - check_suite.completed.failure
  - "user asks to fix CI / a red build"
allowed-tools: Bash Read Grep Glob
argument-hint: "[run-url|run-id]"
---

# fix-ci (principles 5, 8)

1. Fetch the failing job logs (prefer `gh run view --log-failed`).
2. Reproduce locally with the smallest command that fails.
3. Fix the root cause — not the symptom. Avoid disabling tests to go green.
4. Re-run `self-verify`. Iterate up to 3 times; otherwise self-park.
5. If a rule or skill should have prevented this failure, run `skill-improver`.
