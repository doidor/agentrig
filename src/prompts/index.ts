import type { Manifest } from "../core/knowledge.js";
import { substitute } from "../core/fsutil.js";
import { loadTemplate } from "./loader.js";

// All prompt copy lives in `./templates/*.md` (read at runtime via loadTemplate). The functions
// here only assemble dynamic data into those templates via `{{PLACEHOLDER}}` substitution and own
// any conditional logic — so prompt wording can be edited as plain markdown without touching TS.

export const SYSTEM_MESSAGE = loadTemplate("system-message.md");

export function buildInvestigatePrompt(): string {
  return loadTemplate("investigate.md");
}

export function buildTailorPrompt(manifest: Manifest): string {
  const artifactList = manifest.artifacts
    .map((a) => `- \`${a.dest}\` (principle ${a.principle})`)
    .join("\n");
  return substitute(loadTemplate("tailor.md"), { ARTIFACT_LIST: artifactList });
}

export function buildUpdatePrompt(changed: string[]): string {
  const changedList = changed.map((c) => `- \`${c}\``).join("\n");
  return substitute(loadTemplate("update.md"), { CHANGED_LIST: changedList });
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
    : "each scenario in `.agentrig/eval/scenarios/*/`";
  return (
    substitute(loadTemplate("dynamic-eval.md"), {
      SCOPE: scope,
      RUN_ID: run?.runId ?? "n/a",
    }) + "\n"
  );
}

/** Producer prompt — handed to the agent running in the scenario worktree.
 *  Inlines the scenario's own prompt.md so the producer doesn't need to find it. */
export function buildProducerPrompt(scenarioPrompt: string, variant: string): string {
  const isBaseline = variant === "baseline";
  // baseline vs harness only differ by the variant note and the (harness-only) pre-handoff
  // checklist. The checklist is the same one the self-verify and log-gotcha skills describe, but
  // inlined at the END of the prompt (LLMs weight end-of-prompt instructions more heavily than
  // buried skill bodies). The baseline variant deliberately omits it — that's what makes the
  // harness-on vs baseline A/B measure something real.
  const note = isBaseline
    ? loadTemplate("producer-baseline-note.md")
    : loadTemplate("producer-harness-note.md");
  const variantNote = `\n${note}\n`;
  const handoffChecklist = isBaseline
    ? ""
    : `\n\n---\n\n${loadTemplate("producer-handoff-checklist.md")}\n`;

  return (
    substitute(loadTemplate("producer.md"), {
      VARIANT_NOTE: variantNote,
      SCENARIO_PROMPT: scenarioPrompt,
      HANDOFF_CHECKLIST: handoffChecklist,
    }) + "\n"
  );
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
  return (
    substitute(loadTemplate("judge.md"), {
      SCENARIO: ctx.scenario,
      TYPE: ctx.type,
      RUBRIC_PATH: ctx.rubricPath,
      AXES_LIST: axesList,
      OUTPUT_JSON_PATH: ctx.outputJsonPath,
    }) + "\n"
  );
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
  const examplesText = ctx.examples
    .map(
      (e) =>
        `### Example: \`${e.id}\`\n\n**scenario.yml**\n\`\`\`yaml\n${e.scenarioYml.trim()}\n\`\`\`\n\n**prompt.md** (first 800 chars)\n\`\`\`markdown\n${e.promptMd.slice(0, 800)}\n\`\`\`\n\n**oracle.yml**\n\`\`\`yaml\n${e.oracleYml.trim()}\n\`\`\``,
    )
    .join("\n\n");
  const contextMd =
    ctx.contextMd.trim() ||
    "(no context.md found — investigate the repo yourself before writing scenarios)";

  return substitute(loadTemplate("scaffold-scenarios.md"), {
    COUNT: String(ctx.count),
    CONTEXT_MD: contextMd,
    EXAMPLES_TEXT: examplesText,
    AXIS_TYPES: ctx.axesAvailable.types.join(", "),
    AXIS_NAMES: ctx.axesAvailable.axisNames.join(", "),
  });
}
