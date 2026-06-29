---
"@doidor/agentrig": minor
---

Pick up four battle-tested patterns from the Epichan production harness:

- **security-reviewer** role (principle 2) — an optional, read-only specialized reviewer on a
  different model family than the developer, with a Blocking/Warning/Informational severity model
  and an explicit APPROVE / REQUEST CHANGES verdict.
- **no-self-approve** skill + a `pre_merge` gate (principles 9, 10) — agents on a shared bot identity
  must never approve their own PRs; independent approval is required.
- **resolve-conflicts** skill (principles 4, 7) — rebase-first conflict repair that verifies
  mergeability before pushing.
- **address-review-comments** skill (principles 4, 5) — reply to and resolve every review thread,
  then verify zero threads remain.

Also enriches the wiki entry/index conventions with optional PR/commit provenance and good-vs-weak
entry guidance. Bumps `knowledgeVersion` to 0.7.0 so `agentrig update` installs the new artifacts.
