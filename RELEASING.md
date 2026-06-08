# Releasing `@doidor/agentrig`

Releases are driven by [**Changesets**](https://github.com/changesets/changesets) +
[`.github/workflows/release.yml`](.github/workflows/release.yml): version bumps and the npm publish
are automatic. You never edit the version by hand.

## One-time setup

1. **Configure a Trusted Publisher on npmjs.com** (this replaces an `NPM_TOKEN` secret — publishing is
   tokenless via OIDC):
   - npmjs.com → **Packages → `@doidor/agentrig` → Settings → Trusted Publisher**.
   - Choose **GitHub Actions** and set: organization/owner `doidor`, repository `agentrig`, workflow
     filename **`release.yml`** (leave *Environment* blank unless you use one).
   - For maximum security, then set **Publishing access → "Require two-factor authentication and
     disallow tokens"** so only this workflow can publish.
2. **Allow Actions to open PRs:** Settings → Actions → General → Workflow permissions →
   enable *"Allow GitHub Actions to create and approve pull requests"* (the release workflow opens
   the "Version Packages" PR using the built-in `GITHUB_TOKEN`).
3. Public access is already configured (`publishConfig.access: "public"`), and **provenance is
   generated automatically** under trusted publishing — no flag or secret needed.

> **First publish of a brand-new package name:** a Trusted Publisher is configured on the *package's*
> settings page, so the package must exist. If npmjs.com won't let you add the publisher yet, do one
> bootstrap publish to create it — `npm login` then `npm publish --access public` locally (or a
> one-time token) — then add the Trusted Publisher. Every release after that is tokenless via the
> workflow. (Existing package: just add the Trusted Publisher and you're done.)

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
   **publishes to npm** via `changeset publish` — authenticated **tokenlessly via OIDC** (npm
   trusted publishing), with **automatic provenance**, and pushes the `vX.Y.Z` git tag.

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
