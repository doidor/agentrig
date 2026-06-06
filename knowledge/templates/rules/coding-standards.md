---
globs: ["**/*"]
description: Baseline coding standards applied to every change in this repo.
---

# Coding standards (reflex)

- Make the smallest change that fully solves the task; do not refactor unrelated code.
- Match the surrounding style; do not introduce a new formatter/linter without being asked.
- No secrets in source. No disabling tests to make CI green.
- Add or update tests for behavior you change.
- Prefer clear names over comments; comment only non-obvious intent.

> AgentRig installs this as a generic baseline. Replace it with repo-specific standards and add
> specialized, glob-scoped rules alongside it.
