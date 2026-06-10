# AgentRig — Principles of a successful agent harness

> This is AgentRig's **canonical, editable** copy of the harness principles. Edit it freely;
> `agentrig update` will carry your edits into any repo that uses AgentRig.
> Synthesized from `infinity-microsoft/epichan`, `office-shared/fluent-agent`, and
> `microsoft/fluentui`.

A *harness* is the surrounding scaffolding (orchestration, prompts, skills, memory, evaluation)
that lets autonomous coding agents reliably **triage → implement → review → judge → merge** with
minimal human babysitting. AgentRig installs an opinionated harness into any repo, keeps context of
what the repo is about, and ships a way to **evaluate the harness itself**.

Each principle below names the concrete artifact(s) AgentRig installs and how the install-completeness
audit and quality probes (`agentrig eval --static`) score it.

---

## 1. Treat the workflow as an explicit state machine
Every task moves through named states (`ingested → queued → implementing → reviewing → judging →
ready_to_merge → merged → closed`) and every transition declares its trigger. The DAG is the
contract; agents do not invent transitions and reviewers cannot skip gates.
**Artifact:** `.agentrig/harness/state-machine.yml`.

## 2. Specialize roles, vary models
Route each state to a *role* (`triager`, `developer`, `reviewer`, `judge`), each with a short prompt
and its own `model_tier`. Run the reviewer on a **different model than the developer** — single-model
-bias mitigation matters more than any prompt tweak. The roster is extensible: add new agent types
(`designer`, `security-reviewer`, …) by dropping a `<role>.{yml,md}` in and wiring a transition.
**Artifact:** `.agentrig/agents/{triager,developer,reviewer,judge}.{yml,md}` (+ `README.md`) with
distinct models.

## 3. Externalize state in a system of record
GitHub is the source of truth. Labels are the contract, not decoration. Pollers reconcile the
engine against GitHub on a cadence; events drive reactive transitions. If the engine crashes,
GitHub still tells you the truth. A **dashboard** surfaces the live picture: which tasks sit in which
state (by label), who they're assigned to, plus harness score and eval status.
**Artifact:** labels/state mapping in the state machine + MCP GitHub server +
`.agentrig/dashboard/dashboard.mjs` (`agentrig dashboard`).

## 4. Skills are procedural memory; rules are reflexes
Skills (`SKILL.md` with YAML frontmatter for triggers, `allowed-tools`, `argument-hint`) encode
*how to do one thing well*. They are composable, auto-discovered, tool-scoped, and mirrored across
vendor surfaces (`.claude/`, `.copilot/`, `.agents/`, …). Rules are glob-scoped and auto-loaded
when matching files are edited, with an explicit priority order.
**Artifact:** `.agents/skills/*/SKILL.md`, `.agents/rules/*.md` + `README.md`.

## 5. Self-verify before handoff
After producing work, the implementing agent runs its own verification loop (build/test/visual)
pinned to its own HEAD and decides between *iterate*, *continue*, or *self-park*. The reviewer is
only invoked once the producer's loop has converged. Cap iteration attempts (N=3) and fall back.
**Artifact:** `.agents/skills/self-verify/SKILL.md`.

## 6. Independent, rubric-driven evaluation
Score work on explicit axes with credit tiers (0 / 0.5 / 1.0), a mandatory **issue code** plus
evidence whenever a score is < full, and a deterministic aggregator (never hand-edited JSON). This
is how you tell whether a prompt change made the agent better or worse — and it is how you evaluate
**the harness itself**.
**Artifact:** `.agentrig/eval/` (RUBRIC.md, checks.json, scenarios, score.mjs, static-audit.mjs)
and the `harness-eval` skill.

## 7. Hermetic per-agent environments
Each concurrent agent runs in its **own git worktree** so developers, reviewers, and judges never
trip over each other's working trees or lockfiles. A repair script prunes stale worktree metadata
before every add. Isolation is a hard prerequisite for multi-agent throughput.
**Artifact:** `scripts/repair-worktrees.sh` + worktree guidance in the wiki.

## 8. Continuous self-improvement: every mistake is a prompt bug
Agents log new gotchas to a tiered memory (central committed wiki → local git-ignored wiki →
session scratch). A `skill-improver` turns reviewer feedback into instruction-surface changes that
must pass a **prevention test** ("would this new wording have changed the original failure?").
Strict admission tests stop duplication from killing the wiki.
**Artifact:** `.agents/wiki/` + `.agents/skills/skill-improver/SKILL.md`.

## 9. Human-in-the-loop where reversibility is low
Low-reversibility actions are recommend-then-apply: the agent surfaces proposed changes and waits
for explicit `apply`/`approve`/`skip`. Certain labels are **human-only gates** the agent must never
apply or even name. These are deliberate trust boundaries, not friction.
**Artifact:** human-gate declarations in the state machine + rules.

## 10. Hard limits and safety nets
Set `max_review_iterations`, `max_diff_chars`, a token `runaway_cap`, and `pre_pr`/`pre_merge`
hooks. Protected files require a human-override label. A recovery scan re-queues anything stuck too
long. These caps keep an agent pool from melting the repo.
**Artifact:** `limits:` block in `.agentrig/harness/state-machine.yml`.

## 11. One canonical source, projected to every agent surface (local + remote)
The harness keeps **one** source of truth (`AGENTS.md` + `.agents/rules/` + `.agents/skills/`) and
**projects** it into each ecosystem's native discovery format so *any* agent benefits without
lock-in — local CLIs **and** remote/cloud agents:
- **GitHub Copilot (remote coding agent + IDE):** `.github/copilot-instructions.md`,
  path-scoped `.github/instructions/*.instructions.md` (`applyTo` globs), and
  `.github/workflows/copilot-setup-steps.yml` for the cloud agent's environment.
- **Claude Code:** `CLAUDE.md`. **Cursor:** `.cursor/rules/*.mdc`. **OpenCode/Codex:** `AGENTS.md`.
- **MCP** mirrored to each surface (`.mcp.json`, `.vscode/mcp.json`, `.github/copilot/mcp.json`).

This is the meta-harness payoff: assign an issue to the web GitHub Copilot agent and it sees the same
rules/setup/MCP as your local Copilot CLI, Claude Code, or Cursor. Projections regenerate from the
source; never hand-edit the generated files.
**Artifact:** the compiler (`agentrig compile`) + the projected files above; symlinked vendor dirs
for skills.

## 12. Instructions are the source of truth, not existing code
A short, unmissable **Critical Rules** block at the top of `AGENTS.md` beats a 50-page contributing
guide. Pair it with package-local AGENTS.md, golden-principles docs, and a directory map so an
agent can answer "what should I do?" without spelunking. Legacy code is not the spec.
**Artifact:** root `AGENTS.md` with a `Critical Rules` section + repo context.
