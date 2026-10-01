# Removing skill files may leave empty skill directories

## Symptoms
The working tree still listed five removed skill directories, each without `SKILL.md`.

## Root cause
Removing tracked files does not remove their now-empty directories from the filesystem.

## Fix
Inspect each retired directory for user assets, then remove only the confirmed empty directories.

## Prevention
After pruning skills, verify both tracked files and the on-disk directory roster; do not assume
file deletion alone produces the intended installation shape.
