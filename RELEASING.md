# Releasing `@doidor/agentrig`

Releases are driven by [**Changesets**](https://github.com/changesets/changesets) +
[`.github/workflows/release.yml`](.github/workflows/release.yml): version bumps and the npm publish
are automatic. You never edit the version by hand.

## One-time setup

1. **npm token** with publish rights for the `@doidor` scope (Granular Access Token scoped to the
   package/scope, **Read and write**; or a classic **Automation** token). Add it as the repo secret
   **`NPM_TOKEN`** (Settings → Secrets and variables → Actions).
2. **Allow Actions to open PRs:** Settings → Actions → General → Workflow permissions →
   enable *"Allow GitHub Actions to create and approve pull requests"* (the release workflow opens
   the "Version Packages" PR).
3. Public access + provenance are already configured (`publishConfig.access: "public"`,
   `NPM_CONFIG_PROVENANCE: "true"` in the workflow). If the repo/package is **private**, remove the
   `NPM_CONFIG_PROVENANCE` env from `release.yml` (provenance requires a public package).

## Day-to-day: how a release happens

1. **Describe each change with a changeset** (commit it alongside your code):
   ```bash
   npx changeset
   ```
   Pick **patch / minor / major** and write a one-line summary → creates a file in `.changeset/`.
2. **Push / merge to `main`.** The **Release** workflow opens (or updates) a
   **"Version Packages"** PR that bumps `package.json`, writes `CHANGELOG.md` from the changesets,
   and deletes the consumed changeset files.
3. **Merge the "Version Packages" PR.** The workflow runs again, sees the bumped version, and
   **publishes to npm** (`changeset publish`, with provenance) and pushes the `vX.Y.Z` git tag.

That's it — no manual `npm version` or `npm publish`.

## First release

The package starts at `0.5.3` (unpublished). To cut the first published version:

```bash
npx changeset           # choose the bump (e.g. minor -> 0.6.0) + summary
git add .changeset && git commit -m "chore: changeset for first release" && git push
```

Then merge the auto-opened "Version Packages" PR — that publishes the first version.

## Pre-releases (optional)

Use Changesets pre-release mode when you want `next`-tagged builds:

```bash
npx changeset pre enter next   # then add changesets + push as usual
npx changeset pre exit         # when going back to stable
```

## Verify

```bash
npm view @doidor/agentrig version
npx @doidor/agentrig --version
```

## Notes

- The published binary is `agentrig`, so `npx @doidor/agentrig <cmd>` and a global install
  (`npm i -g @doidor/agentrig` -> `agentrig <cmd>`) both work.
- `prepublishOnly` re-runs clean + build + test as a backstop for any manual `npm publish`.
- A manual run is available via the workflow's `workflow_dispatch` trigger (publishes only if a
  version bump is pending/merged).
