# skills-inventory populator must enumerate disk, not just manifest

## Symptoms
After `agentrig update`, the `<!-- AGENTRIG:skills-inventory:start --> ... :end -->` block in
`AGENTS.md` was populated with only the AgentRig-bundled skills — user-added skills under
`.agents/skills/` (e.g. project-specific `markbook-*` skills) were silently omitted. The
`marker-populated` audit check correctly flagged it as `PART` with
`block missing entries from .agents/skills: markbook-add-component-page, ...`.

## Root cause
`skillsInventory(manifest: Manifest)` iterated `manifest.artifacts` and matched
`/^\.agents\/skills\/([^/]+)$/` on `artifact.dest`. The manifest only knows about skills
**AgentRig ships**, so any skill the user added directly under `.agents/skills/` (the standard
extension point) was invisible to the populator.

## Fix
`skillsInventory(manifest, repoRoot?)` now walks `<repoRoot>/.agents/skills/` on disk and merges
the result with manifest-known skills. Descriptions are pulled from each skill's own `SKILL.md`
frontmatter (live source-of-truth) with the manifest as a fallback. The populator in
`src/core/markers.ts` passes `repoRoot` through so `agentrig compile` and `agentrig update`
both see the true inventory. `src/core/install.ts:75-`.

## Prevention
Any populator for a `<!-- AGENTRIG:*:start/end -->` block that mirrors a user-extensible directory
(skills, rules, agents, wiki) MUST enumerate that directory rather than the AgentRig manifest —
because the manifest only catalogs what AgentRig itself installs, and the whole point of those
directories is that users can drop more content into them.

## Related
- `src/core/markers.ts` — the populator registry; one entry per `AGENTRIG:<name>` marker.
- `knowledge/templates/eval/checks.json` — `agents-skills-inventory` uses the strict
  `marker-populated` check type and would have caught any future populator skew.
