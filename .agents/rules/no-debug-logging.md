---
globs: ["**/*"]
description: No stray debug output or debugger statements in committed code.
priority: 3
---

# No stray diagnostics

- Remove temporary prints, debug logging, and breakpoints before handoff.
- For intentional diagnostics, follow the repository's existing logging conventions and avoid
  exposing sensitive data.
