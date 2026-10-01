---
title: Getting started
description: Bootstrap the AgentRig Core profile without installing a CLI.
order: 1
---

# Getting started

Copy the URL of [this site's llms.txt](./llms.txt) and give it to your
coding agent. On a local preview at port 8000, that URL is
`http://localhost:8000/llms.txt`. The index links the full
[specification](./principles.html), the exact Builder and Paranoid prompts,
the self-verify skill, engineering rule, and the standalone validator. The
agent can fetch all of them from the same site without cloning AgentRig.

In the target repository, give a **local** coding agent this prompt:

```text
Read http://localhost:8000/llms.txt and follow its linked specification
and Core files. Inspect this repository, then reconcile AGENTS.md with its
real purpose and Build/Test/Lint commands. Copy the required prompts,
skill, and rule from those links verbatim. Preserve existing work and add
optional recipes only when evidence requires them. Run the repository's
checks and self-verify, then request a fresh, independent Paranoid review.
Download the validator linked in llms.txt to a temporary file, run it with
Node.js against this repository, and fix every reported error. Show the
diff and observed results; ask before irreversible actions. Do not clone
AgentRig or install an AgentRig package.
```

For an agent that cannot access your localhost, use this site's reachable
URL instead (for the published site,
`https://tudorpopa.com/agentrig/llms.txt`). The validator checks structure,
not whether tests passed or agents followed the principles. See the
[Core acceptance checklist](./principles.html#core-acceptance-checklist)
and [migration guide](./migration.html) if you used the former npm CLI.
