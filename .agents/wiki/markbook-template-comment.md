# Markbook layout comments retain example placeholders

- **Symptom:** A post-build scan reported unexpanded `{{ content }}` and `{{ title }}` although the landing page rendered.
- **Cause:** The original layout documents placeholder names in an HTML comment that Markbook preserves in generated HTML.
- **Fix:** Exclude HTML comments when checking for unresolved template slots; inspect the actual hero and content separately.
- **Prevention:** Test rendered markup, not template examples in comments, before diagnosing a broken page.
- **Discovered:** 2026-10-01 during original docsite design restoration.
