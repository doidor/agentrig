---
title: Evaluating the harness
description: Measure whether AgentRig actually helps — static structural audit, dynamic agentic eval, and harness-lift comparison.
order: 4
---

# Evaluating the harness

A harness that nobody measures is just decoration. AgentRig ships **two evaluation modes** so you can tell whether the harness in your repo is healthy and whether it actually helps your agents do better work.

## Mode 1 — static audit (`eval --static`)

A deterministic structural audit. Runs in milliseconds, no model calls — safe for CI.

```bash
npx @doidor/agentrig eval --static
```

What it checks (35 checks across the 12 principles):

```text
[PASS] P1  Orchestration contract documented
[PASS] P1  Workflow is an explicit state machine
[PASS] P1  Transition trigger taxonomy declared
[PASS] P2  Model tiers defined for cost/quality routing
[PASS] P2  Roles have dedicated prompts
[PASS] P2  Specialized roles run different models
…
[PASS] P12 AGENTS.md lists the installed skills

Harness Score: 100%  (35/35 full credit)
```

Use it as a quality gate in CI:

```bash
# Fail the build if the harness regressed
npx @doidor/agentrig eval --static --min 80
```

For machine-readable output:

```bash
npx @doidor/agentrig eval --static --json
```

```json
{
  "harnessScore": 100,
  "aggregate": 1,
  "results": [
    { "id": "state-machine", "principle": 1, "title": "…", "score": 1, "evidence": "" },
    …
  ]
}
```

## Mode 2 — dynamic agentic eval (`eval`)

This is what you want when you ask "is the harness actually making my agents better?". `eval` defaults to the full harness-ON run: it executes every installed scenario against an agent operating *inside* your harness, then scores both the implementation work and the agent's behavior on a multi-axis rubric.

```bash
# Full agentic eval — every scenario, both implementation + review
npx @doidor/agentrig eval

# One scenario at a time
npx @doidor/agentrig eval --scenario fix-failing-test

# Tag the variant (for harness-lift comparisons)
npx @doidor/agentrig eval --variant harness
npx @doidor/agentrig eval --variant baseline
```

### What's evaluated

`eval --rubric` prints the full registry of axes and issue codes:

```text
RUN — Implementation run (the harness doing a task)
  output_quality
    correctness          codes: OQ-CORRECT-WRONG, OQ-CORRECT-PARTIAL, OQ-CORRECT-EDGE
    scope                codes: OQ-SCOPE-CHURN, OQ-SCOPE-UNRELATED, OQ-SCOPE-INCOMPLETE
    tests                codes: OQ-TESTS-MISSING, OQ-TESTS-WEAK, OQ-TESTS-BROKEN
    clarity              codes: OQ-CLARITY-NAMING, OQ-CLARITY-COMPLEXITY, OQ-CLARITY-COMMENTS
  agent_behavior
    self_verification    codes: AB-VERIFY-SKIPPED, AB-VERIFY-REDHANDOFF, AB-VERIFY-PARTIAL
    gate_compliance      codes: AB-GATE-SKIPPED, AB-GATE-HUMANLABEL, AB-GATE-ORDER
    tool_discipline      codes: AB-TOOLS-OVERLIMIT, AB-TOOLS-UNSCOPED, AB-TOOLS-NOISE
    escalation           codes: AB-ESCALATE-LATE, AB-ESCALATE-THRASH, AB-ESCALATE-NONE
  long_term_impact
    memory               codes: LT-MEMORY-NOLOG, LT-MEMORY-REPEAT, LT-MEMORY-DUP
    regression_risk      codes: LT-REGRESS-LIKELY, LT-REGRESS-UNTESTED
    maintainability      codes: LT-MAINTAIN-DEBT, LT-MAINTAIN-COUPLING

SPEC — Task/issue spec quality (before implementation)
  spec_quality
    clarity, acceptance_criteria, scope_bounded, testability, context

REVIEW — Review process quality (the reviewer's behavior)
  review_quality
    finding_correctness, severity_calibration, …
```

Each axis is scored on a 0 / 0.5 / 1 scale; the pass threshold is **≥ 0.8 aggregate**. The rubric registry lives in `.agentrig/eval/axes.json` and the prose explanation in `.agentrig/eval/RUBRIC.md` — both are editable in your repo, so you can extend or override what's evaluated.

### Where the scenarios live

Scenarios are isolated repro tasks (fix-failing-test, add-small-feature, …) that an agent runs in a hermetic per-agent worktree. They live in `.agentrig/eval/scenarios/<id>/` — you can add your own.

## Harness lift — does the harness *actually help*?

The hard question. AgentRig answers it by running the same scenarios under two variants:

```bash
# Run #1: harness ON
npx @doidor/agentrig eval --variant harness

# Run #2: harness OFF (baseline)
# (run the scenarios in a sibling worktree where .agents/, AGENTS.md,
#  and projected surfaces have been removed)
npx @doidor/agentrig eval --variant baseline
```

Then compare:

```bash
npx @doidor/agentrig eval --compare --baseline baseline --variant harness
```

This emits a per-axis delta and a HELPS/HURTS/NEUTRAL verdict. If the harness isn't producing a meaningful lift on the axes you care about, that's a signal to revise the principles in `.agentrig/PRINCIPLES.md`, tune your rules, or change the role prompts in `.agentrig/agents/`.

## Per-repo customization

The rubric, axes, and scenarios are all in `.agentrig/eval/` — **editable in your repo**. AgentRig ships a sensible default set, but your evaluation should reflect what *your* team cares about:

- Add a scenario for the most failure-prone task in your repo (a flaky test you want agents to fix, a refactor you want them to do safely).
- Add an axis specific to your domain (e.g. `accessibility_compliance` for a frontend repo).
- Tune `axes.json` thresholds to be stricter than the defaults.

After editing, run `npx @doidor/agentrig eval --rubric` to confirm what's actually being measured.

## CI integration

```yaml
# .github/workflows/agentrig-eval.yml
name: AgentRig harness
on: [pull_request]
jobs:
  static-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npx -y @doidor/agentrig@latest eval --static --min 90
```

This blocks PRs that drop the Harness Score below 90%.
