# Scenario: implement a small, well-specified feature

The fixture ships a `SPEC.md` describing one small feature and a test file with
acceptance tests `it.skip()`-ed out. The producer agent must:

1. Read `SPEC.md`.
2. Un-skip every acceptance test in `tests/feature.test.js`.
3. Implement the feature in `src/` so all tests pass.

## Oracle
- `correctness`: full suite (`npm test`) exits 0 — the new tests run *and* pass.
- `tests`: no `it.skip` remains in the acceptance file (must be activated).
- `scope`: ≤ 50 added lines, ≤ 3 files touched, no churn in `package-lock.json`.

## What a defect looks like
The agent deletes the acceptance tests, marks them `it.todo()`, or invents new
ones instead of activating the planted ones. Oracle catches all three.
