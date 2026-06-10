# Scenario: fix `checks.json` drift (AgentRig-specific)

This scenario exercises the single most AgentRig-specific foot-gun, called out
verbatim as **Critical Rule 2** in this repo's root `AGENTS.md`:

> `knowledge/templates/eval/checks.json` is the single source of truth for the
> audit. Both the CLI (`src/core/audit.ts`) and the in-repo `static-audit.mjs`
> interpret it. Add a matching check whenever you add a principle artifact, or
> the audit silently ignores it.

## What's planted

The fixture is a miniature mirror of AgentRig's own `knowledge/` layout:

- `knowledge/manifest.json` declares **4** principle artifacts (a
  state-machine, a developer role, a reviewer role, and a new
  `security-reviewer` role).
- `knowledge/templates/eval/checks.json` only contains entries for **3** of
  them. The `security-reviewer` artifact is missing.
- `audit.mjs` is a dependency-free Node-stdlib script (modelled after
  AgentRig's real `static-audit.mjs`) that cross-references the two files and
  fails when an artifact has no matching check.

The producer agent must add the missing `path-exists` check entry to
`checks.json`, matching the existing schema (`id`, `type`, `path`,
`principle`, `layer`, `weight`).

## Stack parity

This fixture uses exactly the AgentRig stack:

- **npm** (`package.json`, `npm test`)
- **Node ≥20 / ESM** (`"type": "module"`, `.mjs` scripts)
- **No test framework, no dependencies** — verification is a hand-rolled
  dep-free Node stdlib audit script, exactly like AgentRig's own
  `.agentrig/eval/static-audit.mjs`

## Oracle

- `correctness`: `npm test` exits 0 after the fix.
- `tool_discipline`: `checks.json` now references the new artifact's
  installed path (`.agentrig/agents/security-reviewer.yml`).
- `scope`: diff ≤ 20 added lines and ≤ 1 file touched.
- `regression_risk`: `audit.mjs` and `knowledge/manifest.json` are left
  untouched, and no existing check entries are deleted.

Soft axes (`self_verification`, `memory`, `maintainability`) are scored by
the LLM judge using the producer's transcript + diff.

## What a defect looks like

- The agent edits `audit.mjs` to ignore the missing entry — silences the
  auditor instead of fixing the data.
- The agent deletes `security-reviewer` from `manifest.json` — pretends the
  artifact doesn't exist.
- The agent adds the new entry with the wrong `path` (e.g. the source
  `agents/security-reviewer.yml` instead of the installed
  `.agentrig/agents/security-reviewer.yml`) — would pass the file-contains
  oracle but break the real audit.
- The agent adds the entry with `principle: 4` (skills) or `12`
  (instructions) instead of `2` (roles) — wrong taxonomy.

Only the first two are caught deterministically; the latter two are caught
by the judge on `maintainability`.
