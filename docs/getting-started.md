---
title: Getting started
description: Install AgentRig and scaffold a best-practice agent harness in any repo in under a minute.
order: 1
---

# Getting started

Five minutes from zero to a fully-projected agent harness in any repository.

## 1. Run `init` (no install required)

In any repository — fresh or existing — run:

```bash
npx @doidor/agentrig init
```

This is a one-shot scaffold: AgentRig investigates the repo, picks a model tier for each agent role, and installs the canonical harness:

```
.agentrig/
├── PRINCIPLES.md          ← your editable copy of the 12 principles
├── agents/                ← role-specific prompts (triager, developer, reviewer, judge…)
├── harness/
│   ├── state-machine.yml  ← the explicit DAG every agent must respect
│   └── ORCHESTRATION.md   ← contract between roles
├── eval/                  ← rubric, axes, scenarios for harness evaluation
└── dashboard/             ← live HTML dashboard (agent roster + GitHub tasks + scores)
.agents/
├── rules/                 ← glob-scoped reflex rules (security, no-debug-logging, …)
├── skills/                ← procedural memory (self-verify, skill-improver…)
└── wiki/                  ← tiered memory (index + troubleshooting + per-area notes)
AGENTS.md                  ← repo-wide canonical agent instructions (the source of truth)
.mcp.json                  ← MCP server registry (GitHub, etc.)
scripts/                   ← hermetic per-agent worktree script, etc.
```

…**plus** the projected files for every surface (Copilot, Claude, Cursor, Codex, OpenCode, VS Code MCP, and `copilot-setup-steps.yml`). [See agent surfaces →](./agent-surfaces.html)

### Flags worth knowing

- `--skip-agent` — install the canonical harness deterministically without any agentic exploration. Use this in CI or for reproducible installs.
- `--dry-run` — show every file that would be written, without writing anything.
- `--yes` — non-interactive mode (no prompts).
- `--model <id>` — pick the model for the investigation step (e.g. `claude-sonnet-4.5`, `gpt-5`).

## 2. Review the output

After `init`:

```bash
npx @doidor/agentrig doctor
```

Outputs the installation state, the **Harness Score** (0–100% — see [evals](./evals.html)), and validates `copilot-setup-steps.yml`. On a fresh install you should see 100% / 35 checks.

```text
AgentRig — doctor

  harness installed : yes
  knowledge version : 0.3.x
  harness score     : 100%
  setup-steps.yml   : valid
  agent (copilot)   : authenticated as you (user)
```

## 3. Edit `AGENTS.md` and re-project

`AGENTS.md` is the canonical agent guide for *your* repo. Edit it freely. Then:

```bash
npx @doidor/agentrig compile
```

This re-projects the full `AGENTS.md` body — plus every glob-scoped rule in `.agents/rules/` — into every agent surface (`.github/copilot-instructions.md`, `CLAUDE.md`, `.cursor/rules/*.mdc`, `.github/instructions/*.instructions.md`, MCP). It's idempotent — run it as often as you want; user-owned files like `copilot-setup-steps.yml` are never clobbered.

## 4. Pull in newer best practices

When you upgrade AgentRig itself (or want to refresh the canonical files):

```bash
npx @doidor/agentrig update
```

Refreshes `.agentrig/PRINCIPLES.md`, manifest-managed files, the harness scaffolding — but preserves your local edits to `AGENTS.md`, `.agents/rules/`, `.agents/wiki/`, and anything else you marked custom.

Check for drift before running:

```bash
npx @doidor/agentrig update --diff
```

## 5. Evaluate

Once the harness is installed, you can measure whether it actually helps:

```bash
npx @doidor/agentrig eval
```

Defaults to the **full agentic run** — runs your installed scenarios through both the canonical harness and a no-harness baseline, then scores both on the [eval rubric](./evals.html). Use `--static` for a fast deterministic structural audit (no model calls — safe for CI).

```bash
# Just the structure (CI-safe, deterministic, no model)
npx @doidor/agentrig eval --static --min 80
```

The `--min` flag exits non-zero if the Harness Score drops below the threshold — perfect for blocking merges that would weaken the harness.

## Provider auth

AgentRig defaults to the **GitHub Copilot CLI provider**, so the only auth you need is `gh auth login` (which most engineers already have). Switch via `AGENTRIG_PROVIDER` if you want a different backend.

## What's next

- [Commands reference →](./commands.html) — every command and flag.
- [Agent surfaces →](./agent-surfaces.html) — which files project where.
- [Evaluating the harness →](./evals.html) — full rubric, scenarios, "does this actually help" lift measurement.
