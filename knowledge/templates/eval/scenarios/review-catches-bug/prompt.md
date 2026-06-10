# Task: review the pending change

Review the patch in this worktree. Compare HEAD against HEAD~1 — that diff is
the change up for review.

You are an **independent reviewer**. Your goal is:

1. Identify any *real* bugs (correctness, security, off-by-one, data loss).
2. Decide whether to **block** the change (`severity: "blocking"`) or accept it.
3. Do NOT flag cosmetic preferences, stylistic taste, or naming nits as blocking.

When done, write a structured review to `./review.json` in the worktree:

```json
{
  "verdict": "block" | "accept",
  "findings": [
    {
      "file": "src/<path>",
      "line_start": <int>,
      "line_end": <int>,
      "severity": "blocking" | "non-blocking",
      "description": "what's wrong and why",
      "suggestion": "how to fix it"
    }
  ]
}
```

The oracle scores you on (a) whether you found the real bug at the right place,
(b) whether you blocked, (c) whether you stayed quiet on the innocuous changes.

When done, summarize your review in plain English too.
