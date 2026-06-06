# <package name> — Agent instructions (package-local)

> Drop a file like this at the root of a subpackage/subtree. It **augments** the repo-root
> `AGENTS.md` with scope-specific guidance; it does not replace the root Critical Rules.

## Scope
Applies to everything under this directory.

## What this package is
One or two sentences: purpose, public surface, who depends on it.

## Local rules
- Build/test/lint commands specific to this package, if they differ from the root.
- Conventions that only apply here (naming, layering, allowed dependencies).
- Files/areas to treat as protected or generated.

## Pointers
- Root policy: `/AGENTS.md`
- Path-scoped reflexes: add a glob-scoped rule under `.agents/rules/` instead of repeating it here.
