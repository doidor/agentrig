# {{REPO_NAME}} — Agent instructions

> Managed in part by [AgentRig](https://github.com/doidor/agentrig). Sections between AgentRig markers are
> refreshed by `agentrig update`; edit outside the markers (and the repo-specific context) freely.

## Critical Rules (read first, every time)
<!-- AGENTRIG:critical-rules:start -->
1. **Instructions are the source of truth, not existing code.** This repo may contain legacy
   patterns that predate current standards. When code and these instructions disagree, follow the
   instructions and flag the discrepancy.
2. **Log every gotcha to `.agents/wiki/` the moment you hit it — not at the end, not in passing.**
   Every mistake is a prompt bug; the wiki is how the harness learns. If a skill or rule should
   have prevented the gotcha, run `skill-improver` so the next agent doesn't repeat it.
3. **Self-verify before handoff.** Run the project's build/test/lint and the `self-verify` skill
   before you mark work ready. Never hand a red build to a reviewer.
4. **Never skip a state-machine gate** (`.agentrig/harness/state-machine.yml`) and never apply a
   human-only label. Low-reversibility actions are recommend-then-apply.
5. **Respect hard limits** (diff size, review iterations, token cap) declared in the state machine.
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
<!-- AGENTRIG:skills-inventory:start -->
{{SKILLS_INVENTORY}}
<!-- AGENTRIG:skills-inventory:end -->
- **Rules (reflexes, glob-scoped):** `.agents/rules/`
- **Memory / wiki:** `.agents/wiki/` (see `index.md` for what belongs where)
- **Tooling (MCP):** `.mcp.json`
- **Agent surfaces (compiled):** `agentrig compile` projects this file + `.agents/rules/` into every
  agent's native format — `.github/copilot-instructions.md` & `.github/instructions/` (Copilot, web +
  IDE), `CLAUDE.md` (Claude Code), `.cursor/rules/` (Cursor), `.vscode/mcp.json`, and
  `.github/workflows/copilot-setup-steps.yml`. Edit the source here, not the generated files.
- **Surfaces:** `.claude` / `.copilot` / `.opencode` / `.codex` symlink to `.agents` so any vendor CLI
  sees the same skills/rules/wiki.
- **Orchestration contract:** `.agentrig/harness/ORCHESTRATION.md`
- **Dashboard:** `agentrig dashboard` (or `node .agentrig/dashboard/dashboard.mjs`) — agent roster,
  live GitHub tasks per harness label, harness score, and eval status. `--html` for a web view.
- **Evaluate the harness itself:** `agentrig eval --static` or `node .agentrig/eval/static-audit.mjs`;
  see `.agentrig/eval/RUBRIC.md`.
- **Package-local instructions:** drop an `AGENTS.md` in a subpackage to add scope-specific rules;
  it augments this root file. See `.agentrig/AGENTS.package.example.md`.
<!-- AGENTRIG:harness:end -->
