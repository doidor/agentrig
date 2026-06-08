# Changesets

This folder is managed by [Changesets](https://github.com/changesets/changesets). It drives
**automatic version bumping** and the npm release.

## Adding a changeset

When you make a change worth releasing, run:

```bash
npx changeset
```

Pick the bump type (**patch** / **minor** / **major**) and write a one-line summary. This creates a
markdown file here; commit it with your PR.

## What happens next

On every push to `main`, the **Release** workflow (`.github/workflows/release.yml`) collects the
pending changesets and opens (or updates) a **"Version Packages"** PR that bumps
`@doidor/agentrig`'s version and updates `CHANGELOG.md`. Merging that PR publishes the new version to
npm. See [`RELEASING.md`](../RELEASING.md) for the full flow.
