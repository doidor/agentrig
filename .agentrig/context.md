# Repository context — AgentRig

> Agent-authored investigation of this repository. Evidence cited inline from real files.

## 1. Purpose
AgentRig is an agentic **meta-harness** ("a harness of harnesses"): a CLI (runnable via
`npx agentrig`) that uses an LLM agent to **investigate any repository** and **install a
best-practice autonomous-coding-agent harness** into it, then keep it updated and **evaluate the
harness itself** (`README.md` lines 1-16; `package.json` `description`). The harness it installs
encodes 12 principles (explicit state machine, specialized roles on varied models, GitHub as system
of record, skills/rules, self-verification, rubric-driven evaluation, hermetic worktrees, etc.)
documented in `knowledge/PRINCIPLES.md`. Users are teams/maintainers who want to stand up a
consistent, measurable agent harness across many repos without hand-rolling it each time.

## 2. Stack
- **Language:** TypeScript (`src/**/*.ts`), compiled to ESM JavaScript in `dist/`.
- **Runtime:** Node.js **≥ 20** (`package.json` `engines.node`), ES modules (`"type": "module"`).
- **Compiler/config:** TypeScript `^5.6.0`, `tsc -p tsconfig.json`; `target`/`lib` ES2022,
  `module`/`moduleResolution` NodeNext, `strict: true`, `noUncheckedIndexedAccess: true`
  (`tsconfig.json`).
- **Runtime dependencies:** `@github/copilot-sdk ^1.0.0` (agent backend), `zod ^4.3.6`
  (`package.json` `dependencies`).
- **Dev dependencies:** `typescript ^5.6.0`, `@types/node ^20.19.0`.
- **Package manager:** npm (presence of `package-lock.json`; no yarn/pnpm lockfile found).
- **Installed-harness scripts** under `knowledge/templates/` are dependency-free Node `.mjs`
  scripts (e.g. `static-audit.mjs`, `score.mjs`, `dashboard.mjs`) and shell (`*.sh`).

## 3. Commands
Cited from `package.json` `scripts` and `AGENTS.md` ("How to build, test, and lint"):

- **Install:** `npm install` (standard for npm project; `AGENTS.md` line 24). No `postinstall`/
  custom install hook.
- **Build:** `npm run build` → `tsc -p tsconfig.json` (emits to `dist/`) — `package.json` script
  `build`. Verified clean in this investigation (`npm run build` exits 0).
- **Test:** **No unit-test suite exists.** `AGENTS.md` states "no unit-test suite yet" and defines a
  **smoke-check** de-facto suite (`AGENTS.md` lines 29-38):
  ```bash
  npm run build
  node dist/cli.js --help
  node dist/cli.js eval --static .              # audit against canonical checks
  node dist/cli.js init --skip-agent /tmp/x     # deterministic install → expect Harness Score 100%
  node /tmp/x/.agentrig/eval/static-audit.mjs   # installed audit runs standalone
  node dist/cli.js dashboard /tmp/x --no-tasks  # roster + score + evals (offline)
  ```
  There is also a `selftest` script: `node dist/cli.js eval --static . || true` (`package.json`).
- **Lint:** **None configured.** No ESLint/Prettier/Biome config present; `AGENTS.md` line 27 says
  "Lint: none configured." Do not invent one.
- **Other scripts:** `dev` (`tsc --watch`), `clean` (`rm -rf dist`), `prepublishOnly`
  (`clean && build`), `start` (`node dist/cli.js`).
- **CI:** **None found** — no `.github/` directory, no `Makefile`, no other CI config.

## 4. Layout
```
src/                 CLI source (TypeScript)
  cli.ts             Arg parsing + command dispatch (init/update/eval/doctor/dashboard)
  version.ts         Package version
  commands/          One file per command: init, update, eval, doctor, dashboard
  agent/             AgentProvider interface (provider.ts) + CopilotProvider (copilot.ts) + factory
                     (index.ts). ONLY place @github/copilot-sdk is imported.
  core/              audit.ts (deterministic harness scoring), install.ts (copy + {{VAR}} subst),
                     knowledge.ts (manifest/principles/checks loader), state.ts (.agentrig/state.json),
                     fsutil.ts, logger.ts, paths.ts
  prompts/           Agent prompt builders (investigate/tailor/update/dynamic-eval) — index.ts
knowledge/           EDITABLE best-practice content shipped with the package (NOT app logic)
  PRINCIPLES.md      The 12 harness principles (canonical, editable)
  manifest.json      Declares which artifacts install where (src→dest, kind: file|dir|template)
  templates/         Every artifact installed into a target repo:
    AGENTS.md        Root instructions template with {{PLACEHOLDERS}} + AGENTRIG markers
    agents/          Roster: triager/developer/reviewer/judge {.yml,.md} + README.md (varied models)
    harness/         state-machine.yml (states, transitions, limits, human gates)
    skills/          self-verify, fix-ci, skill-improver, harness-eval (SKILL.md dirs)
    rules/           Glob-scoped reflex rules
    wiki/            Memory/gotchas
    mcp/             mcp.json (MCP tooling neutrality)
    scripts/         repair-worktrees.sh (hermetic worktrees)
    eval/            RUBRIC.md, checks.json, static-audit.mjs, score.mjs, scenarios/
    dashboard/       dashboard.mjs (roster + tasks + score + evals)
dist/                Build output (tsc emit; git-ignored)
AGENTS.md            Root agent instructions for THIS repo (source of truth)
README.md            User-facing docs
tsconfig.json        TypeScript config
package.json         Scripts, deps, bin (agentrig → dist/cli.js)
```

## 5. Conventions
- **Instructions are the source of truth.** Root `AGENTS.md` carries a "Critical Rules (read first,
  every time)" block; there is also a subproject instruction file at
  `knowledge/templates/AGENTS.md` (the installable template). Follow `AGENTS.md` over legacy code.
- **`src/` is app logic; `knowledge/` is content.** Harness best-practice content must be authored in
  `knowledge/` (plain text), never hard-coded in `src/` (`AGENTS.md` Critical Rule 1).
- **`knowledge/templates/eval/checks.json` is the single source of truth for the audit.** Both
  `src/core/audit.ts` and the installed `static-audit.mjs` interpret it; adding a principle artifact
  requires a matching check or the audit silently ignores it (`AGENTS.md` Critical Rule 2;
  confirmed by `audit.ts` importing `loadCanonicalChecks`).
- **Provider neutrality.** All model access goes through the `AgentProvider` interface
  (`src/agent/provider.ts`); `@github/copilot-sdk` must not be imported outside `src/agent/`
  (`AGENTS.md` Critical Rule 3). `AGENTRIG_PROVIDER` selects the backend (default `copilot`).
- **Offline-safe commands.** Every command must work with `--dry-run` and degrade without a model;
  `eval --static` and `doctor` must never require network/model access (`AGENTS.md` Critical Rule 4).
- **Idempotent installs.** `install.ts` does deterministic copy with `{{VAR}}` substitution;
  `AGENTS.md` template uses `<!-- AGENTRIG:*:start/end -->` markers so `update` refreshes only
  managed sections and leaves user edits intact (`knowledge/manifest.json` `merge: "markers"`).
- **TypeScript strictness.** `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `forceConsistentCasingInFileNames` are on — expect explicit null/undefined handling and
  non-null assertions in `src/`.
- **Testing pattern:** smoke checks via the built CLI (no test framework); deterministic install is
  expected to yield Harness Score 100%.
- **Versioning:** `package.json` `version` and `knowledge/manifest.json` `knowledgeVersion` are kept
  in lock-step (both `0.2.0`); bump together when changing installed artifacts.

## 6. Risks for an autonomous agent
- **Two AGENTS.md files with different scopes.** Root `AGENTS.md` governs this CLI repo;
  `knowledge/templates/AGENTS.md` is a *template* full of `{{PLACEHOLDERS}}` and AGENTRIG markers
  that gets installed into *other* repos. Do not "fix" placeholders/markers in the template — they
  are intentional.
- **`knowledge/` is shipped content, not dead code.** Editing `knowledge/` changes what every target
  repo receives. `tsconfig.json` excludes `knowledge/`, so the TypeScript build will NOT catch
  errors there; the `.mjs`/`.sh`/`.yml` templates are unlinted and untyped. Validate template
  changes via the smoke checks (deterministic install + static audit), not the compiler.
- **checks.json coupling.** Adding/removing an installed artifact without updating
  `knowledge/templates/eval/checks.json` makes the audit silently miss it (and can drop the expected
  100% score). Keep manifest, templates, and checks in sync.
- **SDK import boundary.** Importing `@github/copilot-sdk` anywhere outside `src/agent/` violates the
  provider-neutrality rule; keep it isolated.
- **No CI / no lint / no unit tests.** There is no automated gate in the repo — correctness rests on
  the manual smoke checks. An agent must run those itself before handoff; nothing else will.
- **`dist/` is generated** (git-ignored). Never hand-edit `dist/`; always rebuild from `src/`.
- **Network/model-dependent steps.** Agentic commands (`init` tailoring, `eval --dynamic`) need
  Copilot access; they are not runnable offline. Use `--skip-agent` / `eval --static` for
  deterministic, no-model verification.
- **`.agentrig/results/` is git-ignored** (`.gitignore`); eval result artifacts are not committed —
  do not rely on them being present, and never hand-edit aggregated eval JSON (`score.mjs` owns it).
