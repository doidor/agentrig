---
title: AgentRig
description: A document-first specification for a small coding-agent harness.
order: 0
---

# AgentRig

AgentRig is a **specification, not an installer**. Point an agent at the
[canonical principles and Core profile](./principles.html), and let it inspect
your repository before adding only the instructions, skills, rules, and agents
you need.

The Core profile has two roles: **Builder** implements and self-verifies;
**Paranoid** independently checks consequential defects. Its engineering rules
make **KISS, DRY, fail fast, and least surprise** explicit. A dependency-free
validator checks the resulting structure, not the quality of agent behavior.

- [Get started](./getting-started.html) with a copyable bootstrap prompt.
- [Read the full specification](./principles.html), generated from `AGENT-RIG.md`.
- [Migrate from the old CLI](./migration.html) without deleting local customizations.
- [Agent-readable index](./llms.txt) links the plain-text versions of these pages.
- [Browse the source and native assets](https://github.com/doidor/agentrig).
