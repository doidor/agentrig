# Task — Generate repository-specific eval scenarios

The 3 scenarios under `.agentrig/eval/scenarios/` are language-agnostic JS micro-fixtures. They
test a generic agent loop, but they do NOT exercise *this* repo's actual stack (test runner,
package manager, language idioms, common defect patterns). Your job: write {{COUNT}} new
scenario(s) that ARE specific to this repo.

## Repo investigation (from `.agentrig/context.md`)

```
{{CONTEXT_MD}}
```

## What a scenario looks like (templates)

{{EXAMPLES_TEXT}}

## What to produce

For each new scenario:

1. Create a directory `.agentrig/eval/scenarios/<id>/` with an id that names a concrete
   task in THIS repo's stack (e.g. `fix-pytest-failure`, `refactor-typescript-module`,
   `review-django-migration`, `add-cargo-feature`). NO generic ids — `fix-failing-test` is taken.
2. Write `scenario.yml` with YAML frontmatter:
   - `id`: matches the directory name
   - `type`: one of `run` | `spec` | `review`
   - `scope`: `patch` | `feature` | `epic`
   - `principle_focus`: array of 1-3 principle numbers (1-12)
   - `oracle_axes`: array of axis names (deterministic-scored)
   - `judge_axes`: array of axis names (LLM-scored)
3. Write `prompt.md` — the exact task handed to the producer agent. NO ambiguity, NO "invent your own spec."
4. Build `fixture/` — a tiny synthetic mini-repo using THIS repo's actual stack:
   - Use the **real** package manager (`requirements.txt` / `go.mod` / `package.json` / `Cargo.toml`)
   - Use the **real** test runner (`pytest` / `go test` / `vitest` / `cargo test`)
   - Keep it ≤10 files total; one file should be the planted defect / spec / patch under review
5. Write `oracle.yml` — deterministic checks (cmd, diff_stats, diff_files, file_contains, file_missing).
   The `cmd` checks MUST use this repo's actual test command, not `npm test`.
6. Write `README.md` — 1-2 paragraphs describing what the scenario tests + what a defect looks like.
7. Write `judge_brief.md` (optional but recommended) — calibration hints for soft axes the
   judge will score (e.g. "1.0 = wrote a wiki entry, 0.5 = mentioned in summary, 0 = silent").

## Hard constraints

- **DO NOT modify the existing generic scenarios** (`fix-failing-test`, `add-small-feature`,
  `review-catches-bug`, `agentrig-init-on-empty-repo`). They stay as both templates AND running scenarios.
- **DO NOT touch any file outside `.agentrig/eval/scenarios/`.**
- **Axis names must come from the live registry.** Valid types: {{AXIS_TYPES}}.
  Valid axis names (use only these): {{AXIS_NAMES}}.
- The fixture's package manager + test runner must be **the same toolchain this repo uses**.
  Check `AGENTS.md` for the install/test commands.
- Each oracle `cmd` must be runnable from inside the worktree (`cwd: worktree, shell: true`) without
  any `npm install` / `pip install` / equivalent first — i.e., the fixture should be self-contained
  or rely on stdlib only. If the test command needs deps, include a tiny dependency-free alternative.

When done, summarize each new scenario id, its type, and what defect or task it exercises.
