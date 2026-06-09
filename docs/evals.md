---
title: Evaluating the harness
description: Measure whether AgentRig actually helps — static audit, dynamic agentic eval, and harness-lift comparison.
order: 4
---

# Evaluating the harness

A harness nobody measures is decoration. AgentRig ships two evaluation modes plus a comparison
mode for the hard question: *does the harness actually help?*

## Mode 1 — static audit (`eval --static`)

Deterministic structural audit. Milliseconds, no model — CI-safe.

```bash
agentrig eval --static --min 80    # fail CI if Harness Score < 80%
agentrig eval --static --json      # machine-readable
```

Runs 35 checks across the 12 principles. Sample output:

```text
[PASS] P1  Workflow is an explicit state machine
[PASS] P2  Specialized roles run different models
…
Harness Score: 100%  (35/35 full credit)
```

## Mode 2 — dynamic agentic eval (`eval`)

Runs every installed scenario against an agent operating inside your harness, then scores both
the implementation work *and* the agent's behavior.

```bash
agentrig eval                            # every scenario, harness ON
agentrig eval --scenario fix-failing-test
agentrig eval --variant harness          # tag for lift comparison
```

Axes are scored 0 / 0.5 / 1; pass threshold is **≥ 0.8 aggregate**. The full axis registry,
issue codes, and scenario list:

```bash
agentrig eval --rubric
```

Axes live in `.agentrig/eval/axes.json`, prose in `.agentrig/eval/RUBRIC.md`, scenarios in
`.agentrig/eval/scenarios/<id>/` — all editable.

## Mode 3 — harness lift (`eval --compare`)

Does the harness actually help? Run both variants and diff:

```bash
agentrig eval --variant harness    # in your harness repo
agentrig eval --variant baseline   # in a sibling worktree with .agents/ + AGENTS.md removed
agentrig eval --compare --baseline baseline --variant harness
```

Emits a per-axis delta and a HELPS/HURTS/NEUTRAL verdict. If the lift isn't where you expect,
revise `.agentrig/PRINCIPLES.md`, your rules, or the role prompts in `.agentrig/agents/`.

## Per-repo customization

Everything under `.agentrig/eval/` is editable. Add scenarios for your most failure-prone tasks,
add domain-specific axes (e.g. `accessibility_compliance`), tighten thresholds. Confirm what's
actually measured with `agentrig eval --rubric`.

## CI

```yaml
# .github/workflows/agentrig-eval.yml
- run: npx -y @doidor/agentrig@latest eval --static --min 90
```

Blocks PRs that drop the Harness Score below 90%.
