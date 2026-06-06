# {{REPO_NAME}} — Agent instructions

> Managed in part by [AgentRig](https://github.com/). Sections between AgentRig markers are
> refreshed by `agentrig update`; edit outside the markers (and the repo-specific context) freely.

## Critical Rules (read first, every time)
<!-- AGENTRIG:critical-rules:start -->
1. **Instructions are the source of truth, not existing code.** This repo may contain legacy
   patterns that predate current standards. When code and these instructions disagree, follow the
   instructions and flag the discrepancy.
2. **Self-verify before handoff.** Run the project's build/test/lint and the `self-verify` skill
   before you mark work ready. Never hand a red build to a reviewer.
3. **Never skip a state-machine gate** (`.agentrig/harness/state-machine.yml`) and never apply a
   human-only label. Low-reversibility actions are recommend-then-apply.
4. **Respect hard limits** (diff size, review iterations, token cap) declared in the state machine.
5. **Every mistake is a prompt bug.** When you hit a gotcha, record it in `.agents/wiki/` and, if a
   skill or rule should have prevented it, run `skill-improver`.
<!-- AGENTRIG:critical-rules:end -->

## What this repository is
<!-- AGENTRIG:context:start -->
{{REPO_SUMMARY}}

See `.agentrig/context.md` for the full, agent-authored investigation of this repository.
<!-- AGENTRIG:context:end -->

## How to build, test, and lint
<!-- AGENTRIG:commands:start -->
- **Install:** `{{INSTALL_CMD}}`
- **Build:** `{{BUILD_CMD}}`
- **Test:** `{{TEST_CMD}}`
- **Lint:** `{{LINT_CMD}}`
<!-- AGENTRIG:commands:end -->

## Directory map
<!-- AGENTRIG:dirmap:start -->
{{DIRECTORY_MAP}}
<!-- AGENTRIG:dirmap:end -->

## The harness
<!-- AGENTRIG:harness:start -->
- **Workflow / state machine:** `.agentrig/harness/state-machine.yml`
- **Agent roles & models:** `.agentrig/agents/` (triager, developer, reviewer, judge — each on a
  varied model; reviewer differs from developer on purpose). See `.agentrig/agents/README.md` to add
  new agent types.
- **Skills (procedural memory):** `.agents/skills/`
- **Rules (reflexes, glob-scoped):** `.agents/rules/`
- **Memory / wiki:** `.agents/wiki/`
- **Tooling (MCP):** `.mcp.json`
- **Dashboard:** `agentrig dashboard` (or `node .agentrig/dashboard/dashboard.mjs`) — agent roster,
  live GitHub tasks per harness label, harness score, and eval status. `--html` for a web view.
- **Evaluate the harness itself:** `agentrig eval --static` or `node .agentrig/eval/static-audit.mjs`;
  see `.agentrig/eval/RUBRIC.md`.
<!-- AGENTRIG:harness:end -->
