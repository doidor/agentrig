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
  init [path]      Investigate the repo and install a best-practice agent harness
  update [path]    Re-sync the latest best practices into an existing harness
                     --diff     show how your preserved files differ from canonical
  compile [path]   Project AGENTS.md + rules into every agent surface (local + remote):
                   copilot-instructions, .github/instructions, CLAUDE.md, .cursor/rules,
                   MCP, and copilot-setup-steps.yml
  eval [path]      Evaluate the harness itself
                     --static   (default) deterministic structural audit, no model
                     --dynamic  run benchmark scenarios via the agent + judge
                     --scenario <id>   run one scenario only (e.g. fix-failing-test)
                     --variant <name>  label this run (use 'baseline' for a harness-OFF trial)
                     --timeout <min>   absolute cap per agent turn (default 45)
  doctor [path]    Quick health check (installed? agent reachable? score?)
  dashboard [path] Show agent roster, live GitHub tasks, harness score, and evals
                     --html [file]  write a self-contained HTML dashboard
                     --no-tasks     skip live GitHub lookups (offline)

${color.bold("Options:")}
  --model <id>     Model to use for agentic steps (e.g. claude-sonnet-4.5, gpt-5)
  --dry-run        Show what would happen without writing or calling the model
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
        const mode = flags.dynamic ? "dynamic" : "static";
        return await evalCommand(repoRoot, {
          mode,
          json: Boolean(flags.json),
          ...(model ? { model } : {}),
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

main().then((code) => process.exit(code));
