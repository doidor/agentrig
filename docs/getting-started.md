---
title: Getting started
description: Bootstrap the AgentRig Core profile without installing a CLI.
order: 1
---

# Getting started

Choose a single revision of the [AgentRig source](https://github.com/doidor/agentrig)
and read its [full specification](./principles.html) and linked native assets.
Use an existing tag or commit for a reproducible snapshot; `main` tracks the
latest guidance. The documentation site mirrors the specification, but
`AGENT-RIG.md` in that revision is the source of truth.

Clone the source once to make its prompts, rules, skills, and validator available:

```sh
git clone https://github.com/doidor/agentrig.git /path/to/agentrig
# Optionally: git -C /path/to/agentrig checkout --detach EXISTING_REF
```

In the target repository, give a coding agent this prompt:

```text
Read /path/to/agentrig/AGENT-RIG.md and its linked native assets from the
same Git revision. Inspect this repository and reconcile its AGENTS.md with
its real purpose and Build/Test/Lint commands. Install only the required
Core profile; preserve existing work and add optional recipes only when
evidence requires them. Run the repository's checks and the self-verify
skill, request a fresh independent Paranoid review, then run
node /path/to/agentrig/validate.mjs .; fix every reported error and show
the diff and observed results. Ask before irreversible actions.
```

The validator checks structure, not whether tests passed or agents followed
the principles. See [the Core acceptance checklist](./principles.html#core-acceptance-checklist)
and the [migration guide](./migration.html) if you used the former npm CLI.
