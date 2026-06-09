# agentrig — Agent instructions

> Managed in part by [AgentRig](https://github.com/doidor/agentrig). Sections between AgentRig markers are
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
AgentRig is an agentic *meta-harness* ("a harness of harnesses"): a Node.js/TypeScript CLI
(`npx @doidor/agentrig`) that uses an LLM agent to investigate any repository and install a best-practice
autonomous-coding-agent harness into it, then keep it updated and evaluate the harness itself. `src/`
is the CLI; `knowledge/` is the editable plain-text content that gets installed into target repos.
The 12 principles it encodes live in `knowledge/PRINCIPLES.md`.

See `.agentrig/context.md` for the full, agent-authored investigation of this repository.
<!-- AGENTRIG:context:end -->

## How to build, test, and lint
<!-- AGENTRIG:commands:start -->
- **Install:** `npm install`
- **Build:** `npm run build`  (`tsc -p tsconfig.json` → `dist/`)
- **Test:** no unit-test suite; smoke checks are the de-facto suite — `npm run build && node dist/cli.js eval --static .` (also `npm run selftest`; full list in `.agentrig/context.md`)
- **Lint:** `(none)` — none configured
<!-- AGENTRIG:commands:end -->

## Directory map
<!-- AGENTRIG:dirmap:start -->
- `src/cli.ts` — arg parsing + command dispatch.
- `src/commands/` — one file per command: `init`, `update`, `eval`, `doctor`, `dashboard`, `compile`.
- `src/agent/` — `AgentProvider` interface + `CopilotProvider` + `ClaudeProvider` + factory. **Only** place an agent SDK is imported.
- `src/core/` — `audit` (harness scoring), `install` (copy + `{{VAR}}` substitution + add-only refresh), `compile` (project canonical → every agent surface), `surfaces` (vendor symlinks), `knowledge` (manifest/principles/checks loader), `state`, `fsutil`, `logger`, `paths`.
- `src/prompts/` — agent prompt builders (investigate / tailor / update / dynamic-eval).
- `knowledge/` — **editable** best-practice content shipped with the package: `PRINCIPLES.md`, `manifest.json`, and `templates/` (every artifact installed into a target repo: agent roster, eval kit, dashboard, skills, rules).
- `dist/` — TypeScript build output (generated, git-ignored).
<!-- AGENTRIG:dirmap:end -->

## The harness
<!-- AGENTRIG:harness:start -->
- **Workflow / state machine:** `.agentrig/harness/state-machine.yml`
- **Agent roles & models:** `.agentrig/agents/` (triager, developer, reviewer, judge — each on a
  varied model; reviewer differs from developer on purpose). See `.agentrig/agents/README.md` to add
  new agent types.
- **Skills (procedural memory):** `.agents/skills/`
<!-- AGENTRIG:skills-inventory:start -->
- `self-verify`, `verify-loop`, `fix-ci`, `skill-improver`, `skill-authoring`, `harness-eval`
<!-- AGENTRIG:skills-inventory:end -->
- **Rules (reflexes, glob-scoped):** `.agents/rules/` (security, code-review, coding-standards, no-debug-logging)
- **Memory / wiki:** `.agents/wiki/` (index router + troubleshooting + entry template)
- **Orchestration contract:** `.agentrig/harness/ORCHESTRATION.md`
- **Surfaces:** `.claude`/`.copilot`/`.opencode`/`.codex` → `.agents`
- **Tooling (MCP):** `.mcp.json`
- **Dashboard:** `agentrig dashboard` (or `node .agentrig/dashboard/dashboard.mjs`) — agent roster,
  live GitHub tasks per harness label, harness score, and eval status. `--html` for a web view.
- **Evaluate the harness itself:** `agentrig eval --static` or `node .agentrig/eval/static-audit.mjs`;
  see `.agentrig/eval/RUBRIC.md`.
<!-- AGENTRIG:harness:end -->

---

## Developing AgentRig (repo-specific — survives `agentrig update`)
This repo *is* AgentRig, so a few rules go beyond the generic harness ones above:

1. **Author harness content in `knowledge/`, never hard-code it in `src/`.** `src/` is the CLI;
   everything installed into target repos lives under `knowledge/` as editable plain text.
2. **`knowledge/templates/eval/checks.json` is the single source of truth for the audit.** Both the
   CLI (`src/core/audit.ts`) and the in-repo `static-audit.mjs` interpret it. Add a matching check
   whenever you add a principle artifact, or the audit silently ignores it.
3. **Keep model access provider-neutral.** All of it goes through `AgentProvider`
   (`src/agent/provider.ts`); `@github/copilot-sdk` is imported only under `src/agent/`. A Claude
   provider must slot in without touching command logic.
4. **Every command must degrade without a model.** `eval --static`, `doctor`, `dashboard`, and
   `init --skip-agent` must never require network/model access.
5. **Bump `knowledgeVersion` (manifest) when templates change** so `agentrig update` migrates repos.
6. **Do NOT hand-edit `package.json`'s `version` or run `npm publish` manually.** Versions are
   managed by Changesets: when you change something user-visible, run `npx changeset` and commit the
   `.changeset/*.md` file with your PR. Merging to `main` opens a "Version Packages" PR; merging
   that PR publishes `@doidor/agentrig` to npm **tokenlessly via OIDC** (npm Trusted Publishing),
   with automatic provenance. See [`RELEASING.md`](RELEASING.md).
7. This file and `.agentrig/` were produced by running `agentrig init` on AgentRig itself (dogfood).
