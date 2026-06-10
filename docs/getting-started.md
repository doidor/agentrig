---
title: Getting started
description: Install AgentRig and scaffold a best-practice agent harness in any repo in under a minute.
order: 1
---

# Getting started

> Examples use `agentrig` as shorthand for `npx @doidor/agentrig`. Auth: AgentRig defaults to
> the GitHub Copilot CLI provider — `gh auth login` is the only setup. Switch via
> `AGENTRIG_PROVIDER`.

## 1. Install

In any repo — fresh or existing:

```bash
agentrig init
```

`init` is non-destructive by default. If you already have `AGENTS.md`, `.mcp.json`, or rules in
`.agents/rules/`, they're preserved verbatim and the rest of the harness is installed around
them. Pass `--force` to overwrite.

What lands:

```text
.agentrig/         harness state-machine, role prompts, eval rubric, dashboard
.agents/           rules/ skills/ wiki/
AGENTS.md          canonical agent instructions (the source of truth)
.mcp.json          MCP server registry
scripts/           hermetic per-agent worktree script
+ projected surfaces for Copilot, Claude, Cursor, Codex, OpenCode, MCP
```

See [agent surfaces →](./agent-surfaces.html) for what lands where.

### Adopting AgentRig in a repo that already has an agent harness

Preserved files appear in the install summary:

```text
✔ installed 30 artifact(s)
  preserved 2 existing file(s) — pass --force to overwrite:
    · AGENTS.md
    · .mcp.json
```

Your existing `AGENTS.md` is still compiled into every projected surface.

## 2. Iterate

Edit `AGENTS.md` and rules, then re-project:

```bash
agentrig compile     # re-project AGENTS.md + rules into every surface
agentrig doctor      # health check + Install Completeness + Quality Probes
agentrig update      # pull newer best practices from the package
```

`compile` is idempotent — run it as often as you want; user-owned files like
`copilot-setup-steps.yml` are never clobbered. `doctor` on a fresh install reports
**Install Completeness 100%**.

## 3. Evaluate

```bash
agentrig eval --static --min 80   # CI gate: fail if Install Completeness < 80%
agentrig eval                     # full agentic run — harness vs baseline
```

`--static` is deterministic and runs in milliseconds (no model). The full agentic run scores
both the implementation work (via deterministic oracle) and agent behavior (via an independent
judge in a different model family). [Full rubric →](./evals.html)

## Next

- [Commands reference →](./commands.html) — every flag.
- [Agent surfaces →](./agent-surfaces.html) — projection map per vendor.
- [Evaluating the harness →](./evals.html) — does the harness actually help?
