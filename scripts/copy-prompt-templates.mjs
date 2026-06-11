#!/usr/bin/env node
// Copies the prompt-template markdown files from src/ into the build output so the compiled CLI can
// read them at runtime. `tsc` only emits .ts -> .js, so the .md templates next to the prompt loader
// need to be copied explicitly. Run as part of `npm run build` (after tsc).
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const src = resolve(repoRoot, "src", "prompts", "templates");
const dest = resolve(repoRoot, "dist", "prompts", "templates");

if (!existsSync(src)) {
  console.error(`[copy-prompt-templates] source directory missing: ${src}`);
  process.exit(1);
}

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`[copy-prompt-templates] ${src} -> ${dest}`);
