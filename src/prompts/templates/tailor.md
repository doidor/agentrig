# Task 2 of 2 — Tailor the installed harness to this repository

AgentRig has just installed a canonical best-practice harness into this repo:

{{ARTIFACT_LIST}}

Using everything you learned in Task 1 (and `.agentrig/context.md`), make the harness
repo-specific. Edit **only** the files listed below.

1. **`AGENTS.md`** — replace every `{{PLACEHOLDER}}` and fill the content between the
   `<!-- AGENTRIG:...:start -->` / `:end` markers:
   - `{{REPO_NAME}}`, `{{REPO_SUMMARY}}` — name and a 2-3 sentence description.
   - The `commands` block — the REAL install/build/test/lint commands you verified. If one
     genuinely does not exist, write `(none)`.
   - The `dirmap` block — a concise directory map.
   Do NOT change anything between the `critical-rules` markers.
2. **`.agents/rules/coding-standards.md`** — replace the generic baseline with standards that
   actually match this repo's language and conventions. Keep it to a short list of imperative
   reflexes and keep the frontmatter `globs`/`description`.
3. **`.agentrig/eval/scenarios/`** — adjust the existing scenario files so the setup/success
   criteria reference this repo's real test/build commands and structure. Do not remove the axis
   lists.
4. **`.github/workflows/copilot-setup-steps.yml`** — author a REAL, repo-specific setup workflow so
   the GitHub Copilot **cloud/coding agent** has a ready environment (don't leave a generic stub).
   Base it on your investigation:
   - A single job named EXACTLY `copilot-setup-steps` on `runs-on: ubuntu-latest`, with
     `permissions: contents: read`, triggered by `workflow_dispatch` + `push`/`pull_request`
     filtered to this file.
   - Steps that install the ACTUAL toolchain + dependencies you found: correct language runtime(s)
     and version(s) (from `.nvmrc`/`.tool-versions`/`engines`/`go.mod`/`pyproject.toml`), the
     correct package manager and install command (e.g. `npm ci`/`pnpm i --frozen-lockfile`/
     `pip install -e .`/`go mod download`), dependency caching, and any system packages or
     `services` (databases, etc.) the build/tests need. Keep it to env setup — not the task itself.
   If you cannot determine the stack confidently, leave the generated scaffold and note what's
   missing.

Keep all YAML frontmatter and the AgentRig markers intact. Do not touch the state machine, role
files, MCP config, or the eval scripts. When finished, summarize exactly which files you changed.
