# Agent wiki index

This wiki holds learned gotchas, not current policy or repeated documentation.

## What belongs where
| Kind of knowledge | Goes in |
|-------------------|---------|
| A gotcha / non-obvious failure + its fix | **this wiki** (`.agents/wiki/<slug>.md`) |
| A repeatable procedure ("how to do X") | a skill (`.agents/skills/`) |
| A passive, always-on constraint | a rule (`.agents/rules/`) |
| Repo-wide policy / critical rules | `AGENTS.md` |
| Common error → fix lookups | [`troubleshooting.md`](./troubleshooting.md) |

If a gotcha becomes a reusable procedure, **promote it to a skill** and leave a one-line pointer
here.

## Index
_Add a one-line link per entry as you create it, newest first._
- [markdown-link-shapes](./markdown-link-shapes.md) — valid rule links may use code labels,
  inline titles, or references.
- [optional-wiki-core-profile](./optional-wiki-core-profile.md) — core prompts and skills must
  not make an optional knowledge base a hidden prerequisite.
- [removed-skills-leave-empty-directories](./removed-skills-leave-empty-directories.md) —
  deleting a skill file does not remove its directory from the working tree.
- [frontmatter-adjacent-fields](./frontmatter-adjacent-fields.md) — probe frontmatter by field and
  normalize whitespace when checking wrapped prose.
- [apply-patch-partial-updates](./apply-patch-partial-updates.md) — a failed multi-file patch can
  leave earlier hunks applied; inspect status and retry only pending hunks.
- [skills-inventory-populator-enumerates-disk](./skills-inventory-populator-enumerates-disk.md) —
  historical lesson from the former CLI: preserve user-added assets rather than assuming a fixed
  manifest enumerates them.
