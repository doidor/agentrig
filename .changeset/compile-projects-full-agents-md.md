---
"@doidor/agentrig": patch
---

`agentrig compile` now mirrors the **entire** AGENTS.md body into the projected `.github/copilot-instructions.md` and `CLAUDE.md`, instead of cherry-picking only the `Critical Rules` and `What this repository is` sections. Anything the user adds to AGENTS.md (custom sections, repo-specific guidance) now flows through to every downstream agent surface.

Internally the projection now strips the H1 title, the `<!-- AGENTRIG:…:start/end -->` marker comments (which are AGENTS.md-internal update-protection), and any lines still carrying unfilled `{{PLACEHOLDER}}` template tokens.
