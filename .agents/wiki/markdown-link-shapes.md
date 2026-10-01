# Markdown link variants are still links

- **Symptom:** Core validation rejected an `AGENTS.md` rule link with a code-formatted label, an inline title, or a reference definition.
- **Cause:** The link probe stripped code spans inside link labels and matched only one inline-link shape.
- **Fix:** Recognize ordinary Markdown link forms while still excluding comments and code examples.
- **Prevention:** Test positive Markdown variants alongside bare mentions and fake links in comments/code.
- **Discovered:** 2026-10-01 during document-first validator integration.
