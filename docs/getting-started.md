---
title: Getting started
description: Bootstrap the AgentRig Core profile without installing a CLI.
order: 1
---

# Getting started

Give an agent working in your repository this prompt:

```text
Read https://tudorpopa.com/agentrig/llms.txt, tailor its Core harness to this repo without overwriting existing work, run the repo’s checks and validator, and request an independent Paranoid review.
```

The published [llms.txt](./llms.txt) links the full
[specification](./principles.html), exact Builder and Paranoid prompts, the
self-verify skill, four required general rules, optional procedural skills,
and standalone validator. No AgentRig
checkout or package is needed. On a local preview, substitute the URL of
that preview's `llms.txt` if you want to use its unpublished content; the
agent must be able to reach whichever URL you give it. The validator checks
structure, not whether tests passed or agents followed the principles. See the
[Core acceptance checklist](./principles.html#core-acceptance-checklist)
and [migration guide](./migration.html) if you used the former npm CLI.
