# @doidor/agentrig

## 0.9.0

### Minor Changes

- [#8](https://github.com/doidor/agentrig/pull/8) [`fc70643`](https://github.com/doidor/agentrig/commit/fc706433018acf6e91e21c49fe3cedb1dd278856) Thanks [@doidor](https://github.com/doidor)! - **`agentrig init` is now non-destructive by default.** Previously, `init` unconditionally clobbered any existing `AGENTS.md`, `.mcp.json`, or hand-tailored rule/skill/wiki file at the destination — making it dangerous to adopt AgentRig in a repo that already had agent content (e.g. a curated `AGENTS.md` from a prior harness).

  Now `init`:

  - Preserves any existing destination file by default (file content is left verbatim, SHA-identical).
  - Reports preserved files in the install summary (`preserved N existing file(s) — pass --force to overwrite: …`).
  - Still installs all the canonical machinery around what you have (`.agentrig/`, skills, projection symlinks, scripts).
  - Compiles your existing `AGENTS.md` into every projected agent surface — so `agentrig init` becomes the natural "adopt AgentRig in this existing repo" entry point.

  Pass `--force` to opt into the previous overwriting behavior. `agentrig init --dry-run` now shows `(new)`, `(preserve existing)`, or `(OVERWRITE)` per file.

  `agentrig update` is unchanged — it still refreshes overwrite-policy machinery as before.

## 0.8.0

### Minor Changes

- [#6](https://github.com/doidor/agentrig/pull/6) [`b85dced`](https://github.com/doidor/agentrig/commit/b85dced9616811a2f9f618bfa6cea7beef1b28d1) Thanks [@doidor](https://github.com/doidor)! - First public release as the scoped package `@doidor/agentrig`: a meta-harness CLI that installs
  best-practice agent harnesses into any repo and projects them to every agent surface (local +
  remote). Includes automated Changesets releases with npm provenance, Node >= 22, and CI/release
  status badges.

## 0.7.0

### Minor Changes

- [#3](https://github.com/doidor/agentrig/pull/3) [`2e1de2f`](https://github.com/doidor/agentrig/commit/2e1de2f72b04b08b3b20c08c22610d4868785628) Thanks [@doidor](https://github.com/doidor)! - First public release as the scoped package `@doidor/agentrig`: a meta-harness CLI that installs
  best-practice agent harnesses into any repo and projects them to every agent surface (local +
  remote). Includes automated Changesets releases with npm provenance, Node >= 22, and CI/release
  status badges.

### Patch Changes

- [#3](https://github.com/doidor/agentrig/pull/3) [`2e1de2f`](https://github.com/doidor/agentrig/commit/2e1de2f72b04b08b3b20c08c22610d4868785628) Thanks [@doidor](https://github.com/doidor)! - `agentrig compile` now mirrors the **entire** AGENTS.md body into the projected `.github/copilot-instructions.md` and `CLAUDE.md`, instead of cherry-picking only the `Critical Rules` and `What this repository is` sections. Anything the user adds to AGENTS.md (custom sections, repo-specific guidance) now flows through to every downstream agent surface.

  Internally the projection now strips the H1 title, the `<!-- AGENTRIG:…:start/end -->` marker comments (which are AGENTS.md-internal update-protection), and any lines still carrying unfilled `{{PLACEHOLDER}}` template tokens.

## 0.6.0

### Minor Changes

- [#1](https://github.com/doidor/agentrig/pull/1) [`dc7c740`](https://github.com/doidor/agentrig/commit/dc7c740001dc8a7c0ea4c7f8d7fb9ed617a5efee) Thanks [@doidor](https://github.com/doidor)! - First public release as the scoped package `@doidor/agentrig`: a meta-harness CLI that installs
  best-practice agent harnesses into any repo and projects them to every agent surface (local +
  remote). Includes automated Changesets releases with npm provenance, Node >= 22, and CI/release
  status badges.
