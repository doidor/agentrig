---
name: harness-eval
description: Evaluate THIS repository's agent harness — static structure audit plus optional dynamic scenario scoring against the rubric.
triggers:
  - "evaluate the harness"
  - pre_merge hook
  - "did my harness change make things better or worse?"
allowed-tools: Bash Read Grep Glob
argument-hint: "[--static|--dynamic]"
---

# harness-eval (principle 6 — evaluate the harness itself)

A harness you cannot measure is a harness you cannot improve. This skill scores the harness on two
complementary layers and writes results to `.agentrig/eval/results/` (never hand-edited).

## Layer A — static audit (deterministic, no model)
Run the structural audit. Each of the 12 principles maps to concrete checks in
`.agentrig/eval/checks.json`, scored 0 / 0.5 / 1.0.

```bash
node .agentrig/eval/static-audit.mjs            # human-readable report + aggregate score
node .agentrig/eval/static-audit.mjs --json     # machine-readable, for CI gates
```

Use this in CI and as a fast pre-merge gate. It needs no model and no network.

## Layer B — dynamic behavioral eval (agentic, independent judge)
For each scenario in `.agentrig/eval/scenarios/*.md`, run the task through the harness, then have an
**independent judge model** (different from the one that produced the work) score the result against
`.agentrig/eval/RUBRIC.md` on Output Quality / Agent Behavior / Long-Term Impact.

For every axis scored below 1.0 you MUST record an **issue code** and one line of evidence. Persist
each score with the aggregator (it owns the JSON shape and the rollups):

```bash
node .agentrig/eval/score.mjs save \
  --scenario <id> --judge <model> \
  --axis output_quality=1.0 --axis agent_behavior=0.5:AB3 --axis long_term_impact=1.0
node .agentrig/eval/score.mjs report      # per-scenario and per-axis aggregation
```

## Interpreting results
- Compare aggregate scores **before and after** any prompt/skill/rule change. A change that lowers
  the score is a regression even if it "feels" better.
- A static score < 1.0 on a principle points at a missing or weak artifact — fix the artifact, then
  re-audit.
