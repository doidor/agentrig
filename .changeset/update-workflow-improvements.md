---
"@doidor/agentrig": minor
---

Update workflow + doctor + new fix command — fewer surgical edits after `agentrig update`:

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
