# Orchestration contract (principles 1, 3, 10)

How AgentRig expects a harness engine to drive `.agentrig/harness/state-machine.yml`. AgentRig
*installs* this contract as plain text; a runner (the epi-platform engine, a CI job, or your own
script) executes it. Synthesized from epichan's engine.

## 1. Triggers: who may move state
Every transition declares a `trigger` kind (`triggers.kinds` in the state machine):
- **agent** — a role does the work (triager/developer/reviewer/judge).
- **script** — a poller/reconciler asserts state from GitHub on a cadence.
- **auto** — a deterministic immediate transition.
- **event** — a GitHub webhook maps straight to a state (`event_to_state`).
- **human** — a person performs a low-reversibility action (e.g. merge).

Agents may only drive `agent` transitions. They must never fabricate `script`/`event`/`human` ones.

## 2. Hybrid event + polling reconciliation
- **Events** give low-latency reactions: `pull_request.synchronize → reviewing`,
  `check_suite.completed.failure → implementing`, etc. (`event_to_state`).
- **Pollers** repair anything events missed, on per-state cadences (`reconciliation`): ingest ready
  issues (60s), route task PRs (300s), confirm merges (120s).
- The engine never *assumes* a PR merged — it flips `ready_to_merge → merged` only after GitHub
  reports it merged.

If the engine crashes, GitHub still holds the truth and the pollers re-derive engine state.

## 3. Compare-and-set transitions (no double-work)
Every state change carries the **status it expects to replace** (`transitions_policy.require_expected_status`).
If the engine reports a conflict (409), another agent or poller already advanced the task — **skip,
don't clobber**. This is the core guard that lets a multi-agent pool run safely.

## 4. Claim grace + stuck recovery
- A task isn't "reclaimable" until `recovery.claim_grace_seconds` (300s) after it's claimed — avoids
  yanking work that just started.
- A recovery sweep every `recovery.scan_seconds` (120s) re-queues anything stuck past
  `recovery.stuck_after_hours` (4h) back to `requeue_to` (`queued`).

## 5. Hooks gate irreversible actions
`hooks.pre_pr` and `hooks.pre_merge` run before opening a PR and before merging. A failing hook
blocks the transition. Put `self-verify` on `pre_pr` and `harness-eval` on `pre_merge`.

## 6. Hard limits and runaway protection
`limits` caps concurrency, review iterations, diff size, and a token `runaway_token_cap`. These keep
an agent pool from melting the repo. Protected/human-only labels (`labels.human_only`) require a
person.

## 7. Model tiers
Roles reference a `model_tier` (cheap/standard/premium), not a hardcoded model, so cost/quality is
re-routable in one place. Keep adjacent pipeline roles on different model families.

## 8. Progress visibility
`issue_comments.on` posts a GitHub comment on task creation, each state transition, failure, and PR
open — so humans can follow the pool without watching the engine.
