---
name: verify-loop
description: General wait → inspect → fix (max 3) → self-park loop for any post-action verification (build, tests, CI, visual, lint).
triggers:
  - after pushing changes / before requesting review
  - "an async check (CI, visual, e2e) needs to be waited on and acted upon"
allowed-tools: Bash Read Grep Glob
argument-hint: "[--max-iterations N] [--check <command-or-workflow>]"
---

# verify-loop (principle 5, generalized)

A reusable decision loop for converging on *any* verification signal before handoff. Generalizes the
visual-self-verify pattern to builds, tests, CI runs, lint, or e2e.

## Loop
1. **Trigger** the check (or wait for the async one pinned to your own HEAD — never trust a stale
   result from an earlier commit).
2. **Inspect** the result:
   - **Green / no unintended change →** *continue* (proceed to review/handoff).
   - **Red / unintended change →** go to step 3.
   - **Intended but human-gated change →** *self-park* (see below). Do not iterate.
3. **Fix** the root cause and re-run. Cap at **N = 3** iterations (default).
4. **After N failures →** stop iterating and take a recovery path: self-park with a precise note, or
   escalate. Do not loop indefinitely.

## Self-park
When the right next step needs a human (low reversibility, an intended diff behind a human-only
gate, or repeated failure), leave a clear note describing what you saw and what you tried, move the
task to `parked`, and **never apply the human-only label yourself**.

## Notes
- Pin every check to your current HEAD.
- Record any new gotcha in `.agents/wiki/`.
- This is the engine behind `self-verify`; use `verify-loop` whenever the signal is asynchronous.
