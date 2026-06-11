# Agent wiki — index & routing

This wiki holds **learned gotchas and war stories** — durable lessons an agent discovered the hard
way. It is **not** a mirror of the docs or skills.

## What belongs where
| Kind of knowledge | Goes in |
|-------------------|---------|
| A gotcha / non-obvious failure + its fix | **this wiki** (`.agents/wiki/<slug>.md`) |
| A repeatable procedure ("how to do X") | a skill (`.agents/skills/`) |
| A passive, always-on constraint | a rule (`.agents/rules/`) |
| Repo-wide policy / critical rules | `AGENTS.md` |
| Common error → fix lookups | `troubleshooting.md` (in this dir) |

If a gotcha becomes a reusable procedure, **promote it to a skill** and leave a one-line pointer
here.

## Index
_Add a one-line link per entry as you create it, newest first._
- [skills-inventory-populator-enumerates-disk](./skills-inventory-populator-enumerates-disk.md) — `AGENTRIG:<name>` populators that mirror user-extensible dirs must walk the disk, not the manifest.

---
Wiki **policy** (tiers + admission test) lives in `README.md`; the **entry format** lives in
`_TEMPLATE.md`. Don't restate them here.
