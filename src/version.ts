import { readText } from "./core/fsutil.js";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const moduleDir = dirname(fileURLToPath(import.meta.url));

function loadVersion(): string {
  for (const candidate of [
    resolve(moduleDir, "..", "package.json"),
    resolve(moduleDir, "..", "..", "package.json"),
  ]) {
    const text = readText(candidate);
    if (text) {
      try {
        const json = JSON.parse(text) as { name?: string; version?: string };
        if (json.name === "agentrig" && json.version) return json.version;
      } catch {
        /* ignore */
      }
    }
  }
  return "0.0.0";
}

export default { version: loadVersion() };
