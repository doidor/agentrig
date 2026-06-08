---
name: harness-eval
description: Evaluate THIS repository's agent harness — a deterministic structure audit plus an independent, rubric-driven dynamic eval (run/spec/review) with A/B variant comparison.
triggers:
  - "evaluate the harness"
  - pre_merge hook
  - "did my harness change make things better or worse?"
allowed-tools: Bash Read Grep Glob
argument-hint: "[--static|--dynamic] [--scenario id] [--variant v]"
---

# harness-eval (principle 6 — evaluate the harness itself)

A harness you cannot measure is a harness you cannot improve. This skill scores the harness on two
complementary layers and writes results to `.agentrig/eval/results/` (validated, never hand-edited).

## Layer A — static audit (deterministic, no model)
Each of the 12 principles maps to concrete checks in `.agentrig/eval/checks.json`, scored 0/0.5/1.0.

```bash
node .agentrig/eval/static-audit.mjs            # human-readable report + aggregate score
node .agentrig/eval/static-audit.mjs --json     # machine-readable, for CI gates
```

Use this in CI and as a fast pre-merge gate. It needs no model and no network.

## Layer B — dynamic behavioral eval (agentic, independent judge)
Run scenarios in `.agentrig/eval/scenarios/*.md` through the harness, then score as an **independent
judge** (a different model than the producer) against `.agentrig/eval/RUBRIC.md` and the registry in
`.agentrig/eval/axes.json`.

**Sandbox:** obey `.agentrig/eval/sandbox/eval-rules.md` — work in a throwaway worktree; never push,
open PRs, or merge.

**Lifecycle:** score the whole lifecycle, not just the patch. Use the rubric `--type` that matches
the scenario: `spec` (task quality), `run` (implementation), `review` (the reviewer's behavior).
Link them with a shared `--task` id.

**Rules (enforced by score.mjs):** strict 0/0.5/1.0 tiers; any axis < 1.0 needs an issue code from
that axis's registry **plus** an evidence string; unobserved axes are `=na`; rollups are recomputed
from axis data.

```bash
node .agentrig/eval/score.mjs save --type run --task <id> --scenario <id> --judge <model> \
  --axis 'correctness=1.0' \
  --axis 'scope=0.5:OQ-SCOPE-CHURN:left build artifacts in the diff' \
  --axis 'tests=na'
node .agentrig/eval/score.mjs report
```

**Artifacts:** for each run, save `diff.patch`, a short `output` transcript, and `meta.json`
(scenario, base_commit, variant, model, duration) next to the score so regressions are inspectable.

## Comparing harness changes (A/B)
To know whether a prompt/skill/rule change helped, run the **same** scenario before and after under
different `--variant`s, then:

```bash
node .agentrig/eval/score.mjs compare --scenario <id>
```

A change that lowers the aggregate is a regression even if it "feels" better. A static score < 1.0
on a principle points at a missing/weak artifact — fix the artifact, then re-audit.

## Does the harness actually help? (with vs without)
The most important question for a consumer: *does installing AgentRig's harness make agents better
in THIS repo?* Measure it by running the same scenarios twice and comparing:

```bash
# 1) Harness ON (the agent uses AGENTS.md + rules + skills as installed)
agentrig eval --dynamic --scenario <id> --variant harness

# 2) Baseline — harness OFF (a bare agent; ignore AGENTS.md/.agents/instructions surfaces)
agentrig eval --dynamic --scenario <id> --variant baseline

# 3) Report the lift (per-axis + aggregate delta + a HELPS/HURTS verdict)
node .agentrig/eval/score.mjs compare --scenario <id> --baseline baseline
```

For a rigorous baseline, run the harness-off trial in a sandbox/worktree with the harness + compiled
surfaces moved aside (`AGENTS.md`, `.agents/`, `.github/instructions/`, `CLAUDE.md`, `.cursor/`), so
the agent genuinely has no harness guidance. A positive aggregate delta means the harness helps in
this repo; track it over time as you tune rules/skills/prompts.
