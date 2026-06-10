# AgentRig

[![CI](https://github.com/doidor/agentrig/actions/workflows/ci.yml/badge.svg)](https://github.com/doidor/agentrig/actions/workflows/ci.yml)
[![Release](https://github.com/doidor/agentrig/actions/workflows/release.yml/badge.svg)](https://github.com/doidor/agentrig/actions/workflows/release.yml)
[![Docs](https://github.com/doidor/agentrig/actions/workflows/docs.yml/badge.svg)](https://doidor.github.io/agentrig)
[![npm](https://img.shields.io/npm/v/@doidor/agentrig)](https://www.npmjs.com/package/@doidor/agentrig)
[![node](https://img.shields.io/node/v/@doidor/agentrig)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**An agentic meta-harness — a harness of harnesses.** [Read the docs →](https://doidor.github.io/agentrig)

AgentRig is a lightweight CLI that installs a **best-practice agent harness** into any repository and
then **projects it into every agent's native format** — so *any* agent benefits without lock-in,
**local and remote**:

- **Local CLIs** — Copilot CLI, Claude Code, OpenCode, Codex, Cursor.
- **Remote / cloud** — the web **GitHub Copilot coding agent** (create an issue, assign it to
  Copilot, walk away).

You keep **one** source of truth (`AGENTS.md` + rules + skills); AgentRig compiles it into
`copilot-instructions.md`, `.github/instructions/`, `CLAUDE.md`, `.cursor/rules/`, MCP configs, and a
`copilot-setup-steps.yml` for the cloud agent. It also keeps everything in sync as best practices
evolve, and ships a way to **evaluate the harness itself**.

```bash
npx @doidor/agentrig init        # investigate this repo, install a tailored harness, compile all surfaces
npx @doidor/agentrig compile     # re-project AGENTS.md + rules into every agent surface (local + remote)
npx @doidor/agentrig eval        # score the harness (deterministic, no model needed)
npx @doidor/agentrig update      # pull in the latest best practices
```

> Or install it globally — `npm i -g @doidor/agentrig` — and run `agentrig <command>`.
> Examples below use the `agentrig` command for brevity.

---

## Why

Modern autonomous-agent setups converge on the same dozen principles (explicit state machine,
specialized roles on varied models, GitHub as system of record, skills + rules, self-verification,
rubric-driven evaluation, hermetic worktrees, continuous self-improvement, human gates, hard limits,
**one canonical source projected to every surface**, instructions-as-source-of-truth). Standing all
of that up by hand, per repo, per agent tool, is tedious and drifts. AgentRig encodes the principles
once as **editable plain text**, installs them anywhere, **projects them to every agent surface**,
and ships the tooling to **measure** whether your harness is actually good.

The principles are documented in [`knowledge/PRINCIPLES.md`](knowledge/PRINCIPLES.md).

## How it works

`agentrig init` runs these phases:

1. **Investigate (agentic).** An agent explores the repo and writes an evidence-based
   `.agentrig/context.md`: purpose, stack, real build/test/lint commands, layout, conventions, risks.
2. **Install (deterministic).** The canonical harness artifacts from `knowledge/` are copied in,
   guaranteeing a baseline that passes the audit regardless of the model.
3. **Tailor (agentic).** The same conversation — keeping repo context — fills in `AGENTS.md`,
   rewrites the baseline rules for your stack, and adapts the eval scenarios.
4. **Compile (deterministic).** Projects `AGENTS.md` + rules into every agent surface, local and
   remote (see [Surfaces](#surfaces)).

Run with `--skip-agent` to install + compile deterministically with no model, or `--dry-run` to
preview.

## Surfaces

One canonical source → every agent's native format (`agentrig compile`, also run by `init`/`update`):

| Agent | Generated surface |
|-------|-------------------|
| **GitHub Copilot — coding agent (web) + IDE** | `.github/copilot-instructions.md`, `.github/instructions/*.instructions.md` (`applyTo` from rule globs), `.github/workflows/copilot-setup-steps.yml` |
| **Claude Code** | `CLAUDE.md` (imports `@AGENTS.md`) + `.claude/` skills |
| **Cursor** | `.cursor/rules/*.mdc` (globs + `alwaysApply`) |
| **OpenCode / Codex** | `AGENTS.md` (native) |
| **MCP (any)** | `.mcp.json`, `.vscode/mcp.json`, `.github/copilot/mcp.json` |

Edit the **source** (`AGENTS.md`, `.agents/rules/`) and re-run `agentrig compile` — never hand-edit
the generated files. Commit them so remote agents (and teammates' tools) pick them up.

> **`copilot-setup-steps.yml` is authored per-repo.** During `agentrig init`, the agent inspects
> your real stack (runtimes/versions, package manager, install commands, caching, services) and
> writes a genuine setup workflow so the GitHub Copilot **cloud agent** has a ready environment — not
> a generic stub. After the first scaffold it's yours; `compile`/`update` won't overwrite it.
> (With `--skip-agent`, a heuristic scaffold is generated as a fallback.) AgentRig **validates** the
> workflow (job name, `runs-on`/`steps`, `timeout-minutes ≤ 59`, tabs, and — when available — a real
> YAML parse + `actionlint`) during `compile`/`init` and in `agentrig doctor`, so a broken file is
> caught before you push. GitHub also runs it as an Actions workflow on push for final validation.

## What gets installed

| Principle | Artifact |
|----------:|----------|
| 1  Explicit state machine | `.agentrig/harness/state-machine.yml` + `ORCHESTRATION.md` (a workflow *contract* for whatever runtime you use) |
| 2  Specialized roles, varied models | `.agentrig/agents/{triager,developer,reviewer,judge}.{yml,md}` on distinct `model_tiers` + `README.md` |
| 3  System of record | label↔state map + reconciliation/recovery cadences + MCP GitHub server + `agentrig dashboard` |
| 4  Skills & rules | `.agents/skills/*/SKILL.md` (incl. `verify-loop`, `skill-authoring`), `.agents/rules/` (security, code-review, …, priority-ordered) |
| 5  Self-verify before handoff | `.agents/skills/self-verify/` + generalized `verify-loop/` |
| 6  Rubric-driven evaluation | `.agentrig/eval/` (axes.json registry, multi-rubric lifecycle, sandbox, A/B) + `.agents/skills/harness-eval/` |
| 7  Hermetic worktrees | `scripts/repair-worktrees.sh` (add + safe archive-before-reset repair) |
| 8  Continuous self-improvement | `.agents/wiki/` (index router + troubleshooting + entry template) + `skill-improver` |
| 9  Human-in-the-loop | human-only gates in the state machine |
| 10 Hard limits | `limits:` + `runaway_token_cap` in the state machine |
| 11 One source → every surface | the compiler: `copilot-instructions.md`, `.github/instructions/`, `CLAUDE.md`, `.cursor/rules/`, MCP configs, `copilot-setup-steps.yml` |
| 12 Instructions are source of truth | `AGENTS.md` (Critical Rules + auto-generated skills inventory) + package-local AGENTS.md |

## Evaluating the harness itself

This is a first-class feature, not an afterthought — and it's **repo-specific and runnable by you**.
The eval kit installs into your repo (`.agentrig/eval/`) and is tailored to it during `init`, so you
can measure whether AgentRig actually helps *here*. `agentrig eval` **defaults to the full agentic,
harness-on run**; add `--static` for the fast no-model audit. Three layers, each making a different
**bounded** claim:

- **Layer A1 — install completeness** (deterministic, no model). Every canonical artifact present
  where the manifest says it should be. This is what CI gates on.

- **Layer A2 — quality probes** (deterministic, no model). Cheap content sanity: parseable YAML,
  no unfilled `{{PLACEHOLDER}}` in `AGENTS.md`, every skill carries the required frontmatter,
  developer/reviewer use **different model families** (not just different ids), `axes.json` has an
  issue code per axis. Diagnostic — surfaces drift without failing the build.

  ```bash
  agentrig eval --static            # both A1 and A2; prints sections separately
  agentrig eval --static --min 80   # CI gate on A1 (Install Completeness)
  ```

- **Layer B — dynamic behavioral eval** (agentic, **isolated** producer + judge, fixture-based).
  For each scenario in `.agentrig/eval/scenarios/*/`:
  1. Seed a throwaway worktree from `scenarios/<id>/fixture/`.
  2. Producer model runs `prompt.md` in the worktree.
  3. **Deterministic oracle** (`scenarios/<id>/oracle.yml`) scores hard axes (correctness, tests,
     scope, regression_risk) by running commands and inspecting the diff. No LLM.
  4. **Judge model** — a *different family* from the producer — runs in its own cwd with
     `prompt.md` + `diff.patch` + `transcript.md` + `oracle.json`. It does NOT see the producer's
     worktree or reasoning trace. It writes scores to a JSON file the orchestrator validates.
  5. `score.mjs save` enforces tier (`0`/`0.5`/`1.0`), issue code, evidence, **veto axes**
     (correctness, gate_compliance — cosmetics can never paper over a real regression), and
     **producer/judge family divergence** (override is recorded so reviewers can spot it).

  ```bash
  agentrig eval --dynamic                                    # defaults: developer.yml + reviewer.yml models
  agentrig eval --dynamic --producer-model claude-sonnet-4.5 --judge-model gpt-5.4   # explicit override
  agentrig eval --dynamic --scenario fix-failing-test --n 5
  agentrig eval --rubric          # print rubric (axes, codes, scenarios) without running
  node .agentrig/eval/score.mjs report
  ```

  By default, the producer model is read from `.agentrig/agents/developer.yml` and the judge from
  `.agentrig/agents/reviewer.yml` — the install-completeness audit already enforces these come
  from different model families. Override with explicit flags or `AGENTRIG_PRODUCER_MODEL` /
  `AGENTRIG_JUDGE_MODEL` env vars.

### Does the harness actually help? (statistical harness lift)

Prove the harness earns its keep in *your* repo by running each scenario **with** and **without**
it, **with multiple paired trials** (single-trial deltas are coin flips):

```bash
agentrig eval --dynamic --scenario <id> --variant harness  --n 5
agentrig eval --dynamic --scenario <id> --variant baseline --n 5
node .agentrig/eval/score.mjs compare --scenario <id> --baseline baseline
```

`compare --baseline` pairs trial *i* of harness with trial *i* of baseline, computes the **median
delta** and a **binomial sign-test p-value**, and prints one of three verdicts:

- **HELPS** — p < 0.05 and median > 0.05 (the harness measurably improves behavior here)
- **HURTS** — p < 0.05 and median < -0.05 (regression — investigate before merging the change)
- **INCONCLUSIVE** — n < 3, p ≥ 0.05, or effect smaller than ±0.05 (need more trials)

A "HELPS" verdict on a real fixture, in a different model family than the judge, is the only thing
that justifies the line "AgentRig improved agent behavior on this repo." Anything less is honest
**inconclusive**.

### Calibrating the judge

A lazy judge that returns 1.0 on every axis passes every save validation but tells you nothing.
`.agentrig/eval/calibration/` ships hand-labeled rubric instances; `score.mjs calibrate` runs the
judge over them and reports % within ±0.5 tier + signed bias. `agentrig doctor` flags any judge
below **80% agreement**. See `.agentrig/eval/calibration/README.md` for the format.

### Scope honesty

The static audit verifies install completeness, not "is this harness good." The dynamic eval, with
a calibrated judge and ≥5 paired trials, gives you a statistical signal of behavior change between
variants — but it's still measuring agent + model behavior on synthetic fixtures, not your real
PR workload. Treat green checks as evidence, not certainty.

## Dashboard

`agentrig dashboard` gives you a single-glance view of the harness — installed into every repo as a
dependency-free script (`.agentrig/dashboard/dashboard.mjs`), so it runs with or without the global
CLI:

- **Agent roster** — every role and the model it runs on.
- **Live GitHub tasks** — open issues/PRs carrying each harness label, grouped by workflow state and
  showing assignees, fetched via the `gh` CLI (degrades gracefully when `gh` is absent/unauthed).
- **Install Completeness + Quality Probes** — the latest static-audit scores and any weak principles.
- **Evals** — the latest dynamic-eval summary.
- **Limits** — the hard caps from the state machine.

```bash
agentrig dashboard                 # terminal view
agentrig dashboard --json          # machine-readable
agentrig dashboard --html dash.html  # self-contained web page
agentrig dashboard --no-tasks      # offline (skip gh lookups)
```


## Editing the best practices

All best practices are plain text under [`knowledge/`](knowledge/). Edit `PRINCIPLES.md`, the
templates, or `checks.json`, then propagate to any repo:

```bash
agentrig update        # re-sync the latest canonical artifacts, reconciling local customizations
```

`update` refreshes AgentRig-owned files in place and asks the agent to merge changes into files you
customize (like `AGENTS.md`), preserving your repo-specific facts.

## Commands

| Command | Description |
|---------|-------------|
| `agentrig init [path]` | Investigate + install a tailored harness, then compile surfaces. **Non-destructive by default** — preserves existing AGENTS.md / .mcp.json / .agents/rules; `--force` to overwrite |
| `agentrig compile [path]` | Project AGENTS.md + rules into every agent surface (local + remote) |
| `agentrig update [path]` | Re-sync the latest best practices (re-compiles surfaces) |
| `agentrig eval [path] [--static\|--rubric] [--scenario id] [--variant name] [--n trials] [--producer-model id] [--judge-model id]` | Evaluate the harness (default: agentic; `--static` for the cheap CI-safe audit; `--rubric` shows what's measured) |
| `agentrig dashboard [path] [--html [file]] [--no-tasks] [--json]` | Roster, live GitHub tasks, score, evals |
| `agentrig doctor [path] [--json]` | Health check (installed? agent reachable? score?) |

Common options: `--model <id>`, `--dry-run`, `--skip-agent`, `--force` (init only), `--verbose`.
Set `AGENTRIG_PROVIDER` to choose the agent backend (default `copilot`).

## Requirements

- Node.js ≥ 22 (Node 20 is EOL; tested on the current LTS lines, 22 and 24).
- For agentic steps, pick a provider:
  - **Copilot (default):** GitHub Copilot access — sign in once with the `copilot` CLI, or set `GH_TOKEN`.
  - **Claude (`AGENTRIG_PROVIDER=claude`):** install the optional `@anthropic-ai/claude-agent-sdk`
    and set `ANTHROPIC_API_KEY`.
- Deterministic commands (`eval --static`, `doctor`, `dashboard`, `init --skip-agent`) need no model.

## Provider neutrality

Model access is behind the `AgentProvider` interface (`src/agent/provider.ts`), and the SDK is only
imported under `src/agent/`. Two backends ship today, selected by `AGENTRIG_PROVIDER`:
- `copilot` (default) — `CopilotProvider` on `@github/copilot-sdk`.
- `claude` — `ClaudeProvider` on the optional `@anthropic-ai/claude-agent-sdk` (`query()` + session
  resume for multi-turn context). Install the SDK and set `ANTHROPIC_API_KEY` to use it.

## Releasing

Releases are automated by [Changesets](https://github.com/changesets/changesets) +
[`.github/workflows/release.yml`](.github/workflows/release.yml). The day-to-day flow:

1. `npx changeset` → pick **patch/minor/major** + a one-line summary; commit it with your PR.
2. Merge to `main` → the workflow opens a **"Version Packages"** PR that bumps the version and
   updates `CHANGELOG.md`.
3. Merge that PR → the workflow publishes `@doidor/agentrig` to npm **tokenlessly via OIDC**
   (npm Trusted Publishing), with **automatic provenance**, and pushes the `vX.Y.Z` git tag.

No `NPM_TOKEN` secret, no manual `npm version`/`npm publish`. Setup (Trusted Publisher on
npmjs.com, Actions PR permission) is in [`RELEASING.md`](RELEASING.md).

## License

MIT
