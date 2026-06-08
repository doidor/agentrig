# @doidor/agentrig

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
