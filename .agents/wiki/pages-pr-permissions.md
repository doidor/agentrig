# Pages deploy permissions on PR builds

- **Symptom:** The first docs workflow draft granted `pages: write` and `id-token: write` to PR builds that run dependency install scripts.
- **Cause:** Workflow-level permissions apply to every job, even when deploy steps themselves are gated to `main`.
- **Fix:** Keep the build job read-only; configure and deploy Pages in the main-only job with its own permissions.
- **Prevention:** When adding PR checks to a publishing workflow, review job-level token permissions separately from step conditions.
- **Discovered:** 2026-10-01 during simplified docsite restoration.
