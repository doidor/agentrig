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
agentrig compile              # re-project AGENTS.md + rules into every surface
agentrig doctor               # health check + Install Completeness + Quality Probes
agentrig update               # pull newer best practices from the package
agentrig update --auto-fix    # …and self-heal broken YAML / unknown model ids from canonical
agentrig fix                  # standalone repair (no agent / network needed)
```

`compile` is idempotent — run it as often as you want; user-owned files like
`copilot-setup-steps.yml` are never clobbered, and the auto-populated
`<!-- AGENTRIG:skills-inventory --> ... :end -->` block in `AGENTS.md` is rewritten from
whatever's actually in `.agents/skills/`. `doctor` on a fresh install reports
**Install Completeness 100%**.

## 3. Evaluate

```bash
agentrig eval --scaffold          # generate eval scenarios tailored to your repo's stack
agentrig eval --static --min 80   # CI gate: fail if Install Completeness < 80%
agentrig eval                     # full agentic run — harness vs baseline
```

**`eval --scaffold` is the fastest way to make the eval kit yours** — it reads the repo
investigation from `init` and writes fixture-based scenarios that use your real test runner and
package manager, instead of the generic bundled templates. `--static` is deterministic and runs in
milliseconds (no model). The full agentic run scores both the implementation work (via a
deterministic oracle) and agent behavior (via an independent judge in a different model family).
[Full rubric →](./evals.html)

## Recreate the harness without the CLI (no lock-in)

AgentRig is **plain text plus a few dependency-free scripts** — once a harness is installed, nothing
at runtime reads from the npm package. So you never have to keep the CLI around. If you'd rather not
run `agentrig` at all, **point your coding agent at this docsite's `llms.txt` and ask it to recreate
the harness**:

```text
https://tudorpopa.com/agentrig/llms.txt
```

`llms.txt` is the [llmstxt.org](https://llmstxt.org/) index of this entire docsite in plain text —
every page, agent-readable, no scraping. It gives an agent everything it needs to stand the harness
up by hand:

- **What to build** — the [12 principles](./principles.html) are a complete, per-principle **artifact
  inventory**: each one names the exact file(s) it installs and where (`.agentrig/harness/state-machine.yml`,
  `.agentrig/agents/<role>.{yml,md}`, `.agents/skills/`, `.agents/rules/`, `.agentrig/eval/`, …).
- **How to wire surfaces** — [Agent surfaces](./agent-surfaces.html) is the exact one-source →
  every-surface projection map (Copilot, Claude, Cursor, Codex, MCP) plus the symlink layout.
- **How to verify it** — [Evaluating the harness](./evals.html) documents the deterministic
  install-completeness + quality-probe audit, so the agent can self-check its work to 100%.
- **Exact file contents** — every artifact ships as editable plain text in the public repo under
  [`knowledge/templates/`](https://github.com/doidor/agentrig/tree/main/knowledge/templates). Tell
  the agent to copy each file verbatim from there, then tailor the `{{PLACEHOLDERS}}` to your repo.

A practical prompt:

> Read `https://tudorpopa.com/agentrig/llms.txt` and every page it links. Then recreate the
> AgentRig harness in this repository: for each of the 12 principles, create the artifact it names by
> copying the canonical file from `github.com/doidor/agentrig/tree/main/knowledge/templates`, fill in
> the `{{PLACEHOLDERS}}` for this repo, project `AGENTS.md` + `.agents/rules/` to every agent surface,
> and confirm the install-completeness audit reaches 100%.

This is the same content `agentrig init` would install — just driven by your own agent, with no
dependency to keep updated. Re-point it at `llms.txt` whenever you want to pull newer best practices.

## Next

- [Commands reference →](./commands.html) — every flag.
- [Agent surfaces →](./agent-surfaces.html) — projection map per vendor.
- [Evaluating the harness →](./evals.html) — does the harness actually help?
