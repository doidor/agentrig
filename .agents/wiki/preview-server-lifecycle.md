# A docs build does not keep a preview server alive

- **Symptom:** A localhost page check returned `ECONNREFUSED` although a previous turn had served the same site.
- **Cause:** `npm run docs:build` writes static files but does not start a server; the earlier listener was gone.
- **Fix:** Start `npm run docs:preview` for the check, verify readiness, then stop only the process you started.
- **Prevention:** Check the port before using a localhost URL; never assume an earlier server persists or terminate another user's listener.
- **Discovered:** 2026-10-01 during production-domain prompt verification.
