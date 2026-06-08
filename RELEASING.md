# Releasing `@doidor/agentrig`

Publishing is automated via GitHub Actions (`.github/workflows/publish.yml`). It publishes the
package to npm whenever a **GitHub Release** is published (and supports manual `workflow_dispatch`).

## One-time setup

1. **Create an npm access token** with publish rights for the `@doidor` scope:
   - npmjs.com → your avatar → **Access Tokens** → **Generate New Token**.
   - Prefer a **Granular Access Token** scoped to the `@doidor/agentrig` package (or the `@doidor`
     scope), with **Read and write** permission. A classic **Automation** token also works.
2. **Add it as a repository secret** named `NPM_TOKEN`:
   - GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**.
   - Name: `NPM_TOKEN`, Value: the token.
3. Ensure the `@doidor` scope publishes publicly — already handled by
   `package.json → publishConfig.access: "public"`.

> The workflow also requests `id-token: write` so npm records **provenance** (supply-chain
> attestation) for each publish. This works for public packages built in GitHub Actions. If the
> repo/package is private, remove `--provenance` from the publish step.

## Cut a release

1. Bump the version and commit:
   ```bash
   npm version patch   # or: minor | major  (updates package.json + creates a vX.Y.Z tag + commit)
   git push && git push --tags
   ```
   (Or edit `package.json`'s `version` manually, commit, and tag `vX.Y.Z` yourself.)
2. On GitHub: **Releases → Draft a new release**, choose the `vX.Y.Z` tag, write notes, **Publish
   release**.
3. The **Publish** workflow runs: `npm ci` → build → test → version/tag guard → `npm publish`.
   - Mark the GitHub release as a **pre-release** to publish under the npm `next` dist-tag instead of
     `latest`.

## Verify

```bash
npm view @doidor/agentrig version
npx @doidor/agentrig --version
```

## Notes

- The published binary is still `agentrig`, so `npx @doidor/agentrig <cmd>` and a global install
  (`npm i -g @doidor/agentrig` → `agentrig <cmd>`) both work.
- `prepublishOnly` re-runs clean + build + test as a backstop for any manual `npm publish`.
- The release-trigger guard fails the job if `package.json`'s version doesn't match the release tag,
  preventing accidental mismatched publishes.
