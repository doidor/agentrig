---
"@doidor/agentrig": minor
---

**Rebuild of the eval setup — three honest layers, isolated producer/judge, statistical lift, repo-specific scaffolding.**

Replaces the previous "Harness Score" theater with three bounded layers, each making an explicit claim. See `docs/evals.md` for the full rubric.

## What's new

- **Layer A1 — install completeness** and **Layer A2 — quality probes**: deterministic, no-model checks split into two scores. A2 catches content drift (parseable YAML/JSON, distinct model **families**, no unfilled `{{PLACEHOLDER}}`, every skill frontmatter, axes have issue codes) that A1's structural file-presence checks miss.
- **Layer B — fixture-based dynamic eval**: `agentrig eval --dynamic` now seeds throwaway worktrees from `scenarios/<id>/fixture/`, runs the producer in isolation, applies a deterministic oracle (`oracle.yml`) for hard axes, then runs an **independent judge** (separate `provider.startConversation()`, different model family enforced) in a dedicated cwd that doesn't see the producer's worktree or reasoning trace.
- **`agentrig eval --scaffold [--scaffold-count N]`** — agent generates repo-tailored scenarios using `.agentrig/context.md` + bundled generics as templates. Validated post-generation against the live `axes.json` registry.
- **Paired sign-test lift** — `score.mjs compare --baseline` does a real binomial sign test over `--n` paired trials, with `HELPS`/`HURTS`/`INCONCLUSIVE` verdicts. Single-trial coin flips extinct.
- **Producer/judge family divergence enforced** — `score.mjs save` rejects same-family pairs unless `--allow-same-family` is set (and records the override). Pre-flight `validateModel()` catches bad ids in ~2s instead of after 30s of producer burn.
- **Default models from the role roster** — `eval --dynamic` reads producer from `developer.yml` and judge from `reviewer.yml`. The install audit's `roles-distinct-families` check guarantees the default pair clears divergence enforcement.
- **Bundled scenarios excluded by default** — generic scenarios (`add-small-feature`, `fix-failing-test`, `review-catches-bug`) carry `bundled: true` and the dynamic eval excludes them by default so the eval reflects *your* repo's signal. `--include-bundled` opts in.
- **Per-axis veto + weight** in `axes.json` v2 (back-compat with v1). Veto axes (`correctness`, `gate_compliance`, `finding_correctness`, `blocking_decision`) fail the scenario regardless of aggregate — cosmetic axes can never paper over a real regression.
- **`log-gotcha` skill** + rewritten `self-verify` skill + inlined pre-handoff checklist in the producer prompt. The harness now nudges agents to surface red→green test evidence and commit wiki entries for non-obvious lessons.
- **Dogfood scenario** (`agentrig-init-on-empty-repo`) — the ONE scenario that tests AgentRig the product itself, deterministically, with no model. Validates that `init` + `compile` + `eval --static --min 80` keep working in a fresh empty repo.
- **CI workflow** `.github/workflows/agentrig-eval.yml` runs Layer B nightly (harness vs baseline, n=5) and posts a tracking issue with the verdict table.
- **Judge calibration** (`score.mjs calibrate`) — runs the judge over hand-labeled rubric instances in `calibration/` and reports % within ±0.5 tier + signed bias. `doctor` flags any judge below the 80% agreement threshold.

## Bug fixes shipped along the way

- Critical Rule #2 promoted wiki-logging to the top so agents see it before self-verify.
- AGENTS.md template no longer has a bare `https://github.com/)` link.
- `process.exit()`-after-`console.log` truncation on large `--json` output replaced with `process.exitCode`.
- ActivityMonitor leak when `provider.startConversation()` throws (no more terminal-flood after a failed run).
- Roster upgraded to `claude-opus-4.8` (developer/judge) + `gpt-5.5` (reviewer/triager) while preserving the developer-vs-reviewer family invariant.
- Harness staging into eval worktrees no longer pollutes the producer's diff (now committed via `--amend`).
- Report renderer leads with `Summary: X/N PASS` + per-FAIL evidence + "How to read this" closer; scoped to the current `runId` so old results never leak in.

## Knowledge migration

Knowledge version bumped 0.3.3 → 0.5.0. Run `agentrig update` to refresh artifacts in an existing repo. The new `log-gotcha` skill, calibration starter set, and bundled-flag on the generic scenarios all propagate automatically.

## Test/audit baseline at release

- 66/66 tests green
- Install Completeness: 100% (33/33)
- Quality Probes: 100% (6/6)
- Dogfood scenario passes in seconds with no LLM
