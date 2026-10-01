---
name: fix-ci
description: Diagnose and fix a failing CI run for the current branch, then re-verify.
allowed-tools: Bash Read Write Edit Grep Glob
---

# Fix CI

1. Inspect logs for the failing run and confirm they belong to the current branch and commit.
   Capture the failing command and output before editing.
2. Reproduce with the smallest relevant check from `AGENTS.md` **Commands**; distinguish a code
   failure from an unrelated environment or infrastructure failure.
3. Fix the root cause without disabling tests or weakening checks. Use `self-verify` to run
   relevant commands and compare the before and after states, including any asynchronous CI
   result for the new commit. Stop after three unsuccessful iterations and report the blocker.
4. Record a newly discovered gotcha in an existing wiki or knowledge base; if none exists, report
   the failing command, observed output, and prevention to the human instead. Do not install a
   wiki just for this. Sharpen an existing instruction if it would have prevented the failure.
