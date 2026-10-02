# An llms-only bootstrap cannot select unpublished optional assets

- **Symptom:** The Fieldnote demo had only one skill and one rule although AgentRig retained a larger library.
- **Cause:** `llms.txt` published only Core files, so the setup agent could not discover or fetch optional skills/rules from that entrypoint.
- **Fix:** Publish every retained asset; declare the four general rules as Core and label the remaining skills opt-in.
- **Prevention:** Compare the canonical inventory with the site index; version and document any change to required Core files.
- **Discovered:** 2026-10-02 during the React demo adoption review.
