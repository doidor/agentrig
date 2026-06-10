---
name: log-gotcha
description: Record a newly-discovered gotcha to `.agents/wiki/` BEFORE handoff — the harness's feedback loop. The wiki is how the next agent doesn't repeat your discovery.
triggers:
  - hit something non-obvious during the task
  - silent failure / suspicious default / quirk in a library or runtime
  - before handoff if anything surprised you
allowed-tools: Bash Read Write Edit Grep Glob
argument-hint: "[--topic <area>]"
---

# log-gotcha (principle 8)

Every mistake is a prompt bug. The wiki is **how the harness learns**: every entry there is one
agent-turn the next agent skips because they already know what you discovered. Logging is part of
the task, not a separate "good-to-have" step.

## When to log

You should log a gotcha if **any** of these apply to what you just did:

- A test, framework, or runtime did something surprising (e.g. `divide(1, 0)` returns `Infinity`
  not throws; `node --test some-dir` resolves the dir as a module; `console.log` after
  `process.exit` silently truncates piped output).
- A library default bit you (silent overwrite, surprising coercion, hidden API contract).
- An AGENTS.md rule wasn't loud enough — you almost violated it, or did, until you caught yourself.
- A non-obvious cross-file dependency that someone touching one file would miss.
- A flaky test, an environment-specific assumption, a build-cache surprise.

**Do not log** taste opinions, style preferences, or things that are already in CONTRIBUTING.md.

## How to log

1. **Check the wiki first.** Run `ls .agents/wiki/` and `grep -ri "<keyword>" .agents/wiki/` for
   the most natural keywords. **If an existing entry covers it, SHARPEN that entry instead of
   adding a near-duplicate** (the wiki README has a strict admission test on duplication).
2. **Pick a topic file.** Either an existing one (e.g. `troubleshooting.md`) or create
   `.agents/wiki/<topic>.md` if the area is new (e.g. `node-test-runner.md`,
   `html-templates.md`). Topic names are kebab-case nouns.
3. **Write a stub entry** using the template below. Keep it terse — 5 lines max.
4. **Commit it as part of your fix's diff.** Wiki entries are not "after-the-fact paperwork" —
   they go in the SAME commit/PR as the fix that revealed them, so reviewers can see them.

## Entry template

```markdown
### <short noun-phrase title>
- **Symptom:** what went wrong / how it showed up
- **Cause:** the real root cause (not the symptom)
- **Fix:** the change you made (or wider remediation)
- **Prevention:** one-line rule that would have spared you this discovery
- **Discovered:** <date> in <scenario or task id>
```

## Skill failure modes (explicitly)

- **"I didn't really hit a gotcha."** Most fixes DO reveal one — you just didn't notice because the
  fix took less than 5 minutes. The discriminating question is *"could the next agent have known
  this from the existing instructions?"* — if no, log it.
- **"It's too small."** Small gotchas are exactly the ones that vanish from memory by tomorrow.
- **"I'll log later."** No — log it in the SAME commit. "Later" is how wikis die.

## Verification

Before considering this skill complete, confirm with `git diff --cached --stat` that your wiki
entry shows in the staged diff. The `memory` axis in the harness eval explicitly checks for this:
"diff contains a `.agents/wiki/` entry" → 1.0; "mentioned in summary but not committed" → 0.5;
"silent" → 0.
