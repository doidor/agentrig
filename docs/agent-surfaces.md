---
title: Agent surfaces
description: Which files AgentRig projects into which agent ecosystem, and why.
order: 3
---

# Agent surfaces

AgentRig treats `AGENTS.md` + `.agents/rules/` as the **single source of truth**, then **projects** them into every agent ecosystem's native format. Edit the source — `agentrig compile` keeps every surface in sync.

## The principle

Every agent vendor invented its own location for "instructions" — `.cursor/rules/`, `CLAUDE.md`, `.github/copilot-instructions.md`, `.codex/`, `.opencode/`. If you write instructions in only one of them, the others go uninstructed. If you write instructions in all of them, they drift.

AgentRig solves this by being the only thing that *writes* to those locations. You edit one canonical source; every vendor surface gets the projection.

## The canonical source

| File | Purpose |
| --- | --- |
| `AGENTS.md` | Repo-wide agent instructions — Critical Rules, project context, build/test/lint commands, harness map. Edit this freely. |
| `.agents/rules/*.md` | Glob-scoped reflex rules (e.g. `security`, `no-debug-logging`, `coding-standards`). Each has YAML frontmatter with `globs`, `description`, `priority`. |
| `.agents/skills/*/SKILL.md` | Procedural memory — multi-step workflows agents can invoke as skills (`self-verify`, `skill-improver`, …). |
| `.mcp.json` | The MCP server registry (GitHub server, etc.). |

## The projected surfaces

### GitHub Copilot (web coding agent + IDE)

| File | Source | Notes |
| --- | --- | --- |
| `.github/copilot-instructions.md` | `AGENTS.md` (full body) | Mirrors the entire `AGENTS.md` body — anything you add flows through. |
| `.github/instructions/<rule>.instructions.md` | each `.agents/rules/*.md` | One per rule, with `applyTo: "<globs>"` frontmatter — Copilot only applies it to matching files. |
| `.github/copilot/mcp.json` | `.mcp.json` | Reference for the Copilot coding-agent's MCP config (also configurable in Settings → Copilot). |
| `.github/workflows/copilot-setup-steps.yml` | detected stack | Scaffolded ONCE per repo from the detected stack (Node / Python / Go / generic). User-owned thereafter — never re-projected. |

### Claude Code

| File | Source | Notes |
| --- | --- | --- |
| `CLAUDE.md` | `AGENTS.md` (full body) | `@AGENTS.md` import (Claude resolves natively) **plus** the full body inlined as a fallback. |
| `.claude/` → `.agents/` | symlink | Skills, rules, wiki all visible to Claude under its expected paths. |

### Cursor

| File | Source | Notes |
| --- | --- | --- |
| `.cursor/rules/<rule>.mdc` | each `.agents/rules/*.md` | Cursor's `.mdc` format with `globs`, `description`, `alwaysApply` (derived: true if `globs == ["**/*"]`, false otherwise). |

### Codex / OpenCode

| Path | Source | Notes |
| --- | --- | --- |
| `.codex/`, `.opencode/` → `.agents/` | symlinks | Same skills/rules/wiki, surfaced at the path each vendor expects. |

### VS Code MCP

| File | Source | Notes |
| --- | --- | --- |
| `.vscode/mcp.json` | `.mcp.json` | VS Code reads its own `.vscode/mcp.json` with a top-level `servers` key (different shape from `.mcp.json`). |

## Why the projection wins

| Problem | Without AgentRig | With AgentRig |
| --- | --- | --- |
| New agent shows up next year | Add yet another instructions file by hand | Add one projection target in `compile` — every existing instruction flows in |
| Team switches between agents | Each one sees a different (often stale) version of the rules | Every agent sees the same projection of one canonical source |
| You change a security rule | Edit it in 4 places (Copilot, Claude, Cursor, instructions/) | Edit `.agents/rules/security.md` and run `compile` |
| Remote agent (Copilot web) needs the same context | Hand-maintain `.github/copilot-instructions.md` | Auto-projected from `AGENTS.md` on every `compile` |
| Repo-specific Copilot env setup | Hand-write `copilot-setup-steps.yml` | Scaffolded from the detected stack on first install |

## Re-projecting

```bash
npx @doidor/agentrig compile
```

Idempotent. Run it whenever you change `AGENTS.md` or a file under `.agents/rules/`. CI hook (your choice — AgentRig doesn't install one):

```yaml
# .github/workflows/projection-check.yml
- run: |
    npx @doidor/agentrig compile
    git diff --exit-code  # fails if projection drifted
```
