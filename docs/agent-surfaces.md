---
title: Agent surfaces
description: Which files AgentRig projects into which agent ecosystem, and why.
order: 3
---

# Agent surfaces

`AGENTS.md` + `.agents/rules/` is the **canonical source**. AgentRig is the only thing that
writes to vendor-specific instruction locations — edit the source, run `agentrig compile`,
every surface stays in sync.

## Canonical source

| File | Purpose |
| --- | --- |
| `AGENTS.md` | Repo-wide instructions — critical rules, project context, build/test commands. |
| `.agents/rules/*.md` | Glob-scoped reflex rules (frontmatter: `globs`, `description`, `priority`). |
| `.agents/skills/*/SKILL.md` | Procedural memory — multi-step workflows agents invoke as skills. |
| `.mcp.json` | MCP server registry. |

## Projection map

| Surface | Projected file(s) | Source |
| --- | --- | --- |
| **GitHub Copilot** | `.github/copilot-instructions.md` | `AGENTS.md` (full body) |
| | `.github/instructions/<rule>.instructions.md` | each `.agents/rules/*.md` (with `applyTo: <globs>`) |
| | `.github/copilot/mcp.json` | `.mcp.json` |
| | `.github/workflows/copilot-setup-steps.yml` | detected stack (scaffolded once, user-owned thereafter) |
| **Claude Code** | `CLAUDE.md` | `AGENTS.md` (via `@AGENTS.md` import + inlined fallback) |
| | `.claude/` → `.agents/` (symlink) | skills, rules, wiki |
| **Cursor** | `.cursor/rules/<rule>.mdc` | each `.agents/rules/*.md` (`.mdc` format; `alwaysApply` derived from `globs`) |
| **Codex / OpenCode** | `.codex/`, `.opencode/` → `.agents/` (symlinks) | same skills/rules/wiki, vendor-expected paths |
| **VS Code MCP** | `.vscode/mcp.json` | `.mcp.json` (transformed to VS Code's `servers` shape) |

## Quirks worth knowing

- **`copilot-setup-steps.yml`** is scaffolded on first install from the detected stack
  (Node / Python / Go / generic) and never re-projected — it's yours.
- **Cursor `alwaysApply`** is derived: `true` when `globs == ["**/*"]`, `false` otherwise.
- **CLAUDE.md** mirrors AGENTS.md inline (so Claude clients without `@`-import support still
  see the body) AND uses Claude's native `@AGENTS.md` import.
- **`.claude/`, `.codex/`, `.opencode/`** are symlinks — skills/rules added to `.agents/`
  appear everywhere automatically.

## Re-projecting

```bash
agentrig compile          # idempotent; run after any edit to AGENTS.md or .agents/rules/
```

Optional CI hook to fail if projection drifted:

```yaml
- run: |
    agentrig compile
    git diff --exit-code
```
