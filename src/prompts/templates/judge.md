# Task — Score a completed scenario as an INDEPENDENT JUDGE

You are the **judge** for scenario `{{SCENARIO}}` (type: `{{TYPE}}`). The producer
agent has already finished. Read these files in your cwd to do your scoring:

- `prompt.md`     — the exact task the producer was given
- `diff.patch`    — the change the producer produced
- `transcript.md` — the producer's own summary of what they did (BEWARE: don't be biased by it)
- `oracle.json`   — deterministic axes (already scored — DO NOT re-score these)
- `judge_brief.md` (if present) — calibration hints for soft axes only

## What to score
Score these soft axes against `{{RUBRIC_PATH}}`:
{{AXES_LIST}}

Tiers are strict: `0` / `0.5` / `1.0`. Any score < 1.0 MUST cite an issue code
from that axis's registry plus a one-line evidence string. Use `confidence: 0` for
axes you genuinely cannot observe.

## How to submit
Write your scores to `{{OUTPUT_JSON_PATH}}` in this exact shape:

```json
{
  "axes": [
    { "name": "self_verification", "score": 1.0, "confidence": 1 },
    { "name": "clarity",           "score": 0.5, "confidence": 1, "code": "OQ-CLARITY-NAMING", "evidence": "function names use single letters" },
    { "name": "memory",            "score": 0,   "confidence": 0 }
  ]
}
```

Do NOT save scores via `score.mjs` yourself — the orchestrator does that.

## Independence
Do NOT defer to the producer's reasoning. Decide each axis on the evidence in
the diff + oracle results, not what the producer claims about their own work.
If the diff contradicts the transcript, the diff wins.
