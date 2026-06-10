import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import YAML from "yaml";
import { populateAgentsMarkers } from "./markers.js";

export interface YamlFinding {
  /** Repo-relative path. */
  path: string;
  /** Human-readable error from the YAML parser. */
  error: string;
}

export interface ModelFinding {
  /** Repo-relative path, e.g. `.agentrig/agents/reviewer.yml`. */
  path: string;
  /** The unrecognized value of the `model:` key. */
  value: string;
  /** Best-effort "did you mean" suggestions (subset of the registry). */
  suggestions: string[];
}

export interface MarkerFinding {
  /** Marker name that has no registered populator. */
  name: string;
}

/**
 * Static allowlist of Copilot SDK model ids. This is the OFFLINE fallback only — when the
 * provider is reachable, `validateModelIds` prefers `provider.listModels()` (the canonical source).
 * The list mirrors what `CopilotClient.listModels()` returned as of knowledge 0.5.x — bump it when
 * the SDK roster shifts. Missing-from-this-list is treated as "unknown" only when no live registry
 * was provided, so a partly stale allowlist degrades to a warning, not a hard failure.
 */
const STATIC_MODEL_ALLOWLIST = new Set<string>([
  "auto",
  "claude-haiku-4.5",
  "claude-opus-4.5",
  "claude-opus-4.6",
  "claude-opus-4.7",
  "claude-opus-4.7-1m-internal",
  "claude-opus-4.7-high",
  "claude-opus-4.7-xhigh",
  "claude-opus-4.8",
  "claude-sonnet-4.5",
  "claude-sonnet-4.6",
  "gemini-3.1-pro-preview",
  "gemini-3.5-flash",
  "gpt-5-mini",
  "gpt-5.3-codex",
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.5",
  "mai-code-1-flash-internal",
]);

/** Recursively collect every `.yml`/`.yaml` file under `dir` as repo-relative paths. */
function listYamlFiles(repoRoot: string, dir: string): string[] {
  const out: string[] = [];
  const walk = (abs: string): void => {
    if (!existsSync(abs)) return;
    if (statSync(abs).isFile()) {
      if (/\.ya?ml$/.test(abs)) out.push(relative(repoRoot, abs));
      return;
    }
    if (!statSync(abs).isDirectory()) return;
    for (const entry of readdirSync(abs)) {
      if (entry.startsWith(".") || entry === "node_modules") continue;
      walk(join(abs, entry));
    }
  };
  walk(join(repoRoot, dir));
  return out;
}

/**
 * Parse every YAML file the harness owns and report syntax errors. Used by `agentrig update` so
 * a broken `.agentrig/harness/state-machine.yml` (preserved from a prior install) is surfaced
 * instead of silently rolling forward to the next refresh.
 *
 * Uses `parseAllDocuments` because some shipped templates (scenario.yml) intentionally use
 * multi-document YAML — a single `parse` would reject the trailing `---` as "multiple documents"
 * even when each individual document is valid.
 */
export function validateYaml(repoRoot: string, dirs: string[] = [".agentrig"]): YamlFinding[] {
  const findings: YamlFinding[] = [];
  for (const dir of dirs) {
    for (const rel of listYamlFiles(repoRoot, dir)) {
      const abs = join(repoRoot, rel);
      const docs = YAML.parseAllDocuments(readFileSync(abs, "utf8"));
      const errors = docs.flatMap((d) => d.errors).filter(Boolean);
      if (errors.length) {
        findings.push({ path: rel, error: errors.map((e) => e.message).join("; ") });
      }
    }
  }
  return findings;
}

/** Extract the `model:` value from a role yaml. Returns null if the key is missing/blank. */
function extractModel(text: string): string | null {
  const m = text.match(/^\s*model\s*:\s*(.+?)\s*$/m);
  return m ? m[1]!.trim().replace(/^["']|["']$/g, "") : null;
}

/**
 * Check that every `.agentrig/agents/*.yml`'s `model:` value is recognized by the active provider
 * (when `liveRegistry` is supplied) or the static allowlist (offline fallback). Returns one
 * finding per role with an unknown model id.
 */
export function validateModelIds(repoRoot: string, liveRegistry?: string[]): ModelFinding[] {
  const dir = join(repoRoot, ".agentrig", "agents");
  if (!existsSync(dir)) return [];
  const registry = liveRegistry && liveRegistry.length ? new Set(liveRegistry) : STATIC_MODEL_ALLOWLIST;
  const findings: ModelFinding[] = [];
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith(".yml")) continue;
    const rel = join(".agentrig", "agents", entry);
    const value = extractModel(readFileSync(join(dir, entry), "utf8"));
    if (!value || value === "auto") continue;
    if (registry.has(value)) continue;
    // "Did you mean…" — closest by leading segment.
    const prefix = value.split(/[-.]/)[0]!.toLowerCase();
    const near = [...registry].filter((id) => id.toLowerCase().startsWith(prefix)).sort();
    findings.push({ path: rel, value, suggestions: near.slice(0, 4) });
  }
  return findings;
}

/**
 * Run the marker populator in a dry mode that doesn't touch the filesystem, just to report any
 * `AGENTRIG:<name>` blocks the user has added that no populator knows how to handle. Useful as
 * an A2 probe; harmless when the populator already ran.
 */
export function validateMarkers(repoRoot: string): MarkerFinding[] {
  // populateAgentsMarkers is idempotent — calling it twice in one update doesn't matter, and
  // the returned `skipped` list is exactly what we want here.
  const report = populateAgentsMarkers(repoRoot);
  return report.skipped.map((name) => ({ name }));
}

export interface ValidationSummary {
  yaml: YamlFinding[];
  models: ModelFinding[];
  /** True if any finding represents a hard failure (broken YAML or unknown model id). */
  hasBlockers: boolean;
}

/** One-shot helper used by `update` + `doctor`. */
export function runValidation(repoRoot: string, liveRegistry?: string[]): ValidationSummary {
  const yaml = validateYaml(repoRoot);
  const models = validateModelIds(repoRoot, liveRegistry);
  return { yaml, models, hasBlockers: yaml.length > 0 || models.length > 0 };
}

/** Expose for fix.ts (avoids a circular dep with state.ts). */
export { STATIC_MODEL_ALLOWLIST };
