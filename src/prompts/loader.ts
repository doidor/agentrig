import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const moduleDir = dirname(fileURLToPath(import.meta.url));

/**
 * Locate the prompt-template directory. In a built/published package the `.md` templates are
 * copied next to the compiled loader (`dist/prompts/templates/`) by `scripts/copy-prompt-templates.mjs`.
 * The source-tree fallback keeps the CLI working in development when a bare `tsc --watch` hasn't run
 * the copy step yet.
 */
function templatesDir(): string {
  const candidates = [
    resolve(moduleDir, "templates"), // dist/prompts/templates (built) or src/prompts/templates
    resolve(moduleDir, "..", "..", "src", "prompts", "templates"), // dist/prompts -> src fallback
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    "AgentRig: could not locate the prompts/templates directory. Is the package built correctly?",
  );
}

const cache = new Map<string, string>();

/**
 * Load a prompt template by file name. A single trailing newline is stripped so callers fully
 * control the trailing whitespace of the assembled prompt (templates are stored with one trailing
 * newline by convention). Results are cached since templates never change at runtime.
 */
export function loadTemplate(name: string): string {
  const cached = cache.get(name);
  if (cached !== undefined) return cached;
  const text = readFileSync(resolve(templatesDir(), name), "utf8").replace(/\n$/, "");
  cache.set(name, text);
  return text;
}
