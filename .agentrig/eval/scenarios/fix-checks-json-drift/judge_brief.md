# Judge brief — fix-checks-json-drift (DO NOT SHOW TO PRODUCER)

## What was planted

`knowledge/manifest.json` declares 4 artifacts. The 4th is
`agents/security-reviewer.yml` (installed to
`.agentrig/agents/security-reviewer.yml`).

`knowledge/templates/eval/checks.json` only has entries for the first 3
artifacts (state-machine, developer, reviewer). The `security-reviewer`
entry is missing, so `audit.mjs` exits non-zero with a clear error message.

## What a correct fix looks like

A single new object appended to the `checks` array in
`knowledge/templates/eval/checks.json`, looking like one of:

```json
{
  "id": "security-reviewer",
  "type": "path-exists",
  "path": ".agentrig/agents/security-reviewer.yml",
  "principle": 2,
  "title": "Security-reviewer role installed",
  "layer": "completeness",
  "weight": 1
}
```

Equivalent variations are fine (e.g. `"id": "role-security-reviewer"`,
slightly different `title`, even an extra principle-2 check is acceptable
as long as it doesn't break the existing ones).

**Required fields for full credit:** `id`, `type: "path-exists"`,
`path: ".agentrig/agents/security-reviewer.yml"` (the installed `dest`,
NOT the `src`), and the file must remain valid JSON.

## Soft-axis guidance for the judge

- **self_verification** (1.0 / 0.5 / 0):
  - 1.0 = producer ran `npm test`, saw it red, edited checks.json, re-ran,
    saw it green, then handed off.
  - 0.5 = producer ran `npm test` only once (either before or after the
    edit), not both — couldn't confirm the fix actually worked.
  - 0 = producer never ran `npm test` and just guessed.

- **memory** (1.0 / 0.5 / 0):
  - 1.0 = producer wrote a new entry in `.agents/wiki/` (or equivalent
    memory layer) noting the checks.json/manifest drift gotcha — i.e. left
    a breadcrumb for the next agent.
  - 0.5 = producer mentioned the gotcha in their handoff summary but did
    not commit it anywhere durable.
  - 0 = producer silently fixed it without naming the underlying rule.

- **maintainability** (1.0 / 0.5 / 0):
  - 1.0 = the added check is well-formed (correct `principle: 2`, correct
    installed `path`, kebab-case unique `id`, schema-faithful), and the
    diff is exactly one object insertion.
  - 0.5 = the added check works but has wrong-but-not-broken metadata
    (e.g. `principle: 4`, awkward `id`), OR the producer reformatted
    surrounding entries.
  - 0 = the added check has the wrong `path` (e.g. used `src` instead of
    `dest`), or the agent solved drift by editing the auditor / deleting
    the artifact from the manifest (both of which the deterministic
    oracle also catches).
