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
| 1  Explicit state machine | `.agentrig/harness/state-machine.yml` |
| 2  Specialized roles, varied models | `.agentrig/agents/{developer,reviewer,judge}.{yml,md}` (reviewer runs a *different* model than the developer) |
| 3  System of record | label↔state map in the state machine + MCP GitHub server |
| 4  Skills & rules | `.agents/skills/*/SKILL.md`, `.agents/rules/` |
| 5  Self-verify before handoff | `.agents/skills/self-verify/` |
| 6  Rubric-driven evaluation | `.agentrig/eval/` + `.agents/skills/harness-eval/` |
| 7  Hermetic worktrees | `scripts/repair-worktrees.sh` |
| 8  Continuous self-improvement | `.agents/wiki/` + `.agents/skills/skill-improver/` |
| 9  Human-in-the-loop | human-only gates in the state machine |
| 10 Hard limits | `limits:` block in the state machine |
| 11 Tooling neutrality (MCP) | `.mcp.json` |
| 12 Instructions are source of truth | `AGENTS.md` with a Critical Rules block |

## Evaluating the harness itself

This is a first-class feature, not an afterthought. Every installed harness includes two layers:

- **Static audit (deterministic, no model).** Maps each principle to a structural check in
  `.agentrig/eval/checks.json`, scored `0 / 0.5 / 1.0`, producing a **Harness Score**.

  ```bash
  agentrig eval --static            # or: node .agentrig/eval/static-audit.mjs
  agentrig eval --static --min 80   # CI gate: non-zero exit below 80%
  ```

- **Dynamic behavioral eval (agentic, independent judge).** Runs benchmark scenarios
  (`.agentrig/eval/scenarios/*.md`) through the harness and scores the results against
  `.agentrig/eval/RUBRIC.md` with an **independent judge model** on Output Quality / Agent Behavior /
  Long-Term Impact. Any axis below `1.0` requires an issue code plus evidence. Results are persisted
  by `score.mjs` (never hand-edited) so you can compare scores **before and after** any prompt, skill,
  or rule change.

  ```bash
  agentrig eval --dynamic
  node .agentrig/eval/score.mjs report
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
