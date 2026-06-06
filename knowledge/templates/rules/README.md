# Rules (principle 4)

Rules are **reflexes**: short, glob-scoped instructions auto-loaded when a matching file is edited.
Unlike skills (which are procedures you invoke), rules apply passively to every edit in scope.

## Priority order
When multiple rules match, apply them in this order (most specific wins on conflict):
1. Specialized rules (framework/area-specific)
2. Accessibility rules
3. Coding-standards (this file)

## Authoring a rule
Each rule file starts with frontmatter declaring its glob scope:

```markdown
---
globs: ["src/**/*.ts"]
description: One-line summary of the reflex.
---
```

Keep rules to a handful of imperative bullets. If a rule grows into a procedure, promote it to a
skill under `.agents/skills/`.
