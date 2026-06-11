---
"@doidor/agentrig": patch
---

Harness content quality fixes (consistency + dedup), applied to the canonical templates and the
dogfooded harness:

- Fix the invalid `model_tier: high` in every agent role → `premium` (matches each role's pinned
  model and the `cheap`/`standard`/`premium` vocabulary the state machine defines). Behavior is
  unchanged — only the label was wrong.
- `rules/coding-standards.md` now declares `priority: 3`, as `rules/README.md` requires of every
  rule.
- The `harness-eval` skill gains a `triggers:` block, for parity/discoverability with the other
  skills.
- `skill-authoring` and `skill-improver` add `Write` to `allowed-tools` so they can actually create
  the files they describe.
- De-duplicate the wiki docs: `README.md` owns policy (tiers + admission test) and points at
  `_TEMPLATE.md` for the entry format; `index.md` is now router/index-only.

Internal (no user-facing behavior change): the agent prompt copy moved out of
`src/prompts/index.ts` into `src/prompts/templates/*.md`, read at runtime — assembled output is
byte-identical to before.
