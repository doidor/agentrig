# Scenario: the reviewer catches a planted bug

Tests **the review process**, not the implementation. The fixture has two commits:

1. `baseline` — known-good pagination util.
2. `change`   — a small patch that includes one **planted, genuine bug** plus a
   couple of cosmetic touch-ups.

The reviewer agent must produce `review.json` with the structure documented in
`prompt.md`. The oracle then checks:

- The reviewer flagged the **right line range** as a bug.
- The flag has `severity: "blocking"`.
- The reviewer did NOT block on the innocuous changes.

Soft axes (severity_calibration, coverage, actionability, independence) need the
LLM judge.
