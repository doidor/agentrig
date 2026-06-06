---
globs: ["**/*"]
description: Baseline coding standards applied to every change in this repo.
---

# Coding standards (reflex)

- Author harness content in `knowledge/` (plain text); never hard-code it in `src/`.
- Import `@github/copilot-sdk` only under `src/agent/`; all model access goes through the `AgentProvider` interface.
- Keep `knowledge/templates/eval/checks.json` in sync when adding/removing an installed artifact, or the audit silently ignores it.
- Write TypeScript that compiles clean under `strict` + `noUncheckedIndexedAccess`; handle null/undefined explicitly.
- Use ESM only: include the `.js` extension in relative `import` paths (NodeNext); no `require`/CommonJS.
- Keep every command working with `--dry-run` and offline — `eval --static` and `doctor` must never need a model or network.
- Never edit generated `dist/`; change `src/` and rebuild with `npm run build`.
- Bump `package.json` `version` and `knowledge/manifest.json` `knowledgeVersion` together when changing installed artifacts.
- Verify with the smoke checks before handoff (`npm run build` + `node dist/cli.js eval --static .`); there is no lint or unit-test suite to lean on.
- No secrets in source. Do not weaken `checks.json` or skip the audit just to make a score pass.

> Specialized, glob-scoped rules can live alongside this baseline.
