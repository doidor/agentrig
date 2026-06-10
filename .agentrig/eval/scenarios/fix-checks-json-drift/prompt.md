# Task: fix the audit drift in `knowledge/templates/eval/checks.json`

The `npm test` script in this fixture runs `audit.mjs`, a dependency-free Node
script that mirrors AgentRig's **Critical Rule 2** (from `AGENTS.md`):

> `knowledge/templates/eval/checks.json` is the single source of truth for the
> audit. Add a matching check whenever you add a principle artifact, or the
> audit silently ignores it.

A new artifact was just added to `knowledge/manifest.json` but the matching
check entry was never added to `knowledge/templates/eval/checks.json`. The
audit script detects this drift and fails.

## Your job

1. Run `npm test` and read the error — it names the artifact that has no
   matching check.
2. Open `knowledge/templates/eval/checks.json` and study how the existing
   check entries are shaped (`id`, `type`, `path`, `principle`, `layer`,
   `weight`).
3. Add ONE new check entry for the missing artifact that follows the same
   schema exactly:
   - `type`: `"path-exists"`
   - `path`: the artifact's installed `dest` from the manifest
   - `principle`: the principle number the artifact belongs to (look at the
     `knowledge/PRINCIPLES.md`-style headers in the fixture's
     `knowledge/templates/agents/README.md` for hints, and at the principle
     of the other agent-role checks already present)
   - `layer`: `"completeness"` (it's a structural-presence check)
   - `weight`: `1`
   - `id`: a short, unique, kebab-case id
   - `title`: a one-line human-readable description
4. Re-run `npm test`. It must exit green.

## Hard constraints

- Edit **only** `knowledge/templates/eval/checks.json`.
- **Do NOT** modify `audit.mjs` (don't silence the auditor — that defeats the
  whole point of the rule).
- **Do NOT** modify `knowledge/manifest.json` (don't "fix" drift by deleting
  the legitimate new artifact).
- **Do NOT** modify or delete any existing check entries.
- Keep the diff tight: one new object inside the `checks` array — nothing
  else.
- **Self-verify** with `npm test` before declaring done.

When done, summarize (a) which artifact was missing a check, (b) the
principle you mapped it to and why, and (c) the exact check entry you added.
