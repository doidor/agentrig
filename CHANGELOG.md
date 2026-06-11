# @doidor/agentrig

## 0.11.2

### Patch Changes

- [#19](https://github.com/doidor/agentrig/pull/19) [`dd90c32`](https://github.com/doidor/agentrig/commit/dd90c32348a9756fd443ad93975d1418e9cb3fff) Thanks [@doidor](https://github.com/doidor)! - Docs: surface `agentrig eval --scaffold` (repo-tailored eval scenario generation) much earlier so
  users discover it right away. It now appears in the README quickstart and the "Evaluating the
  harness" intro callout, the docs landing-page feature card, the getting-started "Evaluate" step, and
  a top-of-page pointer in the evals guide — instead of being buried at the bottom of the eval docs.

## 0.11.1

### Patch Changes

- [#17](https://github.com/doidor/agentrig/pull/17) [`900c39c`](https://github.com/doidor/agentrig/commit/900c39c22a781e228b1be41329233765ee2d28ba) Thanks [@doidor](https://github.com/doidor)! - Harness content quality fixes (consistency + dedup), applied to the canonical templates and the
  dogfooded harness:

  - Fix the invalid `model_tier: high` in every agent role → `premium` (matches each role's pinned
    model and the `cheap`/`standard`/`premium` vocabulary the state machine defines). Behavior is
    unchanged — only the label was wrong.
  - `rules/coding-standards.md` now declares `priority: 3`, as `rules/README.md` requires of every
    rule.
  - The `harness-eval` skill gains a `triggers:` block, for parity/discoverability with the other
    skills.
  - `skill-authoring` and `skill-improver` add `Write` to `allowed-tools` so they can actually create
    the files they describe.
  - De-duplicate the wiki docs: `README.md` owns policy (tiers + admission test) and points at
    `_TEMPLATE.md` for the entry format; `index.md` is now router/index-only.

  Internal (no user-facing behavior change): the agent prompt copy moved out of
  `src/prompts/index.ts` into `src/prompts/templates/*.md`, read at runtime — assembled output is
  byte-identical to before.

## 0.11.0

### Minor Changes

- [#15](https://github.com/doidor/agentrig/pull/15) [`3d04ba8`](https://github.com/doidor/agentrig/commit/3d04ba8daa526241b60c44453a4ee304d622e28b) Thanks [@doidor](https://github.com/doidor)! - Update workflow + doctor + new fix command — fewer surgical edits after `agentrig update`:

  - **Marker populator.** `<!-- AGENTRIG:skills-inventory:start --> ... :end -->` in `AGENTS.md` is
    now rewritten deterministically by both `compile` and `update`, so the block always reflects
    the installed skills. The audit check is upgraded to `marker-populated` — it now fails if the
    block is empty, has unfilled placeholders, or misses any skill under `.agents/skills/`.
  - **`agentrig fix` + `agentrig update --auto-fix`.** Deterministically repair A1 failures —
    restore broken `.agentrig/**/*.yml` from canonical, replace unknown model ids (e.g. the
    retired `gpt-5`) with the safe `auto` fallback. No agent or network needed.
  - **Update validates before exiting.** `update` now runs `validateYaml` + `validateModelIds` and
    refuses to leave a broken install in place — pass `--auto-fix` to self-heal or run
    `agentrig fix` afterward. Avoids the "audit was PART/FAIL but `update` exited 0" failure mode.
  - **`--diff` drift classification.** Preserved files are tagged `🔴 broken`, `🟡 stale`,
    `🟢 enhancement`, or `⚪ mixed` so humans (and agents) can decide what's safe to auto-resolve.
  - **Update enumerates added + preserved files** instead of only printing counts; lists drifted
    files inline when `--skip-agent` is used.
  - **Reconciliation history.** `.agentrig/state.json` now records per-file decisions
    (`reconciled[]`); a future `agentrig update` skips re-prompting on files the user chose to
    keep local — unless canonical drifts past the hash that was recorded at decision time.
  - **Doctor.** Adds install-provenance detection (`linked-checkout` vs `registry`), an npm-latest
    comparison, and explicit validation findings so a broken YAML / unknown model id blocks
    `doctor` from returning 0.

  Knowledge bundle bumped to `0.6.0`.

## 0.10.0

### Minor Changes

- [#12](https://github.com/doidor/agentrig/pull/12) [`e75cb49`](https://github.com/doidor/agentrig/commit/e75cb4970b9b5e1587611e369de58b2a6333f42c) Thanks [@doidor](https://github.com/doidor)! - **Rebuild of the eval setup — three honest layers, isolated producer/judge, statistical lift, repo-specific scaffolding.**

  Replaces the previous "Harness Score" theater with three bounded layers, each making an explicit claim. See `docs/evals.md` for the full rubric.

  ## What's new

  - **Layer A1 — install completeness** and **Layer A2 — quality probes**: deterministic, no-model checks split into two scores. A2 catches content drift (parseable YAML/JSON, distinct model **families**, no unfilled `{{PLACEHOLDER}}`, every skill frontmatter, axes have issue codes) that A1's structural file-presence checks miss.
  - **Layer B — fixture-based dynamic eval**: `agentrig eval --dynamic` now seeds throwaway worktrees from `scenarios/<id>/fixture/`, runs the producer in isolation, applies a deterministic oracle (`oracle.yml`) for hard axes, then runs an **independent judge** (separate `provider.startConversation()`, different model family enforced) in a dedicated cwd that doesn't see the producer's worktree or reasoning trace.
  - **`agentrig eval --scaffold [--scaffold-count N]`** — agent generates repo-tailored scenarios using `.agentrig/context.md` + bundled generics as templates. Validated post-generation against the live `axes.json` registry.
  - **Paired sign-test lift** — `score.mjs compare --baseline` does a real binomial sign test over `--n` paired trials, with `HELPS`/`HURTS`/`INCONCLUSIVE` verdicts. Single-trial coin flips extinct.
  - **Producer/judge family divergence enforced** — `score.mjs save` rejects same-family pairs unless `--allow-same-family` is set (and records the override). Pre-flight `validateModel()` catches bad ids in ~2s instead of after 30s of producer burn.
  - **Default models from the role roster** — `eval --dynamic` reads producer from `developer.yml` and judge from `reviewer.yml`. The install audit's `roles-distinct-families` check guarantees the default pair clears divergence enforcement.
  - **Bundled scenarios excluded by default** — generic scenarios (`add-small-feature`, `fix-failing-test`, `review-catches-bug`) carry `bundled: true` and the dynamic eval excludes them by default so the eval reflects _your_ repo's signal. `--include-bundled` opts in.
  - **Per-axis veto + weight** in `axes.json` v2 (back-compat with v1). Veto axes (`correctness`, `gate_compliance`, `finding_correctness`, `blocking_decision`) fail the scenario regardless of aggregate — cosmetic axes can never paper over a real regression.
  - **`log-gotcha` skill** + rewritten `self-verify` skill + inlined pre-handoff checklist in the producer prompt. The harness now nudges agents to surface red→green test evidence and commit wiki entries for non-obvious lessons.
  - **Dogfood scenario** (`agentrig-init-on-empty-repo`) — the ONE scenario that tests AgentRig the product itself, deterministically, with no model. Validates that `init` + `compile` + `eval --static --min 80` keep working in a fresh empty repo.
  - **CI workflow** `.github/workflows/agentrig-eval.yml` runs Layer B nightly (harness vs baseline, n=5) and posts a tracking issue with the verdict table.
  - **Judge calibration** (`score.mjs calibrate`) — runs the judge over hand-labeled rubric instances in `calibration/` and reports % within ±0.5 tier + signed bias. `doctor` flags any judge below the 80% agreement threshold.

  ## Bug fixes shipped along the way

  - Critical Rule [#2](https://github.com/doidor/agentrig/issues/2) promoted wiki-logging to the top so agents see it before self-verify.
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

## 0.9.0

### Minor Changes

- [#8](https://github.com/doidor/agentrig/pull/8) [`fc70643`](https://github.com/doidor/agentrig/commit/fc706433018acf6e91e21c49fe3cedb1dd278856) Thanks [@doidor](https://github.com/doidor)! - **`agentrig init` is now non-destructive by default.** Previously, `init` unconditionally clobbered any existing `AGENTS.md`, `.mcp.json`, or hand-tailored rule/skill/wiki file at the destination — making it dangerous to adopt AgentRig in a repo that already had agent content (e.g. a curated `AGENTS.md` from a prior harness).

  Now `init`:

  - Preserves any existing destination file by default (file content is left verbatim, SHA-identical).
  - Reports preserved files in the install summary (`preserved N existing file(s) — pass --force to overwrite: …`).
  - Still installs all the canonical machinery around what you have (`.agentrig/`, skills, projection symlinks, scripts).
  - Compiles your existing `AGENTS.md` into every projected agent surface — so `agentrig init` becomes the natural "adopt AgentRig in this existing repo" entry point.

  Pass `--force` to opt into the previous overwriting behavior. `agentrig init --dry-run` now shows `(new)`, `(preserve existing)`, or `(OVERWRITE)` per file.

  `agentrig update` is unchanged — it still refreshes overwrite-policy machinery as before.

## 0.8.0

### Minor Changes

- [#6](https://github.com/doidor/agentrig/pull/6) [`b85dced`](https://github.com/doidor/agentrig/commit/b85dced9616811a2f9f618bfa6cea7beef1b28d1) Thanks [@doidor](https://github.com/doidor)! - First public release as the scoped package `@doidor/agentrig`: a meta-harness CLI that installs
  best-practice agent harnesses into any repo and projects them to every agent surface (local +
  remote). Includes automated Changesets releases with npm provenance, Node >= 22, and CI/release
  status badges.

## 0.7.0

### Minor Changes

- [#3](https://github.com/doidor/agentrig/pull/3) [`2e1de2f`](https://github.com/doidor/agentrig/commit/2e1de2f72b04b08b3b20c08c22610d4868785628) Thanks [@doidor](https://github.com/doidor)! - First public release as the scoped package `@doidor/agentrig`: a meta-harness CLI that installs
  best-practice agent harnesses into any repo and projects them to every agent surface (local +
  remote). Includes automated Changesets releases with npm provenance, Node >= 22, and CI/release
  status badges.

### Patch Changes

- [#3](https://github.com/doidor/agentrig/pull/3) [`2e1de2f`](https://github.com/doidor/agentrig/commit/2e1de2f72b04b08b3b20c08c22610d4868785628) Thanks [@doidor](https://github.com/doidor)! - `agentrig compile` now mirrors the **entire** AGENTS.md body into the projected `.github/copilot-instructions.md` and `CLAUDE.md`, instead of cherry-picking only the `Critical Rules` and `What this repository is` sections. Anything the user adds to AGENTS.md (custom sections, repo-specific guidance) now flows through to every downstream agent surface.

  Internally the projection now strips the H1 title, the `<!-- AGENTRIG:…:start/end -->` marker comments (which are AGENTS.md-internal update-protection), and any lines still carrying unfilled `{{PLACEHOLDER}}` template tokens.

## 0.6.0

### Minor Changes

- [#1](https://github.com/doidor/agentrig/pull/1) [`dc7c740`](https://github.com/doidor/agentrig/commit/dc7c740001dc8a7c0ea4c7f8d7fb9ed617a5efee) Thanks [@doidor](https://github.com/doidor)! - First public release as the scoped package `@doidor/agentrig`: a meta-harness CLI that installs
  best-practice agent harnesses into any repo and projects them to every agent surface (local +
  remote). Includes automated Changesets releases with npm provenance, Node >= 22, and CI/release
  status badges.
