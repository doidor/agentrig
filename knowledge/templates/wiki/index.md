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

## What makes a good entry
- **Good:** a greppable title, a concrete symptom (real error text), the true root cause, the exact
  fix, a one-line prevention — and, where useful, PR/commit provenance under `## Related`.
- **Weak (don't add):** a restatement of the docs, a vague "be careful with X", or a near-duplicate
  of an existing entry — **sharpen the existing entry instead** (see the admission test in
  `README.md`).

## Index
_Add a one-line link per entry as you create it, newest first._
- (none yet)

---
Wiki **policy** (tiers + admission test) lives in `README.md`; the **entry format** lives in
`_TEMPLATE.md`. Don't restate them here.
