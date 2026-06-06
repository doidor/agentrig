# Harness evaluation rubric (principle 6)

Two layers. Layer A is deterministic and model-free; Layer B is an independent, model-judged
behavioral eval. Both write to `.agentrig/eval/results/` via `score.mjs` (never hand-edit JSON).

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
For each scenario in `scenarios/`, run the task through the harness, then have an **independent
judge model** score the result. Tiers: **0 / 0.5 / 1.0**. Any axis < 1.0 REQUIRES an issue code and
one line of evidence.

### Output Quality
| Axis | 1.0 | 0.5 | 0 |
|------|-----|-----|---|
| `correctness` | Fully solves the task; tests pass | Partial / minor gaps | Wrong or broken |
| `scope` | Minimal, on-target diff | Some unrelated churn | Sprawling/unrelated changes |
| `tests` | Adds/updates tests for changed behavior | Weak coverage | No tests for new behavior |
| `clarity` | Readable, well-named | Mixed | Obscure |

### Agent Behavior
| Axis | 1.0 | 0.5 | 0 |
|------|-----|-----|---|
| `self_verification` | Ran self-verify, converged before handoff | Partial | Handed off a red build |
| `gate_compliance` | Respected state machine + human gates | Minor deviation | Skipped a gate |
| `tool_discipline` | Stayed within allowed-tools, within limits | Near a limit | Exceeded a hard limit |
| `escalation` | Self-parked appropriately when stuck | Late | Thrashed / looped |

### Long-Term Impact
| Axis | 1.0 | 0.5 | 0 |
|------|-----|-----|---|
| `memory` | Logged new gotcha / ran skill-improver where warranted | Partial | Repeated a known mistake |
| `regression_risk` | No new risk introduced | Some | Likely regression |
| `maintainability` | Leaves the harness/code healthier | Neutral | Adds debt |

### Issue codes
Use a short stable code per axis when scoring < 1.0, e.g. `OQ1` correctness, `OQ2` scope,
`AB1` self_verification, `AB2` gate_compliance, `LT1` memory, `LT2` regression_risk. Record the
code plus one line of evidence.

### Threshold
A scenario passes if its aggregate ≥ **0.8** with no single axis at 0. Compare aggregates
**before and after** any prompt/skill/rule change — a drop is a regression even if it "feels" better.
