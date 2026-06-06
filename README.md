# AgentRig

**An agentic meta-harness — a harness of harnesses.**

AgentRig is a lightweight CLI that uses an AI agent to **investigate a repository** and **install a
best-practice agent harness** into it — the orchestration, prompts, skills, rules, memory, and
**evaluation** that let autonomous coding agents reliably triage → implement → review → judge →
merge with minimal babysitting. It keeps context of what the repo is about, can **update** the
harness as best practices evolve, and always installs a way to **evaluate the harness itself**.

```bash
npx agentrig init        # investigate this repo and install a tailored harness
npx agentrig eval        # score the harness (deterministic, no model needed)
npx agentrig update      # pull in the latest best practices
npx agentrig doctor      # quick health check
```

---

## Why

Modern autonomous-agent setups converge on the same dozen principles (explicit state machine,
specialized roles on varied models, GitHub as system of record, skills + rules, self-verification,
rubric-driven evaluation, hermetic worktrees, continuous self-improvement, human gates, hard limits,
MCP tooling neutrality, instructions-as-source-of-truth). Standing all of that up by hand, per repo,
is tedious and drifts. AgentRig encodes the principles once as **editable plain text** and installs
them anywhere — and, crucially, ships the tooling to **measure** whether your harness is actually
good and whether a change made it better or worse.

The principles are documented in [`knowledge/PRINCIPLES.md`](knowledge/PRINCIPLES.md).

## How it works

`agentrig init` runs three phases:

1. **Investigate (agentic).** An agent (via the GitHub Copilot SDK) explores the repo and writes an
   evidence-based `.agentrig/context.md`: purpose, stack, real build/test/lint commands, layout,
   conventions, and risks for an autonomous agent.
2. **Install (deterministic).** The canonical harness artifacts from `knowledge/` are copied in,
   guaranteeing a baseline that passes the audit regardless of the model.
3. **Tailor (agentic).** The same conversation — so it keeps repo context — fills in `AGENTS.md`,
   rewrites the baseline rules for your stack, and adapts the eval scenarios to your real commands.

Run with `--skip-agent` to install the canonical harness deterministically with no model, or
`--dry-run` to preview.

## What gets installed

| Principle | Artifact |
|----------:|----------|
| 1  Explicit state machine | `.agentrig/harness/state-machine.yml` + `ORCHESTRATION.md` (trigger taxonomy, event_to_state, reconciliation/recovery, CAS transitions) |
| 2  Specialized roles, varied models | `.agentrig/agents/{triager,developer,reviewer,judge}.{yml,md}` on distinct `model_tiers` (cheap/standard/premium) + `README.md` |
| 3  System of record | label↔state map + reconciliation/recovery cadences + MCP GitHub server + `agentrig dashboard` |
| 4  Skills & rules | `.agents/skills/*/SKILL.md` (incl. `verify-loop`, `skill-authoring`), `.agents/rules/` (security, code-review, …, priority-ordered) |
| 5  Self-verify before handoff | `.agents/skills/self-verify/` + generalized `verify-loop/` |
| 6  Rubric-driven evaluation | `.agentrig/eval/` (axes.json registry, multi-rubric lifecycle, sandbox, A/B) + `.agents/skills/harness-eval/` |
| 7  Hermetic worktrees | `scripts/repair-worktrees.sh` (add + safe archive-before-reset repair) |
| 8  Continuous self-improvement | `.agents/wiki/` (index router + troubleshooting + entry template) + `skill-improver` |
| 9  Human-in-the-loop | human-only gates in the state machine |
| 10 Hard limits | `limits:` + `runaway_token_cap` in the state machine |
| 11 Tooling neutrality (MCP) | `.mcp.json` + `.claude`/`.copilot`/`.opencode`/`.codex` → `.agents` symlinks |
| 12 Instructions are source of truth | `AGENTS.md` (Critical Rules + auto-generated skills inventory) + package-local AGENTS.md |

## Evaluating the harness itself

This is a first-class feature, not an afterthought. Every installed harness includes two layers:

- **Static audit (deterministic, no model).** Maps each principle to a structural check in
  `.agentrig/eval/checks.json`, scored `0 / 0.5 / 1.0`, producing a **Harness Score**.

  ```bash
  agentrig eval --static            # or: node .agentrig/eval/static-audit.mjs
  agentrig eval --static --min 80   # CI gate: non-zero exit below 80%
  ```

- **Dynamic behavioral eval (agentic, independent judge).** Runs benchmark scenarios
  (`.agentrig/eval/scenarios/*.md`) through the harness and scores the results with an **independent
  judge model**. Scoring is rigorous, modeled on epichan: a registry (`axes.json`) of bounded
  **issue codes per axis**, strict `0/0.5/1.0` tiers, mandatory evidence, confidence-gated rollups
  recomputed from the axis data, and three **lifecycle rubrics** (`spec` / `run` / `review`) linked
  by task id. `score.mjs` validates everything and never lets a judge invent codes.

  ```bash
  agentrig eval --dynamic --scenario add-small-feature --timeout 60
  node .agentrig/eval/score.mjs report
  node .agentrig/eval/score.mjs compare --scenario add-small-feature   # A/B a harness change
  ```

  Run the **same scenario** before and after a prompt/skill/rule change under different
  `--variant`s, then `compare` — a change that lowers the score is a regression even if it "feels"
  better. Runs are sandboxed (`eval/sandbox/eval-rules.md`): no push, no PR, no merge.

## Dashboard

`agentrig dashboard` gives you a single-glance view of the harness — installed into every repo as a
dependency-free script (`.agentrig/dashboard/dashboard.mjs`), so it runs with or without the global
CLI:

- **Agent roster** — every role and the model it runs on.
- **Live GitHub tasks** — open issues/PRs carrying each harness label, grouped by workflow state and
  showing assignees, fetched via the `gh` CLI (degrades gracefully when `gh` is absent/unauthed).
- **Harness Score** — the latest static-audit score and any weak principles.
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
| `agentrig init [path]` | Investigate + install a tailored harness |
| `agentrig update [path]` | Re-sync the latest best practices |
| `agentrig eval [path] [--static\|--dynamic] [--min N] [--json]` | Evaluate the harness |
| `agentrig dashboard [path] [--html [file]] [--no-tasks] [--json]` | Roster, live GitHub tasks, score, evals |
| `agentrig doctor [path] [--json]` | Health check (installed? agent reachable? score?) |

Common options: `--model <id>`, `--dry-run`, `--skip-agent`, `--verbose`.
Set `AGENTRIG_PROVIDER` to choose the agent backend (default `copilot`).

## Requirements

- Node.js ≥ 20.
- For agentic steps: GitHub Copilot access. Sign in once with the `copilot` CLI, or set `GH_TOKEN`.
  Deterministic commands (`eval --static`, `doctor`, `init --skip-agent`) need no model.

## Provider neutrality

Model access is behind the `AgentProvider` interface (`src/agent/provider.ts`). Today AgentRig ships
a `CopilotProvider` built on `@github/copilot-sdk`; a Claude SDK provider can be added without
touching command logic.

## License

MIT
