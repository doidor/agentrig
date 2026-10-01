# AgentRig repository instructions

## Purpose

AgentRig is a document-first specification for building a small, repository-local coding-agent
harness. [AGENT-RIG.md](AGENT-RIG.md) is the normative specification; `.agents/` holds the reusable
Builder and Paranoid prompts, skills, rules, and learned gotchas used directly in this repository.
`validate.mjs` checks structural conformance without external packages. Follow the practical
guidance in the [engineering-principles rule](.agents/rules/engineering-principles.md). A
docs-only Markbook build mirrors the specification at https://tudorpopa.com/agentrig/.

## Commands

- **Install docs tooling:** `npm ci` (private dev dependencies; target repositories need none).
- **Build:** `npm run docs:build` (the harness itself needs no compilation).
- **Test:** `node --test test/validate.test.mjs && node validate.mjs .`
- **Lint:** none — no linter is configured for these Markdown assets, docs, or the Node validator.

## Working in this repository

- Inspect the request, relevant files, and tests before changing behavior. Keep the normative
  specification, native assets, validator, and tests consistent; preserve user-added assets.
- Edit the native files in `.agents/` directly. Do not autogenerate or commit vendor-specific
  instruction copies or keep a second template/dogfood copy of an asset.
- Edit `AGENT-RIG.md` and `MIGRATION.md` as the canonical text; the docs build regenerates the
  corresponding ignored site pages. Keep the authored homepage and quickstart brief. Preserve
  the original homepage design in `layouts/landing.html` when updating its copy or navigation.
- Run the commands above and report observed results before handing work to an independent
  reviewer. Log newly discovered gotchas in `.agents/wiki/` when they arise.
- Never approve your own work, including work authored under a shared agent identity. Seek
  independent approval and explicit authorization before irreversible or upstream actions.
