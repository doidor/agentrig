# Rules

Rules are short, glob-scoped reflexes applied when matching files are edited; skills are
procedures invoked for a task. Each rule needs `globs`, `description`, and `priority` frontmatter.
Lower priority numbers win on conflict.

- `security.md` (priority 1): protect secrets, input boundaries, and privileges.
- `code-review.md` (priority 2): focus review on consequential, supported findings and independent approval.
- `engineering-principles.md` (priority 3): apply KISS, DRY, fail fast, and least surprise.
- `no-debug-logging.md` (priority 3): keep temporary diagnostics out of changes.

Add repository-specific rules only when evidence justifies them; keep the scope narrow and put
repeatable procedures in `.agents/skills/` instead.
