import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const moduleDir = dirname(fileURLToPath(import.meta.url));

/**
 * Locate the packaged `knowledge/` directory. Works both from the compiled output
 * (`dist/core/paths.js`) and from a few fallback layouts so the CLI keeps working if the build
 * structure changes.
 */
export function knowledgeRoot(): string {
  const candidates = [
    resolve(moduleDir, "..", "..", "knowledge"), // dist/core/paths.js -> packageRoot/knowledge
    resolve(moduleDir, "..", "..", "..", "knowledge"),
    resolve(process.cwd(), "knowledge"),
  ];
  for (const candidate of candidates) {
    if (existsSync(resolve(candidate, "manifest.json"))) return candidate;
  }
  throw new Error(
    "Could not locate AgentRig's knowledge/ directory. Is the package installed correctly?",
  );
}
