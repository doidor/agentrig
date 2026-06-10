# Scenario: fix a failing test (deterministic)

A unit test in `fixture/` is genuinely broken. The producer agent must:

1. Run the test suite to see what's red.
2. Fix the **root cause** in `fixture/src/`.
3. Re-run the suite and confirm green.
4. NOT delete or weaken the test.

The oracle (`oracle.yml`) deterministically verifies the outcome:

- `correctness`: `npm test` exits 0 in the worktree.
- `tests`: the test file is still present (no deletion / no `it.skip`).
- `scope`: diff ≤ 30 added lines, ≤ 3 files touched, all under `src/` or `tests/`.
- `regression_risk`: no other test file modified.

Soft axes (`self_verification`, `memory`, `clarity`) are scored by the LLM judge
using the producer's transcript + diff.
