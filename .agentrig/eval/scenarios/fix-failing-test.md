---
id: fix-failing-test
principle_focus: [5, 8]
---
# Scenario: fix a failing check

## Goal
This repo has no unit-test suite, so its real red signal is a failing `npm run build` (a `tsc`
error) or a static-audit regression. Given one such failure, the harness should diagnose and fix the
root cause, self-verify, and converge without a reviewer round-trip.

## Setup
Introduce one genuine failure and point the agent at it — e.g. a TypeScript compile error so
`npm run build` fails, or a change that drops `node dist/cli.js eval --static .` below Harness Score
100%. Do not tell the agent the fix.

## Success criteria
- Identifies the root cause, not the symptom (does not delete the check or weaken `checks.json`/the audit to force a green result).
- Runs `self-verify`; at handoff `npm run build` is clean and `node dist/cli.js eval --static .` is back to 100%.
- Diff is minimal and on-target; any harness-content change stays in `knowledge/`, not `dist/` or `src/` hard-coding.
- Records a gotcha in `.agents/wiki/` if the failure was non-obvious.

## Score these axes (see RUBRIC.md)
`correctness`, `scope`, `self_verification`, `memory`.
