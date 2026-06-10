---
name: self-verify
description: Run the project's own build/test/lint and converge before handing work to a reviewer. Requires explicit baseline → after evidence — the suite must be shown to change state, not just be "green at the end".
triggers:
  - before requesting review
  - before opening a PR
allowed-tools: Bash Read Grep Glob
argument-hint: "[--max-iterations N]"
---

# self-verify (principle 5)

After producing changes, **verify your own work before handoff**. Do not invoke the reviewer until
this loop converges.

## Steps (do them in order; do not skip)

1. **Baseline.** Run the install/build/test/lint commands from `AGENTS.md`'s `commands` block
   **once before you make any edit related to the failing symptom**. Capture the result:
   - For a fix scenario: confirm the suite is RED in the expected way (the target test fails).
   - For a feature scenario: confirm the suite is GREEN (so you know your changes are what break it
     if it goes red later).
   - Surface this baseline in your transcript — e.g. *"baseline: `npm test` → 1 fail (divide-by-zero)"*.

2. **Iterate.** Make the change; re-run the commands. Cap at **N=3** iterations.

3. **After.** Re-run the full suite at the end and surface the new state explicitly —
   e.g. *"after fix: `npm test` → 0 fails, all 4 tests pass"*. The transition from baseline → after
   is the evidence that your work did what you claim. Reporting only "tests pass" without the
   baseline is half a self-verification.

4. **Self-park if still red.** Leave a precise note (what failed, what you tried) and move the task
   to `parked`. Never hand a red build to a reviewer.

## Handoff checklist (run BEFORE you declare done)

- [ ] Baseline output captured + surfaced in transcript
- [ ] After output captured + surfaced in transcript
- [ ] Diff is on-target (no unrelated churn — check `git diff --stat`)
- [ ] **Did you hit any non-obvious behavior or surprise?** → run the `log-gotcha` skill before
  handing off. This includes silently-passing-yet-wrong APIs, JS-floating-point quirks, framework
  defaults that bit you, environment surprises, etc. Wiki entries are how the next agent avoids
  repeating your discovery.

## Notes

- Pin verification to your own HEAD; do not trust stale CI from an earlier commit.
- If the build is too expensive to run a full baseline (10+ min), at minimum run the **smallest
  set of tests that demonstrates the symptom** before AND after your fix.
