---
name: skill-authoring
description: Admission bar and structure for writing a new skill, so the skill library stays lean and discoverable.
triggers:
  - "create / add a new skill"
  - "this procedure keeps coming up"
allowed-tools: Read Write Edit Grep Glob
argument-hint: "<skill-name>"
---

# skill-authoring (principle 4, 8)

Skills are procedural memory. A bloated skill library is as useless as no library, so new skills
must clear an admission bar.

## Admission test (all must hold)
1. **Reusable, not one-off.** It encodes how to do *one recurring thing* well — not a single task.
2. **Not already covered.** Search `.agents/skills/`; if an existing skill is close, **sharpen it**
   instead of adding a near-duplicate.
3. **A procedure, not a reflex.** Passive, always-on constraints belong in `.agents/rules/`, not a
   skill.

## Structure
- `SKILL.md` with YAML frontmatter: `name`, a `description` **< 250 chars**, `triggers`,
  `allowed-tools` (scope the blast radius), and an optional `argument-hint`.
- Body: short, imperative steps. Cap iteration loops and state the fallback.
- Put long reference material in a sibling `references/` file and link to it, so the skill itself
  stays small and the agent loads detail only on demand.
- Scope `allowed-tools` to the minimum (e.g. `Bash Read Grep Glob`).

## Keep surfaces in sync
When you add or remove a skill, update the skills inventory in `AGENTS.md` (the
`AGENTRIG:skills-inventory` block) so every surface advertises the same set. If the repo mirrors
skills across vendor dirs (`.claude`/`.copilot`/`.agents`/…), they should all point at one canonical
source (AgentRig wires these as symlinks).
