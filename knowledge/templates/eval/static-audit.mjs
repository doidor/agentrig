#!/usr/bin/env node
// AgentRig static harness audit (principle 6) — deterministic, dependency-free, no model.
// Interprets checks.json (the single source of truth, shared with `agentrig eval --static`)
// against this repository and prints an Install Completeness + Quality Probes report. Usage:
//   node .agentrig/eval/static-audit.mjs            human-readable report
//   node .agentrig/eval/static-audit.mjs --json     machine-readable
//   node .agentrig/eval/static-audit.mjs --min 80   exit non-zero if completeness < 80%
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

// Mirror of src/core/model-family.ts. Kept inline to keep this script dep-free.
const FAMILY_PATTERNS = [
  ["anthropic-claude", /^(anthropic[\.\/-])?claude([-_\.]|$)/i],
  ["openai-gpt", /^(openai[\.\/-])?(gpt|o[1-9]|codex|davinci|chatgpt)([-_\.]|$)/i],
  ["google-gemini", /^(google[\.\/-])?(gemini|palm|bard|flash)([-_\.]|$)/i],
  ["mistral", /^(mistral|mixtral|codestral|ministral)([-_\.]|$)/i],
  ["deepseek", /^deepseek([-_\.]|$)/i],
  ["meta-llama", /^(meta[\.\/-])?(llama|code-?llama)([-_\.]|$)/i],
  ["xai-grok", /^(xai[\.\/-])?grok([-_\.]|$)/i],
  ["cohere", /^(cohere[\.\/-])?(command|aya)([-_\.]|$)/i],
  ["qwen", /^qwen([-_\.]|$)/i],
];
function modelFamily(id) {
  if (!id) return "";
  for (const [name, rx] of FAMILY_PATTERNS) if (rx.test(id)) return name;
  const m = id.match(/^([a-z0-9]+)/i);
  return m ? `unknown:${m[1].toLowerCase()}` : `unknown:${id}`;
}

// Line-oriented mini-YAML reader good enough for state-machine.yml.
function readStateMachine(text) {
  if (!text) return { states: [], transitions: [] };
  const states = [];
  const transitions = [];
  let inStates = false;
  let inTransitions = false;
  for (const raw of text.split(/\r?\n/)) {
    if (/^states:\s*$/.test(raw)) { inStates = true; inTransitions = false; continue; }
    if (/^transitions:\s*$/.test(raw)) { inTransitions = true; inStates = false; continue; }
    if (/^\S/.test(raw)) { inStates = false; inTransitions = false; continue; }
    const line = raw.replace(/#.*$/, "").trimEnd();
    if (!line.trim().startsWith("-")) continue;
    if (inStates) {
      const m = line.match(/-\s*name:\s*(\S+)/);
      if (m) states.push(m[1]);
    } else if (inTransitions) {
      // Accept both legacy ("- from: A to: B trigger: ...") and proper flow-mapping
      // ("- { from: A, to: B, trigger: ... }") syntaxes.
      const item = line.replace(/^\s*-\s*/, "").replace(/^\{|\}$/g, "");
      const get = (k) => (item.match(new RegExp("\\b" + k + ":\\s*([^,\\s}]+)")) || [])[1];
      const from = get("from"), to = get("to"), trigger = get("trigger");
      if (from && to) transitions.push({ from, to, trigger });
    }
  }
  return { states, transitions };
}
function hasPath(adj, src, dst) {
  if (src === dst) return true;
  const seen = new Set([src]);
  const q = [src];
  while (q.length) {
    const cur = q.shift();
    for (const n of adj.get(cur) || []) {
      if (n === dst) return true;
      if (!seen.has(n)) { seen.add(n); q.push(n); }
    }
  }
  return false;
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
    case "frontmatter-keys-all": {
      const dir = c.path, fileName = c.file || "SKILL.md";
      const abs = rel(dir);
      if (!existsSync(abs) || !statSync(abs).isDirectory()) return { score: 0, evidence: `missing dir ${dir}` };
      const keys = c.keys || [];
      const offenders = [];
      for (const entry of readdirSync(abs)) {
        if (entry.startsWith(".") || entry.startsWith("_")) continue;
        const subAbs = join(abs, entry);
        if (!statSync(subAbs).isDirectory()) continue;
        const filePath = join(subAbs, fileName);
        if (!existsSync(filePath)) { offenders.push(`${entry}/${fileName} missing`); continue; }
        const fm = frontmatter(readFileSync(filePath, "utf8"));
        if (fm == null) { offenders.push(`${entry} no frontmatter`); continue; }
        const missing = keys.filter((k) => !new RegExp("^\\s*" + k + "\\s*:", "m").test(fm));
        if (missing.length) offenders.push(`${entry} missing ${missing.join("/")}`);
      }
      return offenders.length === 0 ? { score: 1, evidence: "" } : { score: 0.5, evidence: offenders.join("; ") };
    }
    case "roles-distinct-models": {
      const dev = extractValue(read(c.developer), c.key || "model");
      const rev = extractValue(read(c.reviewer), c.key || "model");
      if (!dev || !rev) return { score: 0, evidence: "developer/reviewer model not declared" };
      if (dev !== rev) return { score: 1, evidence: "" };
      return { score: 0.5, evidence: `developer and reviewer share model "${dev}"` };
    }
    case "roles-distinct-families": {
      const dev = extractValue(read(c.developer), c.key || "model");
      const rev = extractValue(read(c.reviewer), c.key || "model");
      if (!dev || !rev) return { score: 0, evidence: "developer/reviewer model not declared" };
      const sameFamily = modelFamily(dev) === modelFamily(rev);
      if (!sameFamily) return { score: 1, evidence: "" };
      return { score: 0, evidence: `developer "${dev}" and reviewer "${rev}" share a model family` };
    }
    case "state-machine-dag": {
      const text = read(c.path);
      if (text == null) return { score: 0, evidence: `missing ${c.path}` };
      const { states, transitions } = readStateMachine(text);
      const minStates = c.minStates ?? 6;
      const requirePath = c.requirePath || "queued->merged";
      const problems = [];
      if (states.length < minStates) problems.push(`${states.length} states, need ≥${minStates}`);
      const stateSet = new Set(states);
      const adj = new Map();
      for (const t of transitions) {
        if (t.from === "any") {
          for (const s of stateSet) {
            if (!adj.has(s)) adj.set(s, new Set());
            adj.get(s).add(t.to);
          }
        } else {
          if (!adj.has(t.from)) adj.set(t.from, new Set());
          adj.get(t.from).add(t.to);
        }
      }
      const [src, dst] = requirePath.split("->");
      if (src && dst && !hasPath(adj, src, dst)) problems.push(`no path ${src}→${dst}`);
      return problems.length === 0 ? { score: 1, evidence: "" } : { score: 0.5, evidence: problems.join("; ") };
    }
    case "marker-populated": {
      // Mirror of src/core/audit.ts: assert AGENTRIG:<name> block in `path` is populated.
      const p = c.path, name = c.marker || "";
      const text = read(p);
      if (text == null) return { score: 0, evidence: `missing ${p}` };
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pair = new RegExp(`<!--\\s*AGENTRIG:${esc}:start\\s*-->([\\s\\S]*?)<!--\\s*AGENTRIG:${esc}:end\\s*-->`);
      const m = text.match(pair);
      if (!m) return { score: 0, evidence: `marker pair AGENTRIG:${name} missing from ${p}` };
      const body = m[1].trim();
      if (!body || /\{\{[A-Z_]+\}\}/.test(body)) {
        return { score: 0, evidence: `AGENTRIG:${name} block is empty or has unfilled placeholders` };
      }
      const enumerateDir = c.enumerateDir;
      if (enumerateDir) {
        const abs = rel(enumerateDir);
        if (!existsSync(abs) || !statSync(abs).isDirectory()) return { score: 1, evidence: "" };
        const required = readdirSync(abs).filter((e) => !e.startsWith(".") && !e.startsWith("_"));
        const missing = required.filter((entry) => !body.includes(entry));
        if (missing.length === 0) return { score: 1, evidence: "" };
        return { score: 0.5, evidence: `block missing entries from ${enumerateDir}: ${missing.join(", ")}` };
      }
      return { score: 1, evidence: "" };
    }
    case "quality-probe": {
      const probe = c.probe, p = c.path;
      if (probe === "no-unfilled-placeholders") {
        const text = read(p);
        if (text == null) return { score: 0, evidence: `missing ${p}` };
        // Strip code blocks + inline code so we don't false-positive on docs that *describe*
        // placeholder syntax (e.g. "{{VAR}} substitution" in an architecture overview).
        const stripped = text
          .replace(/```[\s\S]*?```/g, "")
          .replace(/`[^`\n]*`/g, "");
        const tokens = stripped.match(/\{\{[A-Z_]+\}\}/g) || [];
        return tokens.length === 0
          ? { score: 1, evidence: "" }
          : { score: 0, evidence: `unfilled tokens in ${p}: ${[...new Set(tokens)].join(", ")}` };
      }
      if (probe === "axes-json-coherent") {
        const text = read(p);
        if (text == null) return { score: 0, evidence: `missing ${p}` };
        let j;
        try { j = JSON.parse(text); } catch (e) { return { score: 0, evidence: `${p} not valid JSON: ${e.message}` }; }
        if (!j.types) return { score: 0, evidence: `${p} missing "types"` };
        const issues = [];
        for (const [tname, t] of Object.entries(j.types)) {
          if (!t.categories) { issues.push(`${tname}: no categories`); continue; }
          for (const [cname, cat] of Object.entries(t.categories)) {
            for (const [axis, spec] of Object.entries(cat)) {
              // Both shapes: v1 = ["CODE",...]; v2 = { codes: [...], weight, veto }
              const codes = Array.isArray(spec) ? spec : spec && spec.codes;
              if (!Array.isArray(codes) || codes.length === 0) issues.push(`${tname}/${cname}/${axis}: no issue codes`);
            }
          }
        }
        return issues.length === 0 ? { score: 1, evidence: "" } : { score: 0.5, evidence: issues.join("; ") };
      }
      if (probe === "checks-json-coherent") {
        const text = read(p);
        if (text == null) return { score: 0, evidence: `missing ${p}` };
        let j;
        try { j = JSON.parse(text); } catch (e) { return { score: 0, evidence: `${p} not valid JSON: ${e.message}` }; }
        const checks = j.checks || [];
        const known = new Set(["path-exists","file-contains","dir-min","frontmatter-keys","frontmatter-keys-all","roles-distinct-models","roles-distinct-families","state-machine-dag","quality-probe","marker-populated"]);
        const ids = checks.map((x) => x.id);
        const dupIds = ids.filter((id, i) => id && ids.indexOf(id) !== i);
        const badTypes = checks.filter((x) => !known.has(x.type));
        const issues = [];
        if (dupIds.length) issues.push(`duplicate ids: ${[...new Set(dupIds)].join(", ")}`);
        if (badTypes.length) issues.push(`unknown check types: ${badTypes.map((x) => x.type).join(", ")}`);
        return issues.length === 0 ? { score: 1, evidence: "" } : { score: 0.5, evidence: issues.join("; ") };
      }
      if (probe === "context-md-present") {
        return existsSync(rel(p))
          ? { score: 1, evidence: "" }
          : { score: 0.5, evidence: `${p} missing — run \`agentrig init\` to investigate the repo` };
      }
      return { score: 0, evidence: `unknown quality probe "${probe}"` };
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
const results = checks.map((c) => ({ ...c, ...scoreCheck(c), layer: c.layer === "quality" ? "quality" : "completeness" }));

let cwSum = 0, cwScore = 0, qwSum = 0, qwScore = 0;
const byPrinciple = new Map();
for (const r of results) {
  const w = r.weight ?? 1;
  if (r.layer === "quality") { qwSum += w; qwScore += w * r.score; }
  else { cwSum += w; cwScore += w * r.score; }
  const p = byPrinciple.get(r.principle) || { sum: 0, n: 0 };
  p.sum += r.score; p.n += 1;
  byPrinciple.set(r.principle, p);
}
const completenessAgg = cwSum ? cwScore / cwSum : 0;
const qualityAgg = qwSum ? qwScore / qwSum : 0;
const pct = Math.round(completenessAgg * 1000) / 10;
const qpct = Math.round(qualityAgg * 1000) / 10;

if (asJson) {
  console.log(JSON.stringify({
    installCompleteness: pct,
    qualityProbes: qpct,
    aggregate: completenessAgg,
    qualityAggregate: qualityAgg,
    principles: [...byPrinciple.entries()].sort((a, b) => a[0] - b[0]).map(([principle, v]) => ({ principle, score: v.sum / v.n })),
    checks: results.map((r) => ({ id: r.id, principle: r.principle, layer: r.layer, title: r.title, score: r.score, evidence: r.evidence })),
  }, null, 2));
} else {
  console.log("AgentRig — install completeness audit\n");
  const completeness = results.filter((r) => r.layer === "completeness").sort((a, b) => a.principle - b.principle || a.id.localeCompare(b.id));
  const quality = results.filter((r) => r.layer === "quality").sort((a, b) => a.principle - b.principle || a.id.localeCompare(b.id));
  if (completeness.length) {
    console.log("  Layer A1 — structural completeness");
    for (const r of completeness) {
      const tag = r.score === 1 ? "PASS" : r.score === 0.5 ? "PART" : "FAIL";
      console.log(`  [${tag}] P${r.principle} ${r.title}` + (r.evidence ? `\n         ↳ ${r.evidence}` : ""));
    }
  }
  if (quality.length) {
    console.log("\n  Layer A2 — quality probes");
    for (const r of quality) {
      const tag = r.score === 1 ? "PASS" : r.score === 0.5 ? "PART" : "FAIL";
      console.log(`  [${tag}] P${r.principle} ${r.title}` + (r.evidence ? `\n         ↳ ${r.evidence}` : ""));
    }
  }
  console.log(`\n  Install Completeness: ${pct}%  (${completeness.filter((r) => r.score === 1).length}/${completeness.length} checks full credit)`);
  if (quality.length) {
    console.log(`  Quality Probes:       ${qpct}%  (${quality.filter((r) => r.score === 1).length}/${quality.length} checks full credit)`);
  }
}

if (minPct != null && pct < minPct) {
  if (!asJson) console.error(`\nInstall Completeness ${pct}% is below required ${minPct}%`);
  process.exit(1);
}
