---
globs: ["**/*"]
description: Security reflexes applied to every change. Specialized — highest priority.
priority: 1
---

# Security

- Keep secrets out of source; use the repository's configured secret store. Report a discovered
  committed secret without copying it into logs or diffs.
- Validate untrusted input at boundaries. Use parameterized queries and safe process APIs rather
  than concatenating untrusted SQL or shell commands; escape untrusted output for its destination.
- Do not bypass authentication, TLS, CSRF protection, or other security checks, or widen privileges
  to make a change pass. Review auth, crypto, and input-boundary changes explicitly.
- Treat PR builds as untrusted; grant publishing and OIDC permissions only to the gated deploy job
  that needs them, not to the whole workflow.
