---
name: harness-eval
description: Evaluate THIS repository's agent harness — a deterministic structure audit (A1) plus content quality probes (A2), plus an isolated producer/judge dynamic eval (B) with paired sign-test A/B variant comparison.
triggers:
  - "evaluate / score the harness (static or dynamic)"
  - "did a harness change improve or regress it?"
  - before merging changes to skills/rules/agents/prompts
allowed-tools: Bash Read Grep Glob
argument-hint: "[--static|--dynamic] [--scenario id] [--variant v] [--n trials]"
---

# harness-eval (principle 6 — evaluate the harness itself)

A harness you cannot measure is a harness you cannot improve. This skill scores the harness on
three complementary layers and writes results to `.agentrig/eval/results/` (validated on write
*and* on read; never hand-edit JSON).

## Layer A1 — install completeness (deterministic, no model)
Every canonical artifact present at the path the manifest declares.

```bash
node .agentrig/eval/static-audit.mjs --json   # Install Completeness %
```

## Layer A2 — quality probes (deterministic, no model)
Cheap content sanity: YAML parseable, no unfilled `{{PLACEHOLDER}}` in `AGENTS.md`, every skill has
the required frontmatter, axes.json has an issue code per axis, developer/reviewer **model
families** differ (not just the model id strings).

A1 + A2 are what CI gates on. Both surface in the same `--static` report under "Layer A1" and
"Layer A2" sections.

## Layer B — dynamic behavioral eval (agentic, independent judge, fixture-based)

For each scenario in `.agentrig/eval/scenarios/*/`:

1. **Seed** a throwaway worktree from `scenarios/<id>/fixture/` (or `baseline/`+`change/` for
   review scenarios).
2. **Producer** model runs in that worktree against `scenarios/<id>/prompt.md`. For
   `--variant harness`, the AgentRig harness is staged into the worktree first; for
   `--variant baseline`, the agent runs bare.
3. **Oracle** (`scenarios/<id>/oracle.yml`) deterministically scores the hard axes (correctness,
   tests, scope, regression_risk, …) by running commands / inspecting the diff. **No LLM.**
4. **Judge** model — explicitly a **different family** from the producer — runs in a separate
   `provider.startConversation()` call in its own cwd containing only `prompt.md`, `diff.patch`,
   `transcript.md`, `oracle.json`, and `judge_brief.md`. It does NOT see the producer worktree or
   reasoning trace. It writes `<artifactsDir>/<scenario>.trial<N>.judge.json`; the orchestrator
   reads, validates, and persists via `score.mjs save`.

**Family-divergence is enforced.** `score.mjs save` rejects a producer/judge pair in the same
family unless `--allow-same-family` is set (and records the override). Bare CLI:

```bash
agentrig eval --dynamic --variant harness  --n 5 --producer-model claude-sonnet-4.6 --judge-model gpt-5.5
agentrig eval --dynamic --variant baseline --n 5 --producer-model claude-sonnet-4.6 --judge-model gpt-5.5
node .agentrig/eval/score.mjs compare --scenario <id> --baseline baseline
```

**Aggregation: weighted + veto.** axes.json declares `weight` and `veto: true` per axis.
A veto axis < 1.0 fails the scenario regardless of aggregate (e.g. correctness can never be
papered over by clarity).

## Statistical lift

Single-trial deltas are coin flips. The eval requires `n ≥ 3` paired trials for any verdict
other than **INCONCLUSIVE**. `score.mjs compare` runs a paired binomial sign test and reports
median delta + p-value:

- **HELPS** — p < 0.05 and median > 0.05
- **HURTS** — p < 0.05 and median < -0.05
- **INCONCLUSIVE** — n < 3, p ≥ 0.05, or |median| < 0.05

A change that doesn't clear `HELPS` is a regression risk even if individual trials looked good.

## Sandbox
Obey `.agentrig/eval/sandbox/eval-rules.md`: throwaway worktree under `$TMPDIR/agentrig-eval/`,
never push / open PRs / merge / mutate real labels. The eval measures behavior; it must not
mutate real branches.

## Calibrate the judge before trusting it

A lazy judge that returns 1.0 everywhere passes every `score.mjs save` validation. Run the judge
over the hand-labeled `calibration/` instances and require ≥ 80% agreement before publishing
results:

```bash
node .agentrig/eval/score.mjs calibrate --judge <model> --instance .agentrig/eval/calibration/run/seed-correct.yml --judge-scores /tmp/judge-out.json
node .agentrig/eval/score.mjs calibrate --report
agentrig doctor   # flags any judge below the 80% threshold
```

See `.agentrig/eval/calibration/README.md` for the instance format.
