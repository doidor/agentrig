# Multi-file apply_patch failures can leave partial edits

## Symptoms
A multi-file patch reported a failed context match on a later file after earlier files changed.

## Root cause
`apply_patch` applies hunks in sequence, not atomically; one context line was copied inaccurately.

## Fix
Inspect the failure's applied and remaining hunk lists, read the mismatched file, and apply only
the pending hunks with corrected context.

## Prevention
Copy exact context for multi-file patches. If any hunk fails, check the worktree before retrying;
do not assume the entire patch rolled back.
