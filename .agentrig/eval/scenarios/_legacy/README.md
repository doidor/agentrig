# Dynamic-eval scenarios

Each scenario is a replayable benchmark task with YAML frontmatter:

```yaml
---
id: <scenario-id>
type: run | spec | review     # which rubric in axes.json to score against
scope: patch | feature | epic # size class (epichan-style)
base_commit: <sha|HEAD>       # pin so the task is replayable from an exact state
principle_focus: [..]         # which harness principles this stresses
prompt: >- ...                # the task handed to the harness
---
```

`agentrig eval --dynamic` runs these through the harness; an independent judge scores each against
`../RUBRIC.md` / `../axes.json` and persists via `../score.mjs`.

- Run one: `agentrig eval --dynamic --scenario <id>`
- A/B a harness change: re-run a scenario under a `--variant` and `score.mjs compare --scenario <id>`.

Add scenarios by dropping a new `*.md` here with the frontmatter above. Keep them small and focused.
Run results (JSON + any diff.patch/output/meta artifacts) are written to `../results/` and are
git-ignored.
