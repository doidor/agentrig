---
title: Commands
description: Every AgentRig CLI command and flag.
order: 2
---

# Commands

> Examples use `agentrig` as shorthand for `npx @doidor/agentrig`. `path` defaults to cwd.
> All commands are idempotent.

## `init`

Investigate the repo and install a best-practice agent harness. **Non-destructive by default** —
existing `AGENTS.md`, `.mcp.json`, and `.agents/rules/` content is preserved.

```bash
agentrig init [path]
```

| Flag | Purpose |
| --- | --- |
| `--force` | Overwrite preserved user files with canonical templates. |
| `--skip-agent` | Deterministic install — no agentic exploration. CI-safe. |
| `--dry-run` | Show every file as `(new)`, `(preserve existing)`, or `(OVERWRITE)` without writing. |
| `--yes` | Non-interactive (skip all prompts). |
| `--model <id>` | Model for the investigation step (e.g. `claude-sonnet-4.6`, `gpt-5.5`). |
| `--verbose` | Stream the agent's exploration. |

## `update`

Re-sync newer best practices into an existing harness. Refreshes manifest-managed files
(`PRINCIPLES.md`, harness scaffolding) while preserving `AGENTS.md`, `.agents/rules/`, and
`.agents/wiki/`.

```bash
agentrig update [path]
```

- `--diff` — show how preserved files have drifted from canonical (no writes).
- `--skip-agent` — update without the agentic step.
- `--dry-run` — print changes only.

## `compile`

Project `AGENTS.md` + `.agents/rules/` into every agent surface
(`.github/copilot-instructions.md`, `.github/instructions/`, `CLAUDE.md`, `.cursor/rules/`,
MCP configs). No flags — always runs the full projection.

```bash
agentrig compile [path]
```

## `eval`

Evaluate the harness itself. Defaults to the full agentic run; use `--static` for a fast,
deterministic structural audit (Layer A1 + A2).

```bash
agentrig eval [path]
```

| Flag | Purpose |
| --- | --- |
| `--static` | Structural completeness + quality probes only — no model. CI-safe. |
| `--scaffold` | Generate repo-specific scenarios via an agent turn (use `--scaffold-count N`, default 2). |
| `--rubric` | Print measured axes + issue codes + installed scenarios. |
| `--scenario <id>` | Run only one scenario. |
| `--variant <name>` | Tag the run (`harness` vs `baseline`) for paired-trial lift comparison. |
| `--producer-model <id>` | Model that executes the scenario task (default: `.agentrig/agents/developer.yml` model). |
| `--judge-model <id>` | Model that scores soft axes — **must be a different family** than the producer (default: `.agentrig/agents/reviewer.yml` model). |
| `--allow-same-family` | Override the producer/judge family check (recorded in every result). |
| `--n <int>` | Trials per scenario (default 1 single, 5 in baseline mode). |
| `--seed <int>` | Reproducibility seed (passed through where supported). |
| `--timeout <min>` | Cap per agent turn (default 45). |
| `--min <pct>` | (with `--static`) Exit non-zero if Install Completeness < threshold. |
| `--json` | Machine-readable output. |

[Evaluating the harness →](./evals.html)

## `doctor`

Health check — harness installed? agent provider reachable? current Install Completeness +
Quality Probes scores? Any judge below the 80% calibration agreement threshold?

```bash
agentrig doctor [path]      # --json for machine output
```

## `dashboard`

Agent roster, live GitHub tasks (when available), latest Install Completeness + Quality Probes
scores, recent eval runs.

```bash
agentrig dashboard [path]
```

- `--html [file]` — write a self-contained HTML dashboard (default `.agentrig/dashboard/dashboard.html`).
- `--no-tasks` — skip GitHub lookups (offline).

---

**Global:** `--verbose` · `-h, --help` · `-v, --version`
**Env:** `AGENTRIG_PROVIDER` (default `copilot`)
