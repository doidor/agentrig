#!/usr/bin/env node
// Audit drift check (dependency-free, Node stdlib only).
//
// Mirrors AgentRig's Critical Rule 2 (from AGENTS.md): every artifact
// declared in `knowledge/manifest.json` must have a matching check entry in
// `knowledge/templates/eval/checks.json`, or the real static audit will
// silently ignore it. This script cross-references the two files and exits
// non-zero on drift.
//
// Run with `npm test` (or `node audit.mjs`).
import { readFileSync, existsSync } from "node:fs";

function loadJson(path) {
  if (!existsSync(path)) {
    console.error(`audit: required file missing: ${path}`);
    process.exit(2);
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    console.error(`audit: ${path} is not valid JSON: ${e.message}`);
    process.exit(2);
  }
}

const manifest = loadJson("knowledge/manifest.json");
const checks = loadJson("knowledge/templates/eval/checks.json");

const checkPaths = new Set(
  (checks.checks || [])
    .map((c) => (c && typeof c.path === "string" ? c.path : null))
    .filter(Boolean),
);

const missing = [];
for (const art of manifest.artifacts || []) {
  if (!art || typeof art.dest !== "string") continue;
  if (!checkPaths.has(art.dest)) missing.push(art);
}

if (missing.length === 0) {
  const n = (manifest.artifacts || []).length;
  console.log(`audit ok — all ${n} manifest artifact(s) have a matching check in checks.json`);
  process.exit(0);
}

console.error("audit drift detected — these manifest artifacts have NO matching check in checks.json:");
for (const m of missing) {
  console.error(`  - dest "${m.dest}"  (src: ${m.src ?? "?"})`);
}
console.error("");
console.error("Fix: add a `path-exists` check entry for each missing artifact to");
console.error("     knowledge/templates/eval/checks.json — mirror the schema of");
console.error("     the existing entries (id, type, path, principle, layer, weight).");
process.exit(1);
