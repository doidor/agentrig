---
title: AgentRig
description: A meta-harness for agent harnesses — install best-practice agent rules, skills, and surfaces into any repo with one command.
order: 0
---

# AgentRig

> An agentic **meta-harness** — a harness *of* harnesses. Investigate any repo, install best-practice agent instructions, skills, rules, and evals, and project them into every agent surface (local + remote) so every agent in your repo benefits, regardless of which tool you use.

```bash
# In any repo
npx @doidor/agentrig init
```

That's it. One command turns a cold repo into one where Copilot (web + IDE), Claude Code, Cursor, Codex, OpenCode — *and* whatever you'll switch to next year — all read from the same canonical source and follow the same rules.

> **Safe to run on existing repos.** `init` is non-destructive by default — if you already have an `AGENTS.md`, `.mcp.json`, or hand-tailored rules, those are preserved verbatim. The canonical machinery is still installed around what you have, and your existing `AGENTS.md` is compiled into every agent surface. Pass `--force` to overwrite. ([details →](./getting-started.html#adopting-agentrig-in-a-repo-that-already-has-an-agent-harness))

## Why a meta-harness?

Most teams pick one agent ("we use Claude Code") and write a `CLAUDE.md` for it. Then someone joins who prefers Cursor. Then GitHub Copilot grows a coding-agent. Then the third agent gets a `.cursor/rules/` directory that drifts from `CLAUDE.md`. Then nobody knows which file an agent will actually read.

AgentRig fixes this by treating **`AGENTS.md` + `.agents/rules/`** as the single source of truth, then **compiling** it into every agent ecosystem's native format. Edit once, every surface updates.

It also installs a turnkey **harness** based on [12 principles](./principles.html) drawn from production agent systems — orchestration contract, state machine, skills, rules, evals, dashboard, the lot.

## What you get

| Surface | File(s) projected |
| --- | --- |
| **GitHub Copilot** (web coding agent + IDE) | `.github/copilot-instructions.md`, `.github/instructions/*.instructions.md`, `.github/copilot/mcp.json`, `.github/workflows/copilot-setup-steps.yml` |
| **Claude Code** | `CLAUDE.md` (with `@AGENTS.md` import + inlined body), `.claude/` → `.agents/` |
| **Cursor** | `.cursor/rules/*.mdc` (glob-scoped, `alwaysApply` derived from globs) |
| **Codex / OpenCode** | `.codex/`, `.opencode/` → `.agents/` |
| **VS Code MCP** | `.vscode/mcp.json` |
| **Per-repo Copilot env** | `.github/workflows/copilot-setup-steps.yml` (scaffolded once from detected stack — Node / Python / Go) |
| **Canonical sources** | `AGENTS.md`, `.agents/rules/`, `.agents/skills/`, `.agents/wiki/`, `.mcp.json`, `.agentrig/` |

## 30-second tour

```bash
# Install + scaffold a harness in the current repo
npx @doidor/agentrig init

# Re-project AGENTS.md into every surface (Copilot, Claude, Cursor, MCP…)
npx @doidor/agentrig compile

# Pull in the latest best practices from the agentrig package
npx @doidor/agentrig update

# Health check
npx @doidor/agentrig doctor

# Evaluate whether the harness actually helps
npx @doidor/agentrig eval
```

[Getting started →](./getting-started.html) for the full walkthrough.

## Where to go next

- [Getting started](./getting-started.html) — install + first run + what files land in your repo.
- [Commands](./commands.html) — every CLI command and flag.
- [Principles](./principles.html) — the 12 principles AgentRig encodes (your editable copy lives in `.agentrig/PRINCIPLES.md`).
- [Evaluating the harness](./evals.html) — static + dynamic rubrics, and how to measure "does this harness actually help?".
- [Agent surfaces](./agent-surfaces.html) — which files project where, and why.

## Project

- **npm:** [`@doidor/agentrig`](https://www.npmjs.com/package/@doidor/agentrig)
- **GitHub:** [doidor/agentrig](https://github.com/doidor/agentrig)
- **License:** MIT
