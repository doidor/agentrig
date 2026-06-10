import type { Manifest } from "../core/knowledge.js";

export const SYSTEM_MESSAGE = `You are AgentRig's installer agent. You are setting up and tailoring an autonomous-coding-agent
"harness" inside a real repository. Be precise and surgical. Prefer reading many files to understand
the repo before writing. Only edit the files you are explicitly asked to. Never invent build/test
commands — verify them against package manifests, lockfiles, CI config, and scripts you actually
find. Keep edits idempotent.`;

export function buildInvestigatePrompt(): string {
  return `# Task 1 of 2 — Investigate this repository

Investigate the repository in your current working directory and write your findings to
\`.agentrig/context.md\` (create the file; create the .agentrig directory if needed).

Cover, with evidence from actual files:
1. **Purpose** — what this project is and who uses it (2-4 sentences).
2. **Stack** — languages, frameworks, runtimes, package manager(s).
3. **Commands** — the real install / build / test / lint commands (cite where you found them:
   package.json scripts, Makefile, CI workflow, pyproject, go.mod, etc.). If a command does not
   exist, say so explicitly rather than guessing.
4. **Layout** — a concise directory map of the most important folders and what they contain.
5. **Conventions** — notable coding conventions, testing patterns, and any "instructions are the
   source of truth" docs (AGENTS.md, CONTRIBUTING, etc.).
6. **Risks for an autonomous agent** — protected areas, generated code, flaky tests, anything an
   agent should be careful about.

Be thorough but factual. Do not modify any other files in this step. When done, reply with a short
confirmation and the exact install/build/test/lint commands you found.`;
}

export function buildTailorPrompt(manifest: Manifest): string {
  const artifactList = manifest.artifacts.map((a) => `- \`${a.dest}\` (principle ${a.principle})`).join("\n");
  return `# Task 2 of 2 — Tailor the installed harness to this repository

AgentRig has just installed a canonical best-practice harness into this repo:

${artifactList}

Using everything you learned in Task 1 (and \`.agentrig/context.md\`), make the harness
repo-specific. Edit **only** the files listed below.

1. **\`AGENTS.md\`** — replace every \`{{PLACEHOLDER}}\` and fill the content between the
   \`<!-- AGENTRIG:...:start -->\` / \`:end\` markers:
   - \`{{REPO_NAME}}\`, \`{{REPO_SUMMARY}}\` — name and a 2-3 sentence description.
   - The \`commands\` block — the REAL install/build/test/lint commands you verified. If one
     genuinely does not exist, write \`(none)\`.
   - The \`dirmap\` block — a concise directory map.
   Do NOT change anything between the \`critical-rules\` markers.
2. **\`.agents/rules/coding-standards.md\`** — replace the generic baseline with standards that
   actually match this repo's language and conventions. Keep it to a short list of imperative
   reflexes and keep the frontmatter \`globs\`/\`description\`.
3. **\`.agentrig/eval/scenarios/\`** — adjust the existing scenario files so the setup/success
   criteria reference this repo's real test/build commands and structure. Do not remove the axis
   lists.
4. **\`.github/workflows/copilot-setup-steps.yml\`** — author a REAL, repo-specific setup workflow so
   the GitHub Copilot **cloud/coding agent** has a ready environment (don't leave a generic stub).
   Base it on your investigation:
   - A single job named EXACTLY \`copilot-setup-steps\` on \`runs-on: ubuntu-latest\`, with
     \`permissions: contents: read\`, triggered by \`workflow_dispatch\` + \`push\`/\`pull_request\`
     filtered to this file.
   - Steps that install the ACTUAL toolchain + dependencies you found: correct language runtime(s)
     and version(s) (from \`.nvmrc\`/\`.tool-versions\`/\`engines\`/\`go.mod\`/\`pyproject.toml\`), the
     correct package manager and install command (e.g. \`npm ci\`/\`pnpm i --frozen-lockfile\`/
     \`pip install -e .\`/\`go mod download\`), dependency caching, and any system packages or
     \`services\` (databases, etc.) the build/tests need. Keep it to env setup — not the task itself.
   If you cannot determine the stack confidently, leave the generated scaffold and note what's
   missing.

Keep all YAML frontmatter and the AgentRig markers intact. Do not touch the state machine, role
files, MCP config, or the eval scripts. When finished, summarize exactly which files you changed.`;
}

export function buildUpdatePrompt(changed: string[]): string {
  return `# Task — Re-apply the latest AgentRig best practices

AgentRig refreshed these canonical artifacts to their latest version:
${changed.map((c) => `- \`${c}\``).join("\n")}

For each refreshed file, reconcile it with this repo:
- Preserve repo-specific content the team added (especially inside AgentRig markers in AGENTS.md and
  in \`coding-standards.md\` and the scenarios).
- Adopt new structure, new sections, and new defaults from the canonical version.
- If there is a genuine conflict, prefer the new canonical structure but keep repo-specific facts
  (commands, directory map, summary).

Re-read \`.agentrig/context.md\` first for repo context. Summarize what you merged and any conflicts
you resolved.`;
}

export interface DynamicRunContext {
  runId: string;
  artifactsDir: string;
  variant?: string;
}

/**
 * @deprecated Replaced by buildProducerPrompt + buildJudgePrompt in the P3 producer/judge
 * split. Kept temporarily so legacy callers don't break during the migration.
 */
export function buildDynamicEvalPrompt(scenarioId?: string, run?: DynamicRunContext): string {
  const scope = scenarioId
    ? `the single scenario \`.agentrig/eval/scenarios/${scenarioId}/\``
    : "each scenario in \`.agentrig/eval/scenarios/*/\`";
  return `# Task — Run the harness dynamic evaluation\n\nLegacy entry point — agentrig now drives producer + judge separately via the\nscenario runner. Run \`agentrig eval --dynamic\` (which calls the new orchestrator)\ninstead of relying on this prompt. Scope: ${scope}. Run id: ${run?.runId ?? "n/a"}.\n`;
}

/** Producer prompt — handed to the agent running in the scenario worktree.
 *  Inlines the scenario's own prompt.md so the producer doesn't need to find it. */
export function buildProducerPrompt(scenarioPrompt: string, variant: string): string {
  const baselineNote = variant === "baseline"
    ? `\n**This is a BASELINE trial — harness OFF.** Do NOT read or follow \`AGENTS.md\`, \`.agents/rules/\`, \`.agents/skills/\`, or any AgentRig-installed instruction surface, even if they happen to be present in this worktree. Behave as a bare agent with only your training-data priors.\n`
    : `\n**This is a HARNESS trial — harness ON.** Follow \`AGENTS.md\`, the rules in \`.agents/rules/\`, and the skills in \`.agents/skills/\` if they are present in this worktree.\n`;
  return `# Scenario task\n${baselineNote}\nYour entire job is described below. Work inside the current directory (this is a\nthrowaway worktree dedicated to your trial). When done, simply finish — the\nscenario runner captures your diff, your transcript, and runs the deterministic\noracle automatically.\n\n---\n\n${scenarioPrompt}\n`;
}

export interface JudgeContext {
  scenario: string;
  type: "run" | "spec" | "review";
  judgeAxes: string[];
  outputJsonPath: string;     // absolute
  rubricPath: string;         // absolute path to axes.json
}

/** Judge prompt — handed to a DIFFERENT model than the producer. The judge runs in a
 *  dedicated cwd containing prompt.md, diff.patch, transcript.md, oracle.json, judge_brief.md.
 *  Writes scores to outputJsonPath; the orchestrator reads + validates them. */
export function buildJudgePrompt(ctx: JudgeContext): string {
  const axesList = ctx.judgeAxes.length
    ? ctx.judgeAxes.map((a) => `- \`${a}\``).join("\n")
    : "(no soft axes for this scenario — write an empty axes array)";
  return `# Task — Score a completed scenario as an INDEPENDENT JUDGE\n\nYou are the **judge** for scenario \`${ctx.scenario}\` (type: \`${ctx.type}\`). The producer\nagent has already finished. Read these files in your cwd to do your scoring:\n\n- \`prompt.md\`     — the exact task the producer was given\n- \`diff.patch\`    — the change the producer produced\n- \`transcript.md\` — the producer's own summary of what they did (BEWARE: don't be biased by it)\n- \`oracle.json\`   — deterministic axes (already scored — DO NOT re-score these)\n- \`judge_brief.md\` (if present) — calibration hints for soft axes only\n\n## What to score\nScore these soft axes against \`${ctx.rubricPath}\`:\n${axesList}\n\nTiers are strict: \`0\` / \`0.5\` / \`1.0\`. Any score < 1.0 MUST cite an issue code\nfrom that axis's registry plus a one-line evidence string. Use \`confidence: 0\` for\naxes you genuinely cannot observe.\n\n## How to submit\nWrite your scores to \`${ctx.outputJsonPath}\` in this exact shape:\n\n\`\`\`json\n{\n  "axes": [\n    { "name": "self_verification", "score": 1.0, "confidence": 1 },\n    { "name": "clarity",           "score": 0.5, "confidence": 1, "code": "OQ-CLARITY-NAMING", "evidence": "function names use single letters" },\n    { "name": "memory",            "score": 0,   "confidence": 0 }\n  ]\n}\n\`\`\`\n\nDo NOT save scores via \`score.mjs\` yourself — the orchestrator does that.\n\n## Independence\nDo NOT defer to the producer's reasoning. Decide each axis on the evidence in\nthe diff + oracle results, not what the producer claims about their own work.\nIf the diff contradicts the transcript, the diff wins.\n`;
}

export interface ScaffoldExample {
  id: string;
  scenarioYml: string;
  promptMd: string;
  oracleYml: string;
}

export interface ScaffoldContext {
  count: number;
  contextMd: string;
  examples: ScaffoldExample[];
  axesAvailable: { types: string[]; axisNames: string[] };
}

/** Scaffold-scenarios prompt — handed to an agent during `agentrig eval --scaffold`. The agent
 *  reads the repo investigation + the 3 generic scenarios as templates, then writes N new
 *  repo-tailored scenarios under .agentrig/eval/scenarios/. */
export function buildScaffoldScenariosPrompt(ctx: ScaffoldContext): string {
  const examplesText = ctx.examples.map((e) =>
    `### Example: \`${e.id}\`\n\n**scenario.yml**\n\`\`\`yaml\n${e.scenarioYml.trim()}\n\`\`\`\n\n**prompt.md** (first 800 chars)\n\`\`\`markdown\n${e.promptMd.slice(0, 800)}\n\`\`\`\n\n**oracle.yml**\n\`\`\`yaml\n${e.oracleYml.trim()}\n\`\`\``,
  ).join("\n\n");

  return `# Task — Generate repository-specific eval scenarios

The 3 scenarios under \`.agentrig/eval/scenarios/\` are language-agnostic JS micro-fixtures. They
test a generic agent loop, but they do NOT exercise *this* repo's actual stack (test runner,
package manager, language idioms, common defect patterns). Your job: write ${ctx.count} new
scenario(s) that ARE specific to this repo.

## Repo investigation (from \`.agentrig/context.md\`)

\`\`\`
${ctx.contextMd.trim() || "(no context.md found — investigate the repo yourself before writing scenarios)"}
\`\`\`

## What a scenario looks like (templates)

${examplesText}

## What to produce

For each new scenario:

1. Create a directory \`.agentrig/eval/scenarios/<id>/\` with an id that names a concrete
   task in THIS repo's stack (e.g. \`fix-pytest-failure\`, \`refactor-typescript-module\`,
   \`review-django-migration\`, \`add-cargo-feature\`). NO generic ids — \`fix-failing-test\` is taken.
2. Write \`scenario.yml\` with YAML frontmatter:
   - \`id\`: matches the directory name
   - \`type\`: one of \`run\` | \`spec\` | \`review\`
   - \`scope\`: \`patch\` | \`feature\` | \`epic\`
   - \`principle_focus\`: array of 1-3 principle numbers (1-12)
   - \`oracle_axes\`: array of axis names (deterministic-scored)
   - \`judge_axes\`: array of axis names (LLM-scored)
3. Write \`prompt.md\` — the exact task handed to the producer agent. NO ambiguity, NO "invent your own spec."
4. Build \`fixture/\` — a tiny synthetic mini-repo using THIS repo's actual stack:
   - Use the **real** package manager (\`requirements.txt\` / \`go.mod\` / \`package.json\` / \`Cargo.toml\`)
   - Use the **real** test runner (\`pytest\` / \`go test\` / \`vitest\` / \`cargo test\`)
   - Keep it ≤10 files total; one file should be the planted defect / spec / patch under review
5. Write \`oracle.yml\` — deterministic checks (cmd, diff_stats, diff_files, file_contains, file_missing).
   The \`cmd\` checks MUST use this repo's actual test command, not \`npm test\`.
6. Write \`README.md\` — 1-2 paragraphs describing what the scenario tests + what a defect looks like.
7. Write \`judge_brief.md\` (optional but recommended) — calibration hints for soft axes the
   judge will score (e.g. "1.0 = wrote a wiki entry, 0.5 = mentioned in summary, 0 = silent").

## Hard constraints

- **DO NOT modify the existing generic scenarios** (\`fix-failing-test\`, \`add-small-feature\`,
  \`review-catches-bug\`, \`agentrig-init-on-empty-repo\`). They stay as both templates AND running scenarios.
- **DO NOT touch any file outside \`.agentrig/eval/scenarios/\`.**
- **Axis names must come from the live registry.** Valid types: ${ctx.axesAvailable.types.join(", ")}.
  Valid axis names (use only these): ${ctx.axesAvailable.axisNames.join(", ")}.
- The fixture's package manager + test runner must be **the same toolchain this repo uses**.
  Check \`AGENTS.md\` for the install/test commands.
- Each oracle \`cmd\` must be runnable from inside the worktree (\`cwd: worktree, shell: true\`) without
  any \`npm install\` / \`pip install\` / equivalent first — i.e., the fixture should be self-contained
  or rely on stdlib only. If the test command needs deps, include a tiny dependency-free alternative.

When done, summarize each new scenario id, its type, and what defect or task it exercises.`;
}
