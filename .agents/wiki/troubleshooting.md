# Troubleshooting — common errors and fixes

A shared, living list of errors agents (and humans) hit in this repo and the fix that worked. Prefer
adding here over re-debugging the same thing twice. Keep each entry tight.

## Format
```
### <error message or symptom, greppable>
- **When:** the situation it shows up in
- **Fix:** the exact thing that resolves it
```

## Entries
### `git push` cannot prompt even though `gh` is authenticated
- **Symptom:** An unattended HTTPS push stops with `Cannot prompt because user interactivity has been disabled`.
- **Cause:** Git's configured credential helpers did not supply the active GitHub CLI account's credentials.
- **Fix:** Use GitHub CLI's credential helper for that one push: `git -c credential.helper='!gh auth git-credential' push`.
- **Prevention:** Check `gh auth status` and use a scoped helper, not an embedded token or a global credential change.
- **Discovered:** 2026-10-01 during PR creation for the document-first refactor.

### Legacy setup-steps validation reports missing PyYAML as invalid YAML
- **Symptom:** Two `npm test` checks fail with `invalid YAML: ModuleNotFoundError: No module named 'yaml'`.
- **Cause:** `src/core/setupsteps.ts` treats a missing Python `yaml` module as a parsing error.
- **Fix:** For the pre-refactor baseline, run tests with an isolated Python environment containing PyYAML; the document-first validator removes this dependency.
- **Prevention:** Distinguish a missing validation tool from invalid input, and test the offline path.
- **Discovered:** 2026-10-01 during the document-first refactor baseline.
