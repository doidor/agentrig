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

## Tiers (principle 8)
1. **Central wiki (this dir, committed):** repo-wide, reviewed gotchas. CODEOWNERS-gate it.
2. **Local wiki (git-ignored `*.local.md`):** machine/contributor-specific notes.
3. **Session scratch:** ephemeral working notes; never a substitute for the wiki.

## Index
_Add a one-line link per entry as you create it, newest first._
- (none yet)

## Admission test (strict — duplication kills wikis)
Before adding an entry, confirm no existing entry covers it. If one does, **sharpen it** instead of
adding a near-duplicate. Use the format in `_TEMPLATE.md`.
