#!/usr/bin/env node
// AgentRig static harness audit (principle 6) — deterministic, dependency-free, no model.
// Interprets checks.json (the single source of truth, shared with `agentrig eval --static`)
// against this repository and prints a Harness Score. Usage:
//   node .agentrig/eval/static-audit.mjs            human-readable report
//   node .agentrig/eval/static-audit.mjs --json     machine-readable
//   node .agentrig/eval/static-audit.mjs --min 80   exit non-zero if score < 80%
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..", "..");
const checksPath = join(scriptDir, "checks.json");

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const minIdx = args.indexOf("--min");
const minPct = minIdx >= 0 ? Number(args[minIdx + 1]) : null;

const rel = (p) => resolve(repoRoot, p);
const read = (p) => (existsSync(rel(p)) ? readFileSync(rel(p), "utf8") : null);

function frontmatter(text) {
  if (!text || !text.startsWith("---")) return null;
  const end = text.indexOf("\n---", 3);
  if (end < 0) return null;
  return text.slice(3, end);
}
function extractValue(text, key) {
  if (!text) return null;
  const m = text.match(new RegExp("^\\s*" + key + "\\s*:\\s*(.+)\\s*$", "m"));
  return m ? m[1].trim() : null;
}

function scoreCheck(c) {
  switch (c.type) {
    case "path-exists":
      return { score: existsSync(rel(c.path)) ? 1 : 0, evidence: existsSync(rel(c.path)) ? "" : `missing ${c.path}` };
    case "file-contains": {
      const text = read(c.path);
      if (text == null) return { score: 0, evidence: `missing ${c.path}` };
      const missing = (c.patterns || []).filter((p) => !text.includes(p));
      if (missing.length === 0) return { score: 1, evidence: "" };
      return { score: 0.5, evidence: `present but missing markers: ${missing.join(", ")}` };
    }
    case "dir-min": {
      const abs = rel(c.path);
      if (!existsSync(abs) || !statSync(abs).isDirectory()) return { score: 0, evidence: `missing dir ${c.path}` };
      const n = readdirSync(abs).filter((e) => !e.startsWith(".")).length;
      if (n >= (c.min || 1)) return { score: 1, evidence: "" };
      return { score: 0.5, evidence: `${n} entr${n === 1 ? "y" : "ies"}, need ${c.min}` };
    }
    case "frontmatter-keys": {
      const fm = frontmatter(read(c.path));
      if (fm == null) return { score: 0, evidence: `no frontmatter in ${c.path}` };
      const missing = (c.keys || []).filter((k) => !new RegExp("^\\s*" + k + "\\s*:", "m").test(fm));
      if (missing.length === 0) return { score: 1, evidence: "" };
      return { score: 0.5, evidence: `missing keys: ${missing.join(", ")}` };
    }
    case "roles-distinct-models": {
      const dev = extractValue(read(c.developer), c.key || "model");
      const rev = extractValue(read(c.reviewer), c.key || "model");
      if (!dev || !rev) return { score: 0, evidence: "developer/reviewer model not declared" };
      if (dev !== rev) return { score: 1, evidence: "" };
      return { score: 0.5, evidence: `developer and reviewer share model "${dev}"` };
    }
    default:
      return { score: 0, evidence: `unknown check type ${c.type}` };
  }
}

if (!existsSync(checksPath)) {
  console.error(`checks.json not found at ${checksPath}`);
  process.exit(2);
}
const { checks } = JSON.parse(readFileSync(checksPath, "utf8"));
const results = checks.map((c) => ({ ...c, ...scoreCheck(c) }));

let wSum = 0, wScore = 0;
const byPrinciple = new Map();
for (const r of results) {
  const w = r.weight ?? 1;
  wSum += w;
  wScore += w * r.score;
  const p = byPrinciple.get(r.principle) || { sum: 0, n: 0 };
  p.sum += r.score; p.n += 1;
  byPrinciple.set(r.principle, p);
}
const aggregate = wSum ? wScore / wSum : 0;
const pct = Math.round(aggregate * 1000) / 10;

if (asJson) {
  console.log(JSON.stringify({
    harnessScore: pct,
    aggregate,
    principles: [...byPrinciple.entries()].sort((a, b) => a[0] - b[0]).map(([principle, v]) => ({ principle, score: v.sum / v.n })),
    checks: results.map((r) => ({ id: r.id, principle: r.principle, title: r.title, score: r.score, evidence: r.evidence })),
  }, null, 2));
} else {
  console.log("AgentRig — harness audit\n");
  for (const r of results.sort((a, b) => a.principle - b.principle || a.id.localeCompare(b.id))) {
    const tag = r.score === 1 ? "PASS" : r.score === 0.5 ? "PART" : "FAIL";
    console.log(`  [${tag}] P${r.principle} ${r.title}` + (r.evidence ? `\n         ↳ ${r.evidence}` : ""));
  }
  console.log(`\n  Harness Score: ${pct}%  (${results.filter((r) => r.score === 1).length}/${results.length} checks full credit)`);
}

if (minPct != null && pct < minPct) {
  if (!asJson) console.error(`\nHarness Score ${pct}% is below required ${minPct}%`);
  process.exit(1);
}
