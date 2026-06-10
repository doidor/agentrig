#!/usr/bin/env node
import { resolve } from "node:path";
import { setVerbose, log, color } from "./core/logger.js";
import { initCommand } from "./commands/init.js";
import { updateCommand } from "./commands/update.js";
import { evalCommand } from "./commands/eval.js";
import { doctorCommand } from "./commands/doctor.js";
import { dashboardCommand } from "./commands/dashboard.js";
import { compileCommand } from "./commands/compile.js";
import pkg from "./version.js";

interface ParsedArgs {
  command: string | undefined;
  positionals: string[];
  flags: Record<string, string | boolean>;
}

const BOOLEAN_FLAGS = new Set([
  "dry-run",
  "diff",
  "skip-agent",
  "static",
  "dynamic",
  "rubric",
  "json",
  "no-tasks",
  "verbose",
  "yes",
  "help",
  "version",
]);

function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  let command: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!BOOLEAN_FLAGS.has(key) && next !== undefined && !next.startsWith("-")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else if (a.startsWith("-")) {
      for (const ch of a.slice(1)) flags[ch] = true;
    } else if (command === undefined) {
      command = a;
    } else {
      positionals.push(a);
    }
  }
  return { command, positionals, flags };
}

const HELP = `${color.bold("agentrig")} — an agentic meta-harness (a harness of harnesses)

${color.bold("Usage:")} agentrig <command> [path] [options]

${color.bold("Commands:")}
  init [path]      Investigate the repo and install a best-practice agent harness.
                     Non-destructive by default — existing AGENTS.md, .mcp.json, rules,
                     skills, wiki entries, etc. are preserved.
                     --force    overwrite existing user content with the canonical templates
  update [path]    Re-sync the latest best practices into an existing harness
                     --diff     show how your preserved files differ from canonical
  compile [path]   Project AGENTS.md + rules into every agent surface (local + remote):
                   copilot-instructions, .github/instructions, CLAUDE.md, .cursor/rules,
                   MCP, and copilot-setup-steps.yml
  eval [path]      Evaluate the harness itself (defaults to the full agentic, harness-on run)
                     --static   fast deterministic structural audit, no model (use in CI)
                     --rubric   print what's evaluated (rubric axes, issue codes, scenarios)
                     --scenario <id>          run one scenario only (e.g. fix-failing-test)
                     --variant <name>         label this run (default 'harness'; 'baseline' = harness OFF)
                     --producer-model <id>    producer model (default: developer.yml model)
                     --judge-model <id>       judge model (default: reviewer.yml model — different family)
                     --allow-same-family      override the producer/judge family check (recorded in results)
                     --n <int>                trials per scenario (default 1 single, 5 in baseline mode)
                     --seed <int>             reproducibility seed (passed through where supported)
                     --timeout <min>          absolute cap per agent turn (default 45)
  doctor [path]    Quick health check (installed? agent reachable? score?)
  dashboard [path] Show agent roster, live GitHub tasks, harness score, and evals
                     --html [file]  write a self-contained HTML dashboard
                     --no-tasks     skip live GitHub lookups (offline)

${color.bold("Options:")}
  --model <id>     Model to use for agentic steps (e.g. claude-sonnet-4.5, gpt-5)
  --dry-run        Show what would happen without writing or calling the model
  --force          (init) overwrite existing user files (off by default; init is non-destructive)
  --skip-agent     Install/update the canonical harness without the agentic steps
  --static         (eval) deterministic audit only
  --dynamic        (eval) run dynamic behavioral eval
  --json           Machine-readable output (eval/doctor/dashboard)
  --min <pct>      (eval --static) exit non-zero if Harness Score < pct
  --html [file]    (dashboard) write an HTML page instead of terminal output
  --no-tasks       (dashboard) skip live GitHub task lookups
  --verbose        Verbose logging
  -h, --help       Show this help
  -v, --version    Show version

${color.bold("Environment:")}
  AGENTRIG_PROVIDER  Agent backend (default: copilot)

${color.dim("Best practices live in this package's knowledge/ directory — edit them and run `agentrig update`.")}`;

async function main(): Promise<number> {
  const { command, positionals, flags } = parseArgs(process.argv.slice(2));

  if (flags.version || flags.v || command === "version") {
    console.log(pkg.version);
    return 0;
  }
  if (flags.help || flags.h || command === "help") {
    console.log(HELP);
    return 0;
  }
  if (!command) {
    console.log(HELP);
    return 1;
  }

  setVerbose(Boolean(flags.verbose));
  const repoRoot = resolve(positionals[0] ?? ".");
  const model = typeof flags.model === "string" ? flags.model : undefined;

  try {
    switch (command) {
      case "init":
        return await initCommand(repoRoot, {
          dryRun: Boolean(flags["dry-run"]),
          ...(model ? { model } : {}),
          yes: Boolean(flags.yes),
          verbose: Boolean(flags.verbose),
          skipAgent: Boolean(flags["skip-agent"]),
          force: Boolean(flags.force),
        });
      case "update":
        return await updateCommand(repoRoot, {
          dryRun: Boolean(flags["dry-run"]),
          diff: Boolean(flags.diff),
          ...(model ? { model } : {}),
          verbose: Boolean(flags.verbose),
          skipAgent: Boolean(flags["skip-agent"]),
        });
      case "eval": {
        // Default to the full agentic, harness-on dynamic eval; `--static` for the fast no-model audit.
        const mode = flags.static ? "static" : "dynamic";
        return await evalCommand(repoRoot, {
          mode,
          json: Boolean(flags.json),
          rubric: Boolean(flags.rubric),
          ...(model ? { model } : {}),
          ...(typeof flags["producer-model"] === "string" ? { producerModel: flags["producer-model"] } : {}),
          ...(typeof flags["judge-model"] === "string" ? { judgeModel: flags["judge-model"] } : {}),
          ...(flags["allow-same-family"] ? { allowSameFamily: true } : {}),
          ...(flags.n != null ? { trials: Number(flags.n) } : {}),
          ...(flags.seed != null ? { seed: Number(flags.seed) } : {}),
          ...(flags.min != null ? { min: Number(flags.min) } : {}),
          ...(typeof flags.scenario === "string" ? { scenario: flags.scenario } : {}),
          ...(typeof flags.variant === "string" ? { variant: flags.variant } : {}),
          ...(flags.timeout != null ? { timeoutMinutes: Number(flags.timeout) } : {}),
          verbose: Boolean(flags.verbose),
        });
      }
      case "doctor":
        return await doctorCommand(repoRoot, { json: Boolean(flags.json) });
      case "compile":
        return compileCommand(repoRoot, { json: Boolean(flags.json) });
      case "dashboard":
        return dashboardCommand(repoRoot, {
          json: Boolean(flags.json),
          noTasks: Boolean(flags["no-tasks"]),
          ...(flags.html != null ? { html: flags.html } : {}),
        });
      default:
        log.error(`Unknown command: ${command}`);
        console.log(`\n${HELP}`);
        return 1;
    }
  } catch (err) {
    log.error((err as Error).message);
    if (flags.verbose) console.error(err);
    return 1;
  }
}

// Setting process.exitCode (instead of calling process.exit immediately) lets pending
// stdout writes drain when output is piped to another process — required because the
// JSON audit report can exceed the macOS pipe buffer and would otherwise be truncated.
main().then((code) => {
  process.exitCode = code;
});
