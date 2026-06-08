---
title: Commands
description: Every AgentRig CLI command and flag, with examples.
order: 2
---

# Commands

```bash
npx @doidor/agentrig <command> [path] [options]
```

`path` defaults to the current working directory. All commands are idempotent.

## `init`

Investigate the repo and install a best-practice agent harness. **Non-destructive by default** — if you already have an `AGENTS.md`, `.mcp.json`, custom rules in `.agents/rules/`, etc., those are preserved and reported in the summary. Pass `--force` to opt into overwriting.

```bash
npx @doidor/agentrig init [path]
```

| Flag | Purpose |
| --- | --- |
| `--force` | Overwrite existing user content with the canonical templates. Off by default — `init` is safe to run on a repo that already has agent content. |
| `--skip-agent` | Install the canonical harness deterministically — no agentic exploration. Use in CI or for reproducible installs. |
| `--dry-run` | Print every file that would be written or preserved, without writing. Shows `(new)`, `(preserve existing)`, or `(OVERWRITE)` per file. |
| `--yes` | Non-interactive (skips all confirmation prompts). |
| `--model <id>` | Model for the agentic investigation (e.g. `claude-sonnet-4.5`, `gpt-5`). |
| `--verbose` | Stream the agent's exploration as it runs. |

What lands in the repo: a full `.agentrig/`, `.agents/`, `AGENTS.md` (unless preserved), `.mcp.json` (unless preserved), projected surfaces for every agent ecosystem, plus a stack-aware `copilot-setup-steps.yml`. See [agent surfaces →](./agent-surfaces.html).

## `update`

Re-sync the latest best practices into an existing harness — refreshes manifest-managed files (`PRINCIPLES.md`, harness scaffolding) while preserving your local edits (`AGENTS.md`, `.agents/rules/`, `.agents/wiki/`).

```bash
npx @doidor/agentrig update [path]
```

| Flag | Purpose |
| --- | --- |
| `--diff` | Show how your preserved files have drifted from canonical (no writes). |
| `--skip-agent` | Update without any agentic step. |
| `--dry-run` | Print what would change, without writing. |

## `compile`

Project `AGENTS.md` and `.agents/rules/` into every agent surface — `.github/copilot-instructions.md`, `.github/instructions/`, `CLAUDE.md`, `.cursor/rules/`, MCP configs, and `copilot-setup-steps.yml`.

```bash
npx @doidor/agentrig compile [path]
```

No flags — `compile` is intentionally simple. It always runs the full projection and validates the generated `copilot-setup-steps.yml`. Re-runnable as often as you want; user-owned files are never clobbered.

The full `AGENTS.md` body is mirrored into the projected files (with the H1 title, AgentRig markers, and unfilled `{{TOKENS}}` stripped) — so anything you add to `AGENTS.md` flows through everywhere.

## `eval`

Evaluate the harness itself. Defaults to the **full agentic run** (harness ON, every scenario, both implementation + review). Use `--static` for the fast structural audit.

```bash
npx @doidor/agentrig eval [path]
```

| Flag | Purpose |
| --- | --- |
| `--static` | Deterministic structural audit only — no model. Fast, CI-safe. |
| `--rubric` | Print what the dynamic eval measures (axes + issue codes + installed scenarios). |
| `--scenario <id>` | Run only one scenario (e.g. `fix-failing-test`). |
| `--variant <name>` | Label this run (default `harness`; use `baseline` to compare a harness-OFF run). |
| `--timeout <min>` | Absolute cap per agent turn (default 45). |
| `--min <pct>` | (with `--static`) Exit non-zero if Harness Score < threshold. |
| `--json` | Machine-readable output. |

See [Evaluating the harness →](./evals.html) for the rubric and how to measure harness lift.

## `doctor`

Quick health check: is a harness installed, can the agent reach its provider, what is the current score?

```bash
npx @doidor/agentrig doctor [path]
```

| Flag | Purpose |
| --- | --- |
| `--json` | Machine-readable output. |

## `dashboard`

Show the agent roster, live GitHub tasks (when available), the latest Harness Score, and recent eval runs.

```bash
npx @doidor/agentrig dashboard [path]
```

| Flag | Purpose |
| --- | --- |
| `--html [file]` | Write a self-contained HTML dashboard (default `.agentrig/dashboard/dashboard.html`). |
| `--no-tasks` | Skip live GitHub task lookups (offline mode). |

## Global flags

| Flag | Purpose |
| --- | --- |
| `--verbose` | Verbose logging on any command. |
| `-h, --help` | Show help. |
| `-v, --version` | Show the installed version. |

## Environment

| Variable | Purpose |
| --- | --- |
| `AGENTRIG_PROVIDER` | Agent backend (default `copilot` via the GitHub Copilot CLI). |
