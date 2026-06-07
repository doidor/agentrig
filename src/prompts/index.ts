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
}

export function buildDynamicEvalPrompt(scenarioId?: string, run?: DynamicRunContext): string {
  const scope = scenarioId
    ? `the single scenario \`.agentrig/eval/scenarios/${scenarioId}.md\``
    : "each scenario in \`.agentrig/eval/scenarios/*.md\`";
  const runLine = run
    ? `\nTag every score with \`--run ${run.runId}\`. For each scenario, also save artifacts into
\`${run.artifactsDir}\`: \`diff.patch\` (the produced change, e.g. \`git -C <worktree> diff > ${run.artifactsDir}/<scenario>.diff.patch\`)
and \`<scenario>.output.md\` (a short transcript/summary). These make regressions inspectable.\n`
    : "";
  return `# Task — Run the harness dynamic evaluation

Run the behavioral evaluation described in \`.agents/skills/harness-eval/SKILL.md\` (Layer B) for
${scope}.
${runLine}
For each scenario, in order:
1. Execute the scenario task through this repo's harness.
2. Score the result against \`.agentrig/eval/RUBRIC.md\` as an independent judge. For any axis below
   1.0, record an issue code and one line of evidence.
3. **Immediately** persist that scenario's score with \`node .agentrig/eval/score.mjs save ...\`${run ? ` --run ${run.runId}` : ""}
   (never hand-edit the JSON) BEFORE starting the next scenario, so progress is never lost if the
   run is interrupted.
4. Keep each scenario focused and time-boxed. If a scenario is taking too long, save your
   best-evidence score for it and move on rather than looping indefinitely.

When every scenario in scope is scored, run \`node .agentrig/eval/score.mjs report\` and summarize
the aggregate, calling out the weakest axes.`;
}
