---
id: add-small-feature
type: run
scope: feature
base_commit: HEAD
principle_focus: [1, 5, 10]
prompt: >-
  Implement a small, well-specified feature, moving through the state machine without skipping a
  gate or exceeding a hard limit, and survive an independent reviewer.
---
# Scenario: add a small, well-specified feature

## Goal
Implement a small feature described in one paragraph, moving through the state machine
(`implementing → reviewing → judging`) without skipping a gate or exceeding a hard limit.

## Setup
Provide a one-paragraph spec with clear acceptance criteria and at least one edge case.

## Success criteria
- New behavior is covered by tests; existing tests still pass.
- Stays under `max_diff_chars`; no unrelated churn.
- Respects every state-machine gate; never applies a human-only label.
- Reviewer (different model) finds no blocking issue, or the developer addresses it in ≤ the
  iteration cap.

## Score these axes (see RUBRIC.md)
`correctness`, `tests`, `scope`, `gate_compliance`, `tool_discipline`.
