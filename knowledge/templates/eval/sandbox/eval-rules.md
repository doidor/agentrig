# Eval sandbox rules

These rules apply **only while running a dynamic harness evaluation** (`agentrig eval --dynamic`).
They keep the eval reproducible and side-effect-free: the eval measures how the harness *behaves*,
it must never mutate real branches or remotes.

## Hard guardrails (do not violate)
- **No `git push`** of any kind.
- **No PR creation, no merges, no label changes** on real issues/PRs.
- **No writes outside the scenario worktree** under `~/.agentrig/worktrees/…`.
- **No network mutations** (no `gh pr`, `gh issue edit`, release, deploy).
- Read-only `gh` lookups (e.g. `gh pr view`) are allowed.

## Reproducibility
- Start each scenario from its pinned `base_commit` (see the scenario frontmatter) so results are
  replayable.
- Record per-run artifacts next to the score: `diff.patch` (the produced change), `output` (a short
  transcript/summary), and `meta.json` (scenario id, base_commit, variant, model, duration). These
  make regressions inspectable at the artifact level, not just the scalar score.

## If a guardrail would block legitimate work
Stop and **self-park** with a note. A scenario that can only be completed by pushing or merging is
mis-specified — fix the scenario, not the guardrail.
