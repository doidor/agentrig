---
name: log-gotcha
description: Record a concrete gotcha in an existing knowledge base or report evidence to the human when none exists.
allowed-tools: Bash Read Write Edit Grep Glob
---

# Log a gotcha

When a non-obvious behavior, failure, or instruction gap affects your work, use an existing wiki
or knowledge base immediately. If none exists, report the observed behavior, supporting evidence,
and prevention to the human; do not install a wiki just for this skill.

1. If a knowledge base exists, search it for an existing entry. Improve that entry if it already
   covers the issue; do not add duplicate advice or style preferences.
2. If a knowledge base exists and no entry covers the issue, create a short entry with the
   observed symptom, actual cause, fix, and one-line prevention. Follow the repository's existing
   format and index; in this repository, use `.agents/wiki/_TEMPLATE.md` and
   `.agents/wiki/index.md`.
3. If a rule or skill should have prevented the same failure, sharpen that instruction and check
   whether the new wording would have changed the original outcome.
4. Verify a wiki entry is in your diff when there is a wiki; otherwise include the evidence in
   your handoff. Do not wait until after handoff to record or report the gotcha.
