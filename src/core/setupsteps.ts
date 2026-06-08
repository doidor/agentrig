import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export interface SetupStepsValidation {
  present: boolean;
  ok: boolean;
  errors: string[];
  warnings: string[];
  checkedWith: string[];
}

const SETUP_REL = ".github/workflows/copilot-setup-steps.yml";

// Job-level keys Copilot honors; anything else under the job is silently ignored.
const ALLOWED_JOB_KEYS = new Set(["runs-on", "permissions", "services", "snapshot", "timeout-minutes", "steps"]);

/**
 * Validate `.github/workflows/copilot-setup-steps.yml` so a generated/authored file isn't broken.
 * Structural checks always run (no deps); a real YAML parse and `actionlint` are used when available.
 */
export function validateSetupSteps(repoRoot: string): SetupStepsValidation {
  const abs = join(repoRoot, SETUP_REL);
  const res: SetupStepsValidation = { present: false, ok: true, errors: [], warnings: [], checkedWith: ["structure"] };
  if (!existsSync(abs)) return res;
  res.present = true;
  const text = readFileSync(abs, "utf8");
  const lines = text.split("\n");

  if (text.includes("\t")) res.errors.push("contains a tab character (YAML forbids tabs for indentation)");
  if (!/^\s*jobs\s*:/m.test(text)) res.errors.push("missing a `jobs:` block");
  if (!/^\s*copilot-setup-steps\s*:/m.test(text)) {
    res.errors.push("the job MUST be named exactly `copilot-setup-steps` or Copilot ignores it");
  }
  if (!/^\s*runs-on\s*:/m.test(text)) res.errors.push("the job needs a `runs-on:`");
  if (!/^\s*steps\s*:/m.test(text)) res.warnings.push("no `steps:` — Copilot will only checkout; nothing gets preinstalled");

  const timeout = text.match(/^\s*timeout-minutes\s*:\s*(\d+)/m);
  if (timeout && Number(timeout[1]) > 59) res.errors.push(`timeout-minutes is ${timeout[1]}; the max is 59`);

  // Detect job-level keys that Copilot ignores (best-effort: keys at the job's child indent).
  const jobLine = lines.findIndex((l) => /^\s*copilot-setup-steps\s*:/.test(l));
  if (jobLine >= 0) {
    const jobIndent = lines[jobLine]!.search(/\S/);
    for (let i = jobLine + 1; i < lines.length; i++) {
      const l = lines[i]!;
      if (l.trim() === "" || l.trim().startsWith("#")) continue;
      const indent = l.search(/\S/);
      if (indent <= jobIndent) break; // left the job block
      const m = l.match(/^\s*([a-zA-Z0-9_-]+)\s*:/);
      if (m && indent === jobIndent + 2 && !ALLOWED_JOB_KEYS.has(m[1]!)) {
        res.warnings.push(`job key \`${m[1]}\` is ignored by Copilot (only ${[...ALLOWED_JOB_KEYS].join(", ")} are honored)`);
      }
    }
  }

  // Real YAML parse if python3 + pyyaml are available.
  const py = spawnSync("python3", ["-c", "import yaml,sys; yaml.safe_load(open(sys.argv[1]))", abs], { encoding: "utf8" });
  if (py.status === 0) res.checkedWith.push("yaml");
  else if (py.status != null && /yaml\.|YAMLError|ScannerError|ParserError/.test(py.stderr || "")) {
    res.errors.push(`invalid YAML: ${(py.stderr || "").trim().split("\n").pop()}`);
    res.checkedWith.push("yaml");
  }

  // actionlint if installed.
  const al = spawnSync("actionlint", ["-no-color", abs], { encoding: "utf8" });
  if (al.status === 0) res.checkedWith.push("actionlint");
  else if (al.status != null && al.status !== 127 && (al.stdout || al.stderr)) {
    for (const line of (al.stdout || al.stderr).trim().split("\n").slice(0, 8)) {
      if (line.trim()) res.warnings.push(`actionlint: ${line.trim()}`);
    }
    res.checkedWith.push("actionlint");
  }

  res.ok = res.errors.length === 0;
  return res;
}
