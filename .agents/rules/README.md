# Rules (principle 4)

Rules are **reflexes**: short, glob-scoped instructions auto-loaded when a matching file is edited.
Unlike skills (which are procedures you invoke), rules apply passively to every edit in scope.

## Priority order
Each rule declares a `priority` in its frontmatter. When multiple rules match, lower numbers win on
conflict:
1. **Specialized / security** (`security.md`, framework- or area-specific rules) — `priority: 1`
2. **Review & accessibility** (`code-review.md`, any a11y rules) — `priority: 2`
3. **Baseline coding standards** (`coding-standards.md`, `no-debug-logging.md`) — `priority: 3`

## Default rules installed
- `security.md` — secrets, input validation, injection, least privilege (priority 1).
- `code-review.md` — what a reviewer should/shouldn't flag, to keep review high-signal (priority 2).
- `coding-standards.md` — baseline change discipline (priority 3).
- `no-debug-logging.md` — no stray debug output/`debugger` in committed code (priority 3).

## Authoring a rule
Start each rule with frontmatter declaring its glob scope, a one-line description, and a priority:

```markdown
---
globs: ["src/**/*.ts"]
description: One-line summary of the reflex.
priority: 1
---
```

Keep rules to a handful of imperative bullets. If a rule grows into a procedure, promote it to a
skill under `.agents/skills/`. Replace these generic defaults with repo-specific standards and add
specialized, glob-scoped rules alongside them.
