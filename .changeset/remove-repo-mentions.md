---
"@doidor/agentrig": patch
---

Remove internal source-repo references from harness content. Drops the "Synthesized from …"
provenance line in `PRINCIPLES.md` and the upstream attribution comments in the installed harness
and eval templates (`state-machine.yml`, `ORCHESTRATION.md`, `eval/axes.json`, `eval/score.mjs`,
`scripts/repair-worktrees.sh`). Bumps `knowledgeVersion` so `agentrig update` refreshes these files
in consuming repos.
