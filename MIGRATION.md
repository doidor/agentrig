# Migrating from the AgentRig CLI

The document-first AgentRig is a **clean break**, not an update of the npm CLI. Start with
[AGENT-RIG.md](AGENT-RIG.md) and the native assets from one chosen Git ref; an agent inspects and
reconciles your repository. There is no new installer, CLI, npm runtime, manifest, or automatic
migration. Your existing target files are **not** deleted or changed by this repository: review
any removals or replacements yourself, especially generated files used by agent hosts.

| Former command or surface | Document-first workflow |
| --- | --- |
| `agentrig init [path]` | Ask an agent to read the spec, inspect the target, write/reconcile its `AGENTS.md`, and install only the Core native files. |
| `agentrig update [path]` | Read the spec and assets from a chosen existing tag/commit (or `main` for latest), compare with local instructions, and reconcile intentionally. No ownership database or auto-migration. |
| `agentrig compile [path]` | Use `AGENTS.md` and `.agents/` directly; hand-author only the vendor adapters actually needed. No generic projection/compiler step. |
| `agentrig fix [path]` | Run `node /path/to/agentrig/validate.mjs /path/to/target`; fix reported errors deliberately and rerun. No automatic repair or backup semantics. |
| `agentrig eval --static` | Run the same validator. It checks the small Core contract, not an install score or agent behavior. |
| `agentrig eval`, `--scaffold`, dynamic scoring | Removed from Core; create a separate evaluation project if behavior experiments are needed. |
| `agentrig doctor` | Run the validator plus the target repository's own Build/Test/Lint checks; there is no provider or package health probe. |
| `agentrig dashboard` | Removed; consult the external issue/PR system if the repository uses automated queues. |
| `--skip-agent`, `--dry-run`, `--force`, provider/model flags | No corresponding runtime flags. Ask your agent to preview diffs, preserve local work, and request human approval for risky changes. |

| Former artifact | What replaces it |
| --- | --- |
| `knowledge/` templates, `manifest.json`, `checks.json`, `.agentrig/state.json` | One specification and directly copyable `.agents/` prompts, rules, and skills. No second template tree or ownership state. |
| Triager/developer/reviewer/judge YAML and model tiers | Builder plus the fresh, read-only Paranoid prompt; no model IDs, role YAML, or workflow-state ownership. Add a specialist reviewer for high-risk work if needed. |
| `.agentrig/harness/`, labels, pollers, worktree repair | Optional state-machine/external-record and isolated-worktree recipes when concurrency or automated queues justify them. |
| `.agentrig/eval/`, dashboard, generated vendor instructions, MCP/setup files | Not part of Core. Keep or hand-author *existing target-specific* files that your tools genuinely require; do not delete them as part of a blanket migration. |
| npm build/publish machinery and old docs site | The Git-versioned specification and its native assets; validation requires only Node.js. Do not infer that a new release tag already exists. |

The published `@doidor/agentrig@0.12.0` package is the **historical CLI path**, not the new
document-first workflow. If you must reproduce an old CLI run, pin that version explicitly
(`npx @doidor/agentrig@0.12.0 ...`); it does not install or upgrade this Core profile. For a
reproducible document-first bootstrap, use all files from the **same existing tag or commit**.
Point an agent at the spec, preserve your own customizations, review the diff, run your repository
checks, then run `node /path/to/agentrig/validate.mjs /path/to/target`. No automatic deletion,
silent migration, or upstream npm action is part of that process.
