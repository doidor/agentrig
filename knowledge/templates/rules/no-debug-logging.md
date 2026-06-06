---
globs: ["**/*"]
description: No stray debug output or debugger statements in committed code.
priority: 3
---

# No debug logging left behind (reflex)

- Don't commit `console.log`/`console.debug`, `print`, `dbg!`, `fmt.Println` debug spew, or
  `debugger;` statements added while investigating.
- Use the project's existing logger/abstraction for intentional, structured logging — match what the
  surrounding code already uses; don't introduce a new logging mechanism unasked.
- Temporary diagnostics are fine while iterating, but remove them before `self-verify`/handoff.

This is a baseline. If the repo has a specific logger convention, encode it as a specialized,
glob-scoped rule that takes priority over this one.
