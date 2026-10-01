# Core prompts must not require an optional wiki

## Symptoms
Builder, self-verify, and fix-ci directed agents to write `.agents/wiki/` even when a target
repository had no wiki; the optional log-gotcha skill made the same assumption.

## Root cause
The native assets retained the former harness's mandatory wiki policy after the Core profile
made a knowledge base optional (`AGENT-RIG.md`, skill-maintenance guidance).

## Fix
Use an existing wiki or knowledge base when present; otherwise report the gotcha with observed
evidence to the human rather than installing a wiki.

## Prevention
Check every Core instruction against the specification's optional-asset boundary before copying
it to a target repository.
