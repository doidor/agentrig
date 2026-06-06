---
name: skill-improver
description: Turn a reviewer/judge failure into an instruction-surface change that passes a prevention test.
triggers:
  - "a mistake recurred"
  - "reviewer feedback points at a missing rule/skill"
allowed-tools: Read Edit Grep Glob
argument-hint: "<short description of the failure>"
---

# skill-improver (principle 8)

Every mistake is a prompt bug. Convert it into a durable instruction change.

## Procedure
1. Identify the **instruction surface** that should have prevented the failure (a rule, a skill, or
   `AGENTS.md` Critical Rules).
2. Propose the minimal wording change.
3. **Prevention test (mandatory):** would this new wording have changed the *original* failure? If
   not, the change is rejected.
4. **Admission test:** does an existing rule already cover this? If yes, do not duplicate — sharpen
   the existing one. Duplication is what kills wikis.
5. Record the gotcha in `.agents/wiki/` (central, committed) or the local wiki if repo-specific.
