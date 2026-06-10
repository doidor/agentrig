---
title: Evaluating the harness
description: Three layers — install completeness, quality probes, fixture-based dynamic eval with paired sign-test lift — plus judge calibration. Honest about what each does and does not prove.
order: 4
---

# Evaluating the harness

A harness nobody measures is decoration. AgentRig ships **three layers** of evaluation, each
making a **bounded** claim. Don't over-read what any one of them proves.

| Layer | Proves | Does NOT prove | Cost |
|---|---|---|---|
| **A1 — install completeness** | every canonical artifact present where the manifest declares | the artifacts *work*, or that agents respect them | ~1 second, no model |
| **A2 — quality probes** | content sanity (parseable YAML/JSON, no unfilled `{{PLACEHOLDER}}`, distinct model **families**, every skill has frontmatter, axes have issue codes) | semantic quality of the content | ~1 second, no model |
| **B — dynamic behavioral eval** | how the harness *changes agent behavior* on fixed fixtures, with deterministic oracles for hard axes + an independent judge for soft axes, with paired sign-test lift vs a baseline | absolute "is this agent good" — only relative to baseline | minutes to hours, real model spend |

All three persist results under `.agentrig/eval/results/` via `score.mjs`. Results are
**validated on read AND on write** (`schemaVersion: 2`) — never hand-edit JSON; invalid records
are quarantined into `results/_legacy/`.

---

## Layer A1 + A2 — static audit

Deterministic. Dependency-free. Safe in CI.

```bash
agentrig eval --static                 # human report, A1 and A2 in separate sections
agentrig eval --static --json          # machine-readable
agentrig eval --static --min 80        # fail CI if Install Completeness < 80%
```

Or the dep-free script directly (handy in fresh worktrees):

```bash
node .agentrig/eval/static-audit.mjs
```

Sample output:

```text
AgentRig — install completeness audit
  what this proves: every canonical artifact is present and minimally well-formed.
  what this does NOT prove: that those artifacts work, or that agents respect them.

  Layer A1 — structural completeness
  [PASS] P1  Workflow is an explicit, connected state machine (DAG with queued→merged path)
  [PASS] P2  Multiple specialized agent roles installed
  …

  Layer A2 — quality probes
  [PASS] P2  Developer and reviewer use DIFFERENT model families (not just different ids)
  [PASS] P4  Every skill declares description + allowed-tools (not just self-verify)
  [PASS] P6  axes.json has at least one issue code per axis
  [PASS] P12 AGENTS.md has no unfilled {{PLACEHOLDER}} tokens
  …

  Install Completeness: 100%  (33/33 full credit)
  Quality Probes:       100%  (6/6 full credit)
```

CI gates on **Install Completeness** with `--min`. **Quality Probes** are diagnostic — they
surface drift without failing the build.

---

## Layer B — dynamic behavioral eval

For each scenario in `.agentrig/eval/scenarios/<id>/`:

1. **Seed** a throwaway worktree from `scenarios/<id>/fixture/`.
2. **Producer** model runs `prompt.md` in the worktree. For `--variant harness` the AgentRig
   harness is staged into the worktree first; for `--variant baseline` the agent runs bare.
3. **Oracle** (`scenarios/<id>/oracle.yml`) deterministically scores hard axes (correctness,
   tests, scope, regression_risk, …) by running commands and inspecting the diff. **No LLM.**
4. **Judge** model — a **different family** from the producer — runs in a separate
   `provider.startConversation()` call in its own cwd containing only `prompt.md`,
   `diff.patch`, `transcript.md`, `oracle.json`, and `judge_brief.md`. It does NOT see the
   producer worktree or reasoning trace. It writes scores to a JSON file the orchestrator
   validates against `axes.json`.

### Bare invocation

`agentrig eval --dynamic` resolves models from `.agentrig/agents/developer.yml` (producer) and
`.agentrig/agents/reviewer.yml` (judge) by default — the roster already enforces these come from
different model families via the install-completeness audit. So the common path is just:

```bash
agentrig eval --dynamic
```

Override either model explicitly when running a one-off experiment:

```bash
agentrig eval --dynamic \
  --producer-model claude-sonnet-4.5 \
  --judge-model gpt-5.4
```

Or via env vars (handy in CI scripts):

```bash
AGENTRIG_PRODUCER_MODEL=claude-sonnet-4.5 \
AGENTRIG_JUDGE_MODEL=gpt-5.4 \
  agentrig eval --dynamic
```

Resolution chain (highest precedence first):

1. `--producer-model` / `--judge-model` CLI flags
2. `AGENTRIG_PRODUCER_MODEL` / `AGENTRIG_JUDGE_MODEL` env vars
3. `--model` (legacy back-compat — only sets the producer)
4. `.agentrig/agents/developer.yml` model (producer) / `.agentrig/agents/reviewer.yml` model (judge)
5. Provider default

The chosen model + source is logged at the start of the run and recorded in `meta.json`.

### Useful flags

| Flag | Purpose |
| --- | --- |
| `--scenario <id>` | Run one scenario (`fix-failing-test` / `add-small-feature` / `review-catches-bug`) |
| `--variant <name>` | Tag the run (`harness` vs `baseline` for A/B lift) |
| `--producer-model <id>` | Model that runs the task |
| `--judge-model <id>` | Model that scores soft axes — MUST be a different family |
| `--allow-same-family` | Override the family check (recorded in every result) |
| `--n <int>` | Trials per scenario (default 1 single; default 5 in baseline mode) |
| `--seed <int>` | Reproducibility seed (passed through where supported) |
| `--timeout <min>` | Absolute cap per agent turn (default 45) |

### Rubric rules (enforced by `score.mjs`)

1. **Strict 3-tier** scores: `0` / `0.5` / `1.0`.
2. **Issue code required.** Any axis < 1.0 with `confidence > 0` must carry an issue code from
   that axis's bounded registry plus a one-line evidence string.
3. **Confidence-gated.** An axis you couldn't observe is `=na` (confidence 0) and excluded from rollups.
4. **Weighted aggregation.** Axes carry an optional `weight` (default 1) and `veto: true`.
   The aggregate is a weighted mean of observed axes.
5. **Pass rule:** `aggregate ≥ passThreshold` AND no observed axis at 0 AND no veto axis < 1.0.
   Veto fails are surfaced in `failReason`.

### Lifecycle types

| `--type` | Categories | Veto axes |
|---|---|---|
| `spec` | spec_quality (5 axes) | `acceptance_criteria` |
| `run` | output_quality, agent_behavior, long_term_impact (10 axes) | `correctness`, `gate_compliance` |
| `review` | review_quality (7 axes) | `finding_correctness`, `blocking_decision` |

Inspect the live rubric in your repo:

```bash
agentrig eval --rubric
```

---

## Statistical lift — does the harness actually help?

Single-trial deltas are coin flips. The eval requires **n ≥ 3** paired trials for any verdict
other than `INCONCLUSIVE`. Pattern:

```bash
agentrig eval --dynamic --variant harness  --n 5 \
  --producer-model claude-sonnet-4.5 --judge-model gpt-5.4
agentrig eval --dynamic --variant baseline --n 5 \
  --producer-model claude-sonnet-4.5 --judge-model gpt-5.4

node .agentrig/eval/score.mjs compare --scenario <id> --baseline baseline
```

`compare --baseline` pairs trial *i* of harness with trial *i* of baseline, computes the
**median delta** and a **binomial sign-test p-value**, and prints one of three verdicts:

- **HELPS** — p < 0.05 and median > 0.05
- **HURTS** — p < 0.05 and median < -0.05
- **INCONCLUSIVE** — n < 3, p ≥ 0.05, or |median| < 0.05

A HELPS verdict on a real fixture, in a different model family than the judge, is the only thing
that justifies the line "AgentRig improved agent behavior here." Anything less is honest
**inconclusive**.

---

## Calibrating the judge

A judge that returns 1.0 on every axis passes every save validation but tells you nothing.
`.agentrig/eval/calibration/` ships **hand-labeled** rubric instances (scenario inputs + transcript
+ diff + ground-truth axes). Two-step flow:

```bash
# 1. Have your judge model score one of the seed instances and write
#    {"axes":[{"name":"...","score":1.0,"confidence":1}, …]} to /tmp/judge-out.json.
# 2. Score the judge against ground truth.
node .agentrig/eval/score.mjs calibrate \
  --judge gpt-5.4 \
  --instance .agentrig/eval/calibration/run/seed-correct.yml \
  --judge-scores /tmp/judge-out.json

# Roll up across instances.
node .agentrig/eval/score.mjs calibrate --report
```

`agentrig doctor` reads the rollup and **fails (exit 1) on any judge averaging below 80%
agreement** within ±0.5 tier of the hand-labeled truth. See
[`.agentrig/eval/calibration/README.md`](https://github.com/doidor/agentrig/blob/main/knowledge/templates/eval/calibration/README.md)
for the instance format and how to grow the calibration set.

---

## Per-repo customization

Everything under `.agentrig/eval/` is editable:

- **Scenarios** — `.agentrig/eval/scenarios/<id>/` (drop in your own fixture + oracle.yml)
- **Axes** — `.agentrig/eval/axes.json` (add domain-specific axes like `accessibility_compliance`)
- **Checks** — `.agentrig/eval/checks.json` (tighten or expand the structural audit)
- **Calibration** — `.agentrig/eval/calibration/<type>/*.yml`

Confirm what's actually measured with `agentrig eval --rubric`.

---

## When to run what

| When | What |
|---|---|
| Every PR | Layer A1 + A2 via `eval --static` (CI gate at `--min 80` or higher) |
| Nightly on `main` | Layer B with `--n 5` × `harness` and `baseline`, then `compare --baseline baseline` |
| Before publishing AgentRig itself | `score.mjs calibrate --report` ≥ 80% agreement for the default judge |
| When prompts/skills/rules change | Manual `eval --dynamic --variant harness-v2 --n 5` + compare against the previous `harness` variant |

## CI

The dynamic eval is too expensive for every PR. Recommended split:

```yaml
# ci.yml — every PR (cheap, deterministic, no model)
- run: npx -y @doidor/agentrig@latest eval --static --min 100

# agentrig-eval.yml — nightly on main + manual dispatch (real model spend)
on:
  schedule: [{ cron: "17 6 * * *" }]
  workflow_dispatch:
```

The full nightly workflow ships at
[`.github/workflows/agentrig-eval.yml`](https://github.com/doidor/agentrig/blob/main/.github/workflows/agentrig-eval.yml)
— it runs both variants with n=5, computes lift, uploads JSON artifacts, and posts/updates a
tracking issue with the verdict table.
