# AgentRig — Agent instructions

## Critical Rules (read first, every time)
1. **AgentRig installs harnesses into *other* repos.** Code under `src/` is the CLI; everything
   under `knowledge/` is the **plain-text best-practice content** that gets installed into target
   repos. Never hard-code harness content in `src/` — author it in `knowledge/`.
2. **`knowledge/templates/eval/checks.json` is the single source of truth for the audit.** Both the
   CLI (`src/core/audit.ts`) and the in-repo `static-audit.mjs` interpret it. If you add a principle
   artifact, add a matching check here, or the audit silently ignores it.
3. **The agent abstraction must stay provider-neutral.** All model access goes through
   `AgentProvider` (`src/agent/provider.ts`). Today only `CopilotProvider` exists; a Claude provider
   will be added. Do not import `@github/copilot-sdk` outside `src/agent/`.
4. **Every command must work with `--dry-run` and degrade without a model.** `eval --static` and
   `doctor` must never require network/model access.
5. **Self-verify before handoff:** `npm run build` must be clean and the smoke checks below must pass.

## What this repository is
AgentRig is an agentic *meta-harness* — "a harness of harnesses". It is a CLI (runnable via
`npx agentrig`) that uses an LLM agent (via the GitHub Copilot SDK) to **investigate any repository**
and **install a best-practice agent harness** into it, then keep it updated and **evaluate the
harness itself**. The 12 principles it encodes live in `knowledge/PRINCIPLES.md`.

## How to build, test, and lint
- **Install:** `npm install`
- **Build:** `npm run build` (`tsc -p tsconfig.json` → `dist/`)
- **Test:** no unit-test suite yet; verify with the smoke checks below.
- **Lint:** none configured.

### Smoke checks (the de-facto test suite)
```bash
npm run build
node dist/cli.js --help
node dist/cli.js eval --static .            # audits against canonical checks
# In a throwaway repo:
node dist/cli.js init --skip-agent /tmp/x   # deterministic install → expect Harness Score 100%
node /tmp/x/.agentrig/eval/static-audit.mjs # installed audit script runs standalone
node dist/cli.js dashboard /tmp/x --no-tasks # roster + score + evals (offline)
```

## Directory map
- `src/cli.ts` — arg parsing + command dispatch.
- `src/commands/` — `init`, `update`, `eval`, `doctor`, `dashboard`.
- `src/agent/` — `AgentProvider` interface + `CopilotProvider` + factory. **Only place the SDK is imported.**
- `src/core/` — `knowledge` (manifest/principles loader), `install` (deterministic copy + `{{VAR}}`
  substitution), `audit` (deterministic harness scoring), `state` (`.agentrig/state.json`), `fsutil`,
  `logger`, `paths`, `version`.
- `src/prompts/` — agent prompt builders (investigate / tailor / update / dynamic-eval).
- `knowledge/` — **editable best practices** shipped with the package:
  - `PRINCIPLES.md` — the 12 principles.
  - `manifest.json` — what gets installed and where.
  - `templates/` — every artifact installed into a target repo, including the agent roster
    (`templates/agents/`: triager/developer/reviewer/judge on varied models), the **eval kit**
    (`templates/eval/`: `RUBRIC.md`, `checks.json`, `static-audit.mjs`, `score.mjs`, `scenarios/`),
    and the **dashboard** (`templates/dashboard/dashboard.mjs`).

## How the harness self-evaluation works (the emphasis)
Installed into every target repo under `.agentrig/eval/` and `.agents/skills/harness-eval/`:
- **Layer A — static audit** (`static-audit.mjs`, deterministic, no model): maps each principle to a
  structural check in `checks.json`, scored 0/0.5/1.0 → a Harness Score. Also runnable as
  `agentrig eval --static`.
- **Layer B — dynamic eval** (agentic): run `scenarios/*.md` through the harness, score against
  `RUBRIC.md` with an independent judge model, aggregate with `score.mjs` (never hand-edit results).

When you change a principle or template, update `knowledge/` (not `src/`), keep `checks.json` in
sync, rebuild, and re-run the smoke checks.
