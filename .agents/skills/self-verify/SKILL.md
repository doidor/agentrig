---
name: self-verify
description: Run the project's own build/test/lint and converge before handing work to a reviewer.
triggers:
  - before requesting review
  - before opening a PR
allowed-tools: Bash Read Grep Glob
argument-hint: "[--max-iterations N]"
---

# self-verify (principle 5)

After producing changes, **verify your own work before handoff**. Do not invoke the reviewer until
this loop converges.

## Steps
1. Run the install/build/test/lint commands recorded in `AGENTS.md` (the `commands` block).
2. If all green → **continue** to review.
3. If red → read the failure, fix, and re-run. Cap at **N=3** iterations (default).
4. If still red after N → **self-park**: leave a precise note (what failed, what you tried) and
   move the task to `parked`. Never hand a red build to a reviewer.

## Notes
- Pin verification to your own HEAD; do not trust stale CI from an earlier commit.
- Record any new gotcha in `.agents/wiki/`.
