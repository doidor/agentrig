# Docs rebuilds must track canonical assets

- **Symptom:** A Core prompt, skill, rule, or validator edit would leave the published `llms.txt` links serving stale copies.
- **Cause:** Docs workflow path filters watched pages and scripts but not the canonical files copied into the site.
- **Fix:** Trigger Docs builds for each Core asset path and test that published bytes match their source.
- **Prevention:** Update the Docs workflow trigger and output test whenever the publishing source list changes.
- **Discovered:** 2026-10-01 during llms-first docsite onboarding.
