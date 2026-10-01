# Generated Core links need output checks

- **Symptom:** `npm run docs:build` rejected an intentional `./core/...` Markdown link as unmapped.
- **Cause:** The site sync's broken-link guard recognized HTTPS links but not the new same-site Core assets.
- **Fix:** Allow generated `./core/` links and verify every referenced file exists after publishing.
- **Prevention:** Update link-mapping guards and output checks together whenever asset URLs change.
- **Discovered:** 2026-10-01 during llms-first docsite onboarding.
