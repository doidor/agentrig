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
- [optional-assets-hidden-from-llms](./optional-assets-hidden-from-llms.md) — publish the
  retained library so an agent following one URL can choose optional assets.
- [markbook-preview-port](./markbook-preview-port.md) — Markbook 0.6 preview binds
  `dev.port + 1000`, so check the actual listener.
- [preview-server-lifecycle](./preview-server-lifecycle.md) — a successful docs build does not
  mean a localhost preview server is still running.
- [docsite-asset-triggers](./docsite-asset-triggers.md) — include every published Core source
  in Docs workflow triggers to prevent stale site assets.
- [docsite-core-links](./docsite-core-links.md) — changing documentation link mapping requires
  validating both the new URL shape and its published target.
- [markbook-template-comment](./markbook-template-comment.md) — exclude preserved layout
  comments when checking rendered template slots.
- [pages-pr-permissions](./pages-pr-permissions.md) — isolate Pages/OIDC write access from
  untrusted pull-request builds.
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
