# AgentRig

AgentRig is a **document-first specification** for a small, repository-local coding-agent
harness. The [normative specification and bootstrap procedure](AGENT-RIG.md) define its Core
profile; the linked `.agents/` prompts, skill, and rule are directly copyable. A dependency-free
[`validate.mjs`](validate.mjs) checks the installed structure. There is no AgentRig installer, npm
CLI, model runtime, or automatic migration.

The [documentation site](https://tudorpopa.com/agentrig/) provides a short guide
and mirrors the canonical specification. Its private npm package contains only
docs build tools; installing a Core harness never requires it. Agents can use
the site's [plain-text index](https://tudorpopa.com/agentrig/llms.txt).

## Bootstrap

Choose **one Git revision containing the document-first files**. Clone the repository and, for a
reproducible install, check out an existing tag or commit SHA *before* copying any asset:

```sh
git clone https://github.com/doidor/agentrig.git /path/to/agentrig
# If pinning, replace EXISTING_REF with a tag or commit that actually exists:
git -C /path/to/agentrig checkout --detach EXISTING_REF
```

For direct downloads instead, fetch `AGENT-RIG.md`, `validate.mjs`, and the native files linked
from the specification at the **same ref**. Raw URLs have the form
`https://raw.githubusercontent.com/doidor/agentrig/<same-ref>/AGENT-RIG.md` and
`https://raw.githubusercontent.com/doidor/agentrig/<same-ref>/.agents/agents/builder.md`;
substitute one existing commit/tag throughout, or `main` for the latest guidance once this
refactor is merged. No future release tag is assumed.

Paste this into a coding agent working in the target repository (substitute the source path):

```text
Read /path/to/agentrig/AGENT-RIG.md and its linked native assets from the same
source revision. Inspect this repository, its existing instructions, tooling,
tests, CI, and working tree. Reconcile AGENTS.md with its real purpose and
Build/Test/Lint commands, then install only the required Core prompts, skill,
and rule. Preserve existing work and add conditional recipes only for
demonstrated needs. Run the repository's checks and the self-verify skill,
request an independent fresh Paranoid review, and run
node /path/to/agentrig/validate.mjs .; fix every reported error. Show the
diff and observed results. Get human approval for low-reversibility actions.
```

You can also run validation directly, without a package install or model:

```sh
node /path/to/agentrig/validate.mjs /path/to/target
```

Migrating from the former CLI? See [MIGRATION.md](MIGRATION.md). License: [MIT](LICENSE).

To build the site locally: `npm ci && npm run docs:build`. The full specification
and migration pages are generated from the root Markdown files, not edited in
`docs/`.
