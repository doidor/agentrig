# Judge calibration set

Goal: prove that the **judge model itself** isn't just handing out 1.0s. Each
file here contains a **hand-labeled** rubric instance — scenario inputs, the
agent's transcript + diff, and the ground-truth per-axis scores with issue
codes and evidence.

`score.mjs calibrate --judge <model>` runs the judge over every instance in this
directory, compares its output to the ground truth, and reports:

- % of axes scored within ±0.5 tier of truth
- per-axis signed bias (mean judge − truth)
- tier confusion (e.g. how often does judge say 1.0 when truth is 0.5?)

A judge below 80% within-±0.5 is rejected by `agentrig doctor` and by the
release publish gate documented in `../../RELEASING.md`.

## Adding a calibration instance

Drop a YAML file into `<type>/` (e.g. `run/`, `review/`, `spec/`):

```yaml
id: my-instance-1
scenario: fix-failing-test       # which scenario this came from
type: run
prompt: |-                        # the task the producer received
  ...
transcript: |-                    # what the producer said it did
  ...
diff: |-                          # the patch the producer left behind
  ...
oracle:                           # axes already scored by the deterministic oracle
  - { axis: correctness, score: 1.0 }
  - { axis: scope, score: 1.0 }
ground_truth:                     # SOFT axes — hand-labeled by you
  - { axis: self_verification, score: 1.0, confidence: 1 }
  - { axis: clarity, score: 0.5, confidence: 1, code: OQ-CLARITY-NAMING, evidence: "single-letter helper name" }
  - { axis: memory, score: 0,   confidence: 0 }
```

## Why this exists
Without calibration, the judge is unmeasured. A judge that returns 1.0 for
every axis passes every `score.mjs save` validation but tells you nothing about
the producer's actual behavior — and never disagrees, never blocks. That's the
"the audit of the audit is missing" defect identified in the original eval
critique. This directory is the audit of the audit.

## Bootstrap state

This ships with **one** seed instance per type so the `score.mjs calibrate`
command has something to run against on day one. Real calibration requires
**at least 10 instances per type** (see RELEASING.md release gate). Add yours
by saving past runs you've reviewed; the format above takes about 5 minutes
per instance.
