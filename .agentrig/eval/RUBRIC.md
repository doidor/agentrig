# Harness evaluation rubric (principle 6)

Three layers. Each makes a different, **bounded** claim — don't over-read what any one of them proves.

| Layer | What it actually proves | What it does NOT prove | Cost |
|---|---|---|---|
| **A1 — install completeness** | every canonical artifact is present and minimally well-formed | the artifacts *work*, or that agents respect them | ~1 second, no model |
| **A2 — quality probes** | content sanity (parseable YAML/JSON, no unfilled `{{PLACEHOLDER}}`, distinct model **families**, every skill has frontmatter, axes have issue codes) | semantic quality of the content | ~1 second, no model |
| **B — dynamic behavioral eval** | how the harness *changes agent behavior* on fixed fixtures — verified by deterministic oracles for hard axes + an independent judge for soft axes, with paired sign-test lift vs a baseline | absolute "is this agent good" — only relative to baseline | minutes to hours, real model spend |

All three persist results under `.agentrig/eval/results/` via `score.mjs`. **Never hand-edit** the JSON.
The schema is validated on read (`schemaVersion: 2`) and on write — invalid records are quarantined
into `results/_legacy/`.

---

## Layer A1 + A2 — static audit (`agentrig eval --static`)

Scored from `checks.json`. Each check earns **0 / 0.5 / 1.0** and carries a `layer` field
(`completeness` vs `quality`). Two aggregate scores:

- **Install Completeness** — was every canonical artifact installed where the manifest said it should be?
- **Quality Probes** — does the content of those artifacts pass cheap sanity checks?

```bash
node .agentrig/eval/static-audit.mjs            # human report (both layers)
node .agentrig/eval/static-audit.mjs --json     # machine-readable
node .agentrig/eval/static-audit.mjs --min 80   # exit non-zero if completeness < 80%
```

A1 is what CI gates on (`--min`). A2 surfaces drift but doesn't fail the build — it's diagnostic.

---

## Layer B — dynamic behavioral eval (`agentrig eval --dynamic`)

For each scenario:

1. **Seed** a throwaway worktree from `scenarios/<id>/fixture/`.
2. **Producer** (one model, runs in the worktree) executes `prompt.md`. Stage the harness or not, per `--variant`.
3. **Oracle** (`scenarios/<id>/oracle.yml`) runs deterministic checks (commands, diff stats, file presence) → hard-axis scores.
4. **Judge** (a *different model family*, runs in its own cwd with prompt+diff+transcript+oracle but **NOT** the producer's worktree or reasoning) scores soft axes against `axes.json`.
5. **Save** via `score.mjs save` — validated against the rubric registry.

### Producer/judge isolation
- The producer and the judge are **separate `provider.startConversation()` calls**. The judge never sees the producer's reasoning trace.
- `score.mjs save` rejects a record where the producer and judge share a **model family** (e.g. both `claude-*`). Override with `--allow-same-family` — and the override is recorded in the result so reviewers can spot lazy single-model setups.
- The judge writes scores via a JSON file (`<artifactsDir>/<scenario>.trial<N>.judge.json`), not free-form text. The orchestrator reads + validates it against `axes.json`.

### Rubric rules (enforced by `score.mjs`)
1. **Strict 3-tier** scores: `0` / `0.5` / `1.0`.
2. **Issue code required.** Any axis < 1.0 with `confidence > 0` must carry an issue code from that axis's bounded registry plus a one-line evidence string.
3. **Confidence-gated.** An axis you couldn't observe is `=na` (confidence 0) and excluded from rollups.
4. **Weighted aggregation.** Axes carry an optional `weight` (default 1) and `veto: true`. The aggregate is a weighted mean of observed axes.
5. **Pass rule:** `aggregate ≥ passThreshold` **AND** no observed axis at 0 **AND** no veto axis < 1.0. Veto fails are surfaced in the `failReason` field.

### Lifecycle types
| `--type` | Categories | Veto axes |
|---|---|---|
| `spec` | `clarity`, `acceptance_criteria`, `scope_bounded`, `testability`, `context` | `acceptance_criteria` |
| `run` | `output_quality`, `agent_behavior`, `long_term_impact` (10 axes total) | `correctness`, `gate_compliance` |
| `review` | `review_quality` (7 axes) | `finding_correctness`, `blocking_decision` |

### Multi-trial + statistical lift (`--n` + `compare --baseline`)

Single-trial verdicts are coin flips. The eval requires `n ≥ 3` paired trials for any verdict
other than `INCONCLUSIVE`:

```bash
# Run both variants 5 times each.
agentrig eval --dynamic --variant harness  --n 5
agentrig eval --dynamic --variant baseline --n 5

# Paired sign test, median delta, p-value:
node .agentrig/eval/score.mjs compare --scenario <id> --baseline baseline
```

Verdicts:
- **HELPS**  — p < 0.05, median delta > 0.05
- **HURTS**  — p < 0.05, median delta < -0.05
- **INCONCLUSIVE** — n < 3, or p ≥ 0.05, or |median delta| < 0.05

### Sandboxing
Run dynamic evals under [`sandbox/eval-rules.md`](sandbox/eval-rules.md): the producer works in a
throwaway worktree under `$TMPDIR/agentrig-eval/<runId>/<scenario>/` and **must not push, open PRs,
or merge** — the eval measures behavior, it must not mutate real branches.

---

## Calibrating the judge (`calibration/`)

A judge that always returns 1.0 passes every `score.mjs save` validation but tells you nothing.
The `calibration/` directory holds **hand-labeled** rubric instances (scenario inputs + transcript +
diff + ground-truth axes). `score.mjs calibrate --judge <model>` runs your judge over them and
reports % agreement (within ±0.5 tier) and signed bias.

```bash
# After your judge wrote scores to /tmp/judge-out.json:
node .agentrig/eval/score.mjs calibrate \
  --judge gpt-5.5 --instance .agentrig/eval/calibration/run/seed-correct.yml \
  --judge-scores /tmp/judge-out.json
node .agentrig/eval/score.mjs calibrate --report
```

`agentrig doctor` reads the calibration rollup and flags any judge below **80% agreement**. See
[`calibration/README.md`](calibration/README.md) for the format and how to add more instances.

---

## When to run what

| When | What |
|---|---|
| Every PR | A1 + A2 via `eval --static` (CI gate at `--min 80` or higher) |
| Nightly on main | Layer B with `--n 5` × `harness` and `baseline`, then `compare --baseline baseline` |
| Before releasing AgentRig | `score.mjs calibrate --report` ≥ 80% for default judge |
| When prompts/skills/rules change | Manual `eval --dynamic --variant harness-v2 --n 5` + compare against `harness` |
