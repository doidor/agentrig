# Agent wiki — tiered memory (principle 8)

Every mistake is a prompt bug. This is where durable gotchas live.

## Tiers
1. **Central wiki (this directory, committed):** repo-wide, reviewed gotchas. CODEOWNERS-gate it.
2. **Local wiki (git-ignored):** machine/contributor-specific notes. Add `*.local.md` to
   `.gitignore`.
3. **Session scratch:** ephemeral working notes (e.g. `plan.md`); never a substitute for the wiki.

## Admission test (strict — duplication kills wikis)
Before adding an entry, confirm no existing entry covers it. If one does, **sharpen it** instead of
adding a near-duplicate. Each entry should be: a title, the symptom, the root cause, the fix, and a
one-line prevention.

## Entry template
```markdown
### <short title>
- **Symptom:** what went wrong / how it showed up
- **Cause:** the real root cause
- **Fix:** the change that resolved it
- **Prevention:** the rule/skill wording that would have stopped it (feed to skill-improver)
```
