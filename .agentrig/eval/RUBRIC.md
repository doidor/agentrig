# Harness evaluation rubric (principle 6)

Two layers. **Layer A** is deterministic and model-free; **Layer B** is an independent,
model-judged behavioral eval. Both write to `.agentrig/eval/results/` via `score.mjs`
(never hand-edit JSON). The machine-readable rubric registry lives in
[`axes.json`](./axes.json) — `score.mjs` validates every score against it.

---

## Layer A — Static harness audit
Scored automatically by `checks.json`. Each check maps to a principle and earns **0 / 0.5 / 1.0**.
The aggregate is the **Harness Score** (0–100%). Run:

```bash
node .agentrig/eval/static-audit.mjs           # or: agentrig eval --static
```

Treat any principle scoring < 1.0 as a missing/weak artifact to fix.

---

## Layer B — Dynamic behavioral eval

For each scenario, run the task through the harness, then have an **independent judge model**
(different from the producer) score the result. Scoring is **strict 3-tier: 0 / 0.5 / 1.0**.

Three rules, enforced by `score.mjs` against `axes.json`:
1. **Issue code required.** Any axis < 1.0 (and observed) must carry an issue code **from that
   axis's bounded registry** plus a one-line **evidence** string. Invented codes are rejected.
2. **Confidence-gated.** An axis you couldn't observe is scored `na` (confidence 0) and excluded
   from rollups — partial observability never contaminates the total.
3. **Rollups are recomputed from axes.** Category and aggregate scores come from the axis data, not
   from anything the judge asserts.

### Multi-rubric lifecycle
The eval covers the whole lifecycle, not just the final patch. Three rubric **types**, linked by the
same `--task` id so you get a spec → run → review view:

| `--type` | What it scores | Categories |
|----------|----------------|------------|
| `spec`   | task/issue spec quality (before work) | spec_quality (clarity, acceptance_criteria, scope_bounded, testability, context) |
| `run`    | the implementation run | output_quality, agent_behavior, long_term_impact |
| `review` | the reviewer's own behavior | review_quality (finding_correctness, severity_calibration, false_positive_rate, coverage, actionability, independence, blocking_decision) |

### `run` axes (the most common)
- **Output Quality** — `correctness`, `scope`, `tests`, `clarity`
- **Agent Behavior** — `self_verification`, `gate_compliance`, `tool_discipline`, `escalation`
- **Long-Term Impact** — `memory`, `regression_risk`, `maintainability`

See `axes.json` for the full per-axis issue-code registries (e.g. `OQ-SCOPE-CHURN`,
`AB-VERIFY-REDHANDOFF`, `LT-REGRESS-LIKELY`).

### Saving and reading scores
```bash
# Save one rubric (any axis < 1.0 needs CODE:evidence; use `=na` for unobserved axes)
node .agentrig/eval/score.mjs save --type run --task add-small-feature \
  --scenario add-small-feature --judge <model> [--variant v2] [--run RID] \
  --axis 'correctness=1.0' \
  --axis 'scope=0.5:OQ-SCOPE-CHURN:left package-lock churn in the diff' \
  --axis 'tests=na'

node .agentrig/eval/score.mjs report                     # latest per scenario/variant + per-axis means
node .agentrig/eval/score.mjs compare --scenario <id>    # A/B variants side by side
```

### A/B variant evaluation
Run the **same scenario** under different harness versions (a prompt/skill/rule change) and save each
under a `--variant`. `score.mjs compare` puts them side by side. **A change that lowers the score is
a regression even if it "feels" better.** For deeper diffing, keep each run's `diff.patch` /
`output` artifacts next to the score (see the `harness-eval` skill).

### Harness lift — does it actually help? (with vs without)
Prove the harness earns its keep in *your* repo by comparing a harness-on run to a harness-off
baseline:

```bash
agentrig eval --dynamic --scenario <id> --variant harness    # harness ON
agentrig eval --dynamic --scenario <id> --variant baseline   # bare agent, no AGENTS.md/rules/skills
node .agentrig/eval/score.mjs compare --scenario <id> --baseline baseline
```

`compare --baseline` prints the per-axis and aggregate **delta** and a `HELPS`/`HURTS` verdict. A
positive aggregate delta means installing AgentRig improved agent behavior here.

### Threshold
A scenario passes if its aggregate ≥ **0.8** (`passThreshold` in `axes.json`) with no observed axis
at 0.

---

## Sandboxing
Run dynamic evals under the guardrails in [`sandbox/eval-rules.md`](./sandbox/eval-rules.md): the
agent works in a throwaway worktree and must **not push, open PRs, or merge** — the eval measures
behavior, it must not mutate real branches.
