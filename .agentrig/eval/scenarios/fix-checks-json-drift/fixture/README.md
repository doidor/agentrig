# fix-checks-json-drift fixture

A minimal mirror of AgentRig's own `knowledge/` layout, used by the
`fix-checks-json-drift` scenario.

```
.
├── audit.mjs                                  # dep-free Node stdlib audit
├── package.json                               # `npm test` → `node audit.mjs`
└── knowledge/
    ├── manifest.json                          # declares 4 artifacts
    └── templates/
        ├── harness/state-machine.yml
        ├── agents/developer.yml
        ├── agents/reviewer.yml
        ├── agents/security-reviewer.yml       # the new artifact
        └── eval/checks.json                   # missing security-reviewer check
```

The audit script cross-references every artifact's installed `dest` (declared
in `manifest.json`) against the `path` field of each entry in `checks.json`.
If any artifact lacks a matching check, the audit fails — exactly mirroring
the behaviour of the real `.agentrig/eval/static-audit.mjs` and AgentRig's
**Critical Rule 2**.
