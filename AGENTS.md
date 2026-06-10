# agentrig — Agent instructions

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
- **Skills (procedural memory):** `.agents/skills/` (the block below is auto-populated on `agentrig compile` / `update` by walking this directory — both AgentRig-bundled and user-added skills appear)
<!-- AGENTRIG:skills-inventory:start -->
- `fix-ci` — Diagnose and fix a failing CI run for the current branch, then re-verify.
- `harness-eval` — Evaluate THIS repository's agent harness — a deterministic structure audit (A1) plus content quality probes (A2), plus an isolated producer/judge dynamic eval (B) with paired sign-test A/B variant comparison.
- `log-gotcha` — Record a newly-discovered gotcha to `.agents/wiki/` BEFORE handoff — the harness's feedback loop. The wiki is how the next agent doesn't repeat your discovery.
- `markbook-add-component-page` — Generate one Markbook docs page (frontmatter + :::props + :::stories) for a single component file.
- `markbook-bulk-generate` — Generate Markbook docs pages for every component under a directory. Dry-run by default — produces a candidate list for confirmation before writing anything.
- `markbook-bundle-story` — Produce a portable bundle of one Markbook story (embed or package mode) and walk through embedding it in an external host page.
- `markbook-init` — Scaffold a new Markbook documentation site in the current project — generates markbook.config.ts, a sample docs page + story, and suggests package.json scripts.
- `markbook-layout` — Create or modify an HTML layout file for a Markbook site — gives you a known-good shell with all required `{{ }}` placeholders wired up, and registers it in markbook.config.ts.
- `markbook-style` — Apply a pre-baked visual preset (minimal / vibrant / corporate / github / nord) to a Markbook site. Writes a CSS file of --mb-* token overrides and wires it into markbook.config.ts.
- `self-verify` — Run the project's own build/test/lint and converge before handing work to a reviewer. Requires explicit baseline → after evidence — the suite must be shown to change state, not just be "green at the end".
- `skill-authoring` — Admission bar and structure for writing a new skill, so the skill library stays lean and discoverable.
- `skill-improver` — Turn a reviewer/judge failure into an instruction-surface change that passes a prevention test.
- `verify-loop` — General wait → inspect → fix (max 3) → self-park loop for any post-action verification (build, tests, CI, visual, lint).
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
