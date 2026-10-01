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
[`llms.txt`](https://tudorpopa.com/agentrig/llms.txt) URL. The index links
the full specification, byte-for-byte Core prompts, skill, rule, and validator
from the same build. The user does not clone AgentRig or install a package.

Paste this into an agent working in the target repository:

```text
Read https://tudorpopa.com/agentrig/llms.txt, tailor its Core harness to this repo without overwriting existing work, run the repo’s checks and validator, and request an independent Paranoid review.
```

For a local preview, substitute the preview's `llms.txt` URL if you need
its unpublished content. Remote agents must be able to reach the chosen
URL. For a pinned, reproducible snapshot, use direct raw URLs for the
specification, assets, and validator from one existing Git tag or commit
rather than a moving documentation site.

Migrating from the former CLI? See [MIGRATION.md](MIGRATION.md). License: [MIT](LICENSE).

Site maintainers can run `npm ci && npm run docs:build`, then serve `site/` at
port 8000 (`npm run docs:preview` if no server is already listening). The
specification, migration pages, and published Core files are generated from
the root source, not edited in `docs/` or `site/`.
