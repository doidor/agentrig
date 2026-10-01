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

Give your agent the documentation site's
[`llms.txt`](https://tudorpopa.com/agentrig/llms.txt) URL. A local preview
served on port 8000 uses **`http://localhost:8000/llms.txt`**. The index links
the full specification, byte-for-byte Core prompts, skill, rule, and validator
from the same build. The user does not clone AgentRig or install a package.

Paste this into a local coding agent working in the target repository:

```text
Read http://localhost:8000/llms.txt and follow its linked specification and
Core files. Inspect this repository, its existing instructions and tooling,
tests, CI, and working tree. Reconcile AGENTS.md with its real purpose and
Build/Test/Lint commands, then copy the required Core prompts, skill, and
rule from the index. Preserve existing work and add optional recipes only
for demonstrated needs. Run the repository's checks and self-verify, request
a fresh independent Paranoid review, then download the linked validator to
a temporary file and run it with Node.js against this repository. Fix every
reported error; show the diff and observed results. Ask before irreversible
actions. Do not clone or install AgentRig.
```

Remote agents cannot access your localhost; give them a reachable URL such
as the deployed site's `llms.txt` instead. For a pinned, reproducible snapshot,
use direct raw URLs for the specification, assets, and validator from one
existing Git tag or commit rather than a moving documentation site.

Migrating from the former CLI? See [MIGRATION.md](MIGRATION.md). License: [MIT](LICENSE).

Site maintainers can run `npm ci && npm run docs:build`, then serve `site/` at
port 8000 (`npm run docs:preview` if no server is already listening). The
specification, migration pages, and published Core files are generated from
the root source, not edited in `docs/` or `site/`.
