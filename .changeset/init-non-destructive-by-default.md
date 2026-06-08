---
"@doidor/agentrig": minor
---

**`agentrig init` is now non-destructive by default.** Previously, `init` unconditionally clobbered any existing `AGENTS.md`, `.mcp.json`, or hand-tailored rule/skill/wiki file at the destination — making it dangerous to adopt AgentRig in a repo that already had agent content (e.g. a curated `AGENTS.md` from a prior harness).

Now `init`:

- Preserves any existing destination file by default (file content is left verbatim, SHA-identical).
- Reports preserved files in the install summary (`preserved N existing file(s) — pass --force to overwrite: …`).
- Still installs all the canonical machinery around what you have (`.agentrig/`, skills, projection symlinks, scripts).
- Compiles your existing `AGENTS.md` into every projected agent surface — so `agentrig init` becomes the natural "adopt AgentRig in this existing repo" entry point.

Pass `--force` to opt into the previous overwriting behavior. `agentrig init --dry-run` now shows `(new)`, `(preserve existing)`, or `(OVERWRITE)` per file.

`agentrig update` is unchanged — it still refreshes overwrite-policy machinery as before.
