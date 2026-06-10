# Task: implement the small feature

Read `SPEC.md`. The acceptance tests for the feature already exist in
`tests/feature.test.js` but are currently skipped with `test.skip(...)`. Your job is:

1. Un-skip every acceptance test (change `test.skip` to `test`).
2. Implement the feature in `src/` so the un-skipped tests pass.

Constraints:
- Do NOT invent new tests in place of the planted ones — the acceptance tests are
  the contract.
- Do NOT delete or `test.todo()` the tests.
- Keep the diff small: ≤ ~50 added lines, ≤ 3 files touched.
- Do NOT touch `package-lock.json`.
- Self-verify with `npm test` before handing off.

When done, summarize what you implemented.
