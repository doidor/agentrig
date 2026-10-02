# AgentRig: document-first harness specification

**Specification version:** 2.0 (four general rules are required; no release tag implied).

AgentRig is a specification, directly copyable native assets, and a small static validator. An
agent can install a repository-local harness by reading this document and the linked assets; no
AgentRig CLI, model provider, published npm package, installer, manifest, or state database is
involved. A separate, dev-only documentation build mirrors this file on the website.
The goal is the smallest harness that supports reliable work in the *target* repository, not the
largest set of artifacts an installer can produce.

## Core principles

Treat the target repository's explicit instructions as the source of truth, but inspect its code,
tests, and actual tooling before writing those instructions. Resolve conflicts with legacy
patterns deliberately rather than copying them. Explicit requirements, correctness, and security
take precedence over the engineering principles below:

- **KISS:** implement the simplest *complete* solution. Avoid speculative layers, configuration,
  orchestration, and abstraction.
- **DRY:** give each stable rule, contract, and piece of knowledge one authoritative home. Do not
  build a generic abstraction just to remove a little obvious duplication; consolidate when the
  repeated concept is demonstrably the same and stable.
- **Fail fast:** validate input and invariants at their boundaries; stop with an actionable error
  instead of silently defaulting or reporting partial success. Preserve an explicitly required
  graceful-degradation path rather than treating every recoverable failure as fatal.
- **Least surprise:** honor existing contracts and repository conventions. A breaking change must
  be intentional, scoped, versioned, and explained with a migration path, not disguised as a
  compatible update.

When KISS and DRY conflict, a small amount of clear duplication beats a premature framework.
The native [engineering-principles rule](.agents/rules/engineering-principles.md) supplies
day-to-day operational guidance; do not copy its full body into `AGENTS.md`. Rules are
glob-scoped reflexes; skills are explicit, repeatable procedures. Builders must self-verify with
observed results and submit their work for independent review, not approve it themselves. Humans
retain approval for low-reversibility actions such as publishing, merging, deleting shared data,
or changing access controls.

## Universally required Core profile

Install these paths in the target repository (the linked files are the **source** assets):

| Target path | Contract |
| --- | --- |
| `AGENTS.md` | Repository-specific instructions with nonempty `## Purpose` and `## Commands` sections. List `Build`, `Test`, and `Lint` explicitly: use actual runnable commands, or `none` with a reason for Build/Lint. Test must be an executable command, not a placeholder or `none`. Link to the engineering-principles rule rather than duplicating it. |
| `.agents/agents/builder.md` | Copy the [Builder prompt](.agents/agents/builder.md). The Builder establishes acceptance criteria, inspects context, makes the smallest complete change, and records actual self-verification. |
| `.agents/agents/paranoid.md` | Copy the [Paranoid prompt](.agents/agents/paranoid.md) verbatim, including its final newline. This file contains only the frozen system-prompt body; invocation metadata stays here, not in the prompt. |
| `.agents/skills/self-verify/SKILL.md` | Copy the [self-verify skill](.agents/skills/self-verify/SKILL.md); use it before handoff, including the baseline and after evidence from the target's own commands. |
| `.agents/rules/engineering-principles.md` | Copy the [engineering-principles rule](.agents/rules/engineering-principles.md). It has actionable sections named KISS, DRY, Fail fast, and Least surprise. |
| `.agents/rules/security.md` | Copy the [security rule](.agents/rules/security.md) for input boundaries, secrets, and least privilege. |
| `.agents/rules/code-review.md` | Copy the [code-review rule](.agents/rules/code-review.md) for consequential, evidence-backed findings and independent approval. |
| `.agents/rules/no-debug-logging.md` | Copy the [no-debug-logging rule](.agents/rules/no-debug-logging.md) to keep temporary diagnostics out of changes. |

The four general rules above are always part of Core. The same `llms.txt` index also offers
four **optional** procedural skills; choose them only when the repository has the matching
workflow:

| When needed | Available skill |
| --- | --- |
| CI fails | [fix-ci](.agents/skills/fix-ci/SKILL.md) |
| PR review feedback needs addressing | [address-review-comments](.agents/skills/address-review-comments/SKILL.md) |
| An authorized branch needs conflict resolution | [resolve-conflicts](.agents/skills/resolve-conflicts/SKILL.md) |
| A recurring gotcha needs recording or reporting | [log-gotcha](.agents/skills/log-gotcha/SKILL.md) |

Every installed skill, including optional ones, needs `description` and `allowed-tools` in its
frontmatter. Every installed rule needs `globs`, `description`, and `priority` in its frontmatter.
Keep paths native to the repository; do not add role YAML, model tiers, workflow-state ownership,
generated vendor copies, or other default machinery. Do not leave template tokens or fake
commands in the installed instructions.

### Independent review

Invoke Paranoid **after** the Builder has produced a diff and verification evidence. Start a fresh,
read-only review context; use a different model family from the Builder when the host offers one,
but do not require a model configuration or a particular vendor. Use the native Paranoid file as
the system prompt, unchanged. Provide the original request and intended behavior, the diff,
relevant surrounding code/callers/tests, and the repository's check commands (plus observed
Builder results). Do **not** supply the Builder's review conclusions or any prior reviews.
Allow targeted, non-mutating checks. Keep confirmed findings separate from unverified leads and
leave consequential decisions to the human owner; Paranoid does not edit files or own workflow
state.

## Bootstrap a target repository

1. **Choose one entrypoint.** Give your agent
   `https://tudorpopa.com/agentrig/llms.txt`, which links the full specification, seven
   verbatim Core Markdown assets, the optional skills, and the static validator from the same
   site build. For an unpublished local preview, use that preview's `llms.txt` URL instead;
   the agent must be able to reach it. No repository checkout is required. For a reproducible
   pinned snapshot instead of a moving site, fetch this specification and its
   assets from the **same existing Git tag or commit** via raw URLs; do not assume a new tag
   already exists.
2. **Investigate before writing.** Read the target's existing instructions, README, manifests,
   CI, build/test/lint configuration, relevant source and tests, and working-tree state. Identify
   the actual purpose, commands, conventions, and risks. Do not replace local work blindly.
3. **Write or reconcile `AGENTS.md`.** Add the required Purpose and Commands sections with
   truthful Build/Test/Lint entries and a runnable Test command. Record repository-specific
   conventions and link `.agents/rules/engineering-principles.md`. If any file already exists,
   compare and merge the two intents rather than overwriting it.
4. **Install the Core assets in the table.** Copy the two agent prompts, the self-verify
   skill, and all four general rules from links in the same `llms.txt` index (or the
   same pinned Git ref) into their exact target paths. Preserve the Paranoid body exactly.
   Add an optional procedural skill only for a concrete need; check its frontmatter too.
5. **Exercise the harness.** Run the target's Test command and any available Build/Lint commands,
   apply the self-verify skill, and invoke Paranoid independently on a real change. If a command
   fails, surface the failure and fix it rather than claiming success.
6. **Validate structure.** Download the validator linked in that index to a temporary file,
   then run `node /path/to/downloaded/validate.mjs /path/to/target`. Fix each reported error
   and rerun until it exits zero. The validator uses Node.js only, no package install or
   model access. It cannot prove that an agent actually obeys the principles or that a code
   change is correct.

## Conditional recipes (not Core requirements)

| When repository evidence calls for it | Add only what is needed |
| --- | --- |
| Concurrent agents write to the same repository | Give each writer an isolated worktree and define how changes are reviewed and reconciled. |
| An automated issue/PR queue operates across sessions | Use a durable external system of record, an explicit state machine, bounded retries/limits, and human gates for low-reversibility transitions. Do not make these mandatory for interactive work. |
| More than one agent host needs instructions | Author just the native adapter(s) those hosts need, derived from the same instructions; avoid a compiler or committed generated copies by default. |
| The work involves high-risk security, privacy, or regulatory domains | Add a specialist, independent security/privacy review alongside Paranoid; do not quietly expand Paranoid's frozen prompt. |
| You need to measure prompt or harness behavior | Build a separate, bounded evaluation project with explicit scenarios and evidence; static Core validation is not a behavioral score. |

Add a skill only for a recurring, multi-step procedure with a clear trigger and observable outcome;
put short reflexes in rules instead. When a failure exposes a reusable gotcha, record the observed
case in the repository's knowledge base if one exists, change the relevant instruction surface,
and check that the new guidance prevents recurrence. Do not install a wiki, dashboard, or eval
framework just to satisfy this maintenance advice.

## Core acceptance checklist

This is the static contract checked by `validate.mjs`; each failure must be reported with an
actionable error and a nonzero exit status:

- [ ] `AGENTS.md` exists, with nonempty `## Purpose` and `## Commands`; it states the real
  repository purpose and explicit Build/Test/Lint entries. Test is runnable; Build/Lint are
  runnable or explicitly `none` with a reason, never placeholders.
- [ ] `AGENTS.md` or the required engineering-principles rule explicitly gives operational
  guidance for KISS, DRY, Fail fast, and Least surprise rather than just naming them.
- [ ] The Builder and Paranoid prompt files exist; Paranoid covers independent inspection,
  evidence and verification, confirmed versus unverified findings, and final scope/checks.
- [ ] The core self-verify skill exists; **every** installed skill has `description` and
  `allowed-tools` frontmatter.
- [ ] All four general rules exist with nonempty instructions and valid `globs`, `description`,
  and `priority` frontmatter; the engineering rule has the four named, actionable sections.
  **Every** additional installed rule meets the same frontmatter contract.
- [ ] No unresolved template tokens remain in the installed harness.

Source integrity is separate from target conformance: AgentRig's own tests compare its native
Paranoid file byte-for-byte with the approved frozen prompt. The validator checks target prompt
semantics instead of requiring an exact hash, so local hosts can supply wrapper metadata without
changing the canonical source. Passing static checks is evidence of structure, not proof of
behavior or security.

## Upgrade without a migration engine

Revisit one docsite `llms.txt` index for the latest guidance, or use raw URLs at one released
tag or commit for a pinned upgrade. Read the specification **and** linked native assets together,
compare them to the target's instructions and customizations, and reconcile each difference
intentionally. Run the target's checks and the validator from the same source. Review proposed
deletions and other
low-reversibility changes with a human; no manifest, recorded ownership state, automatic
overwrite, or automatic target deletion is involved. See [MIGRATION.md](MIGRATION.md) when moving
from the former npm CLI.
