---
id: fix-failing-test
type: run
scope: patch
base_commit: HEAD
principle_focus: [5, 8]
prompt: >-
  A check in this repo is failing. Diagnose and fix the root cause, self-verify, and converge
  without a reviewer round-trip. Do not weaken the check to force a green result.
---
# Scenario: fix a failing test

## Goal
Given a single failing unit test in this repo, the harness should diagnose and fix the root cause,
self-verify, and converge without a reviewer round-trip.

## Setup
Introduce (or point the agent at) one genuinely failing test. Do not tell the agent the fix.

## Success criteria
- Identifies the root cause, not the symptom (does not delete/skip the test).
- Runs `self-verify`; the full suite is green at handoff.
- Diff is minimal and on-target.
- Records a gotcha in `.agents/wiki/` if the failure was non-obvious.

## Score these axes (see RUBRIC.md)
`correctness`, `scope`, `self_verification`, `memory`.
