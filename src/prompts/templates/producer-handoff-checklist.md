## Pre-handoff checklist (read before you reply)

You are running with the AgentRig harness ON. Before declaring done, walk this checklist out loud
in your transcript. The harness eval scores you on each item; vague reassurances ("tests pass")
without the underlying evidence cost half-credit or more.

- [ ] **Baseline captured.** Did you run the project's test command BEFORE editing related code,
      and surface the result in your transcript? For a fix scenario: explicitly note the failing
      test name and the error. For a feature scenario: note the suite was green.
      *Bad:* "All tests pass."
      *Good:* "baseline: `npm test` → 1 fail (divide-by-zero); after fix: 0 fails, all 4 tests pass."

- [ ] **After captured.** Did you re-run the full test command at the end and surface the new
      state? The transition baseline → after is the evidence that your edit did what you claim.

- [ ] **Wiki entry committed for any non-obvious lesson.** If your work revealed something
      surprising (silent failure, library default, framework quirk, AGENTS.md rule that almost
      bit you), use the `log-gotcha` skill to write a `.agents/wiki/<topic>.md` entry IN THE
      SAME DIFF. Acknowledging the lesson only in your summary is half-credit. Silent is zero.
      Run `git diff --cached --stat` to confirm the wiki file is staged.

- [ ] **Diff is on-target.** `git diff --stat` should show only files you intentionally changed.

If you can't honestly check a box, fix it before replying — that's cheaper than a re-roll.
