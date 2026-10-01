---
globs: ["**/*"]
description: What an AI reviewer should and should not flag. Keeps review high-signal.
priority: 2
---

# Code review

- Focus on behavior, correctness, security, failure paths, races, missing regression coverage, and
  contract breaks. Cite a concrete triggering case and evidence for each actionable finding.
- Skip self-explanatory comments, formatting handled by tools, naming bikesheds, and unchanged
  lines. Do not claim a check failed without running it or inspecting its result.
- Never cast an approving vote on work authored under your own identity, including a shared agent
  identity. Leave findings if useful, but require independent approval.
