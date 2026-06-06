# Agent roles (principle 2 — specialize roles, vary models)

The harness routes each state of the workflow to a **specialized agent type**, each with its own
short prompt and its own model. Running different roles on **different models** is deliberate:
single-model-bias mitigation surfaces problems no single model would catch alone.

## Roster (installed by default)

| Role | File | Default model | Drives state |
|------|------|---------------|--------------|
| **triager**  | `triager.{yml,md}`  | `gpt-5-mini` (low)        | `ingested → queued` |
| **developer**| `developer.{yml,md}`| `claude-sonnet-4.5` (high)| `queued → implementing → reviewing` |
| **reviewer** | `reviewer.{yml,md}` | `gpt-5` (high)            | `reviewing` |
| **judge**    | `judge.{yml,md}`    | `claude-opus-4.5` (high)  | `judging → ready_to_merge` |

> Keep the **reviewer on a different model family than the developer**. The audit
> (`agentrig eval --static`) checks for this.

## Each role has two files
- `<role>.yml` — declarative config: `role`, `model`, `model_tier`, `allowed_tools`, and the
  `prompt` path. Skills are auto-discovered from `.agents/skills/`, so no skill list is needed.
- `<role>.md` — the role's short prompt (keep it to a few imperative lines).

## Adding a new agent type
1. Create `agents/<role>.yml` and `agents/<role>.md`. Pick a model that differs from adjacent roles
   in the pipeline.
2. Wire the role into `.agentrig/harness/state-machine.yml` by giving a transition
   `trigger: agent` and `role: <role>`.
3. If the role needs a new procedure, add a skill under `.agents/skills/`.

Example roles you might add: `designer` (visual/UX work), `security-reviewer`, `release-manager`,
`docs-writer`. The pipeline is yours to extend — the state machine is the contract that keeps it
coherent.
