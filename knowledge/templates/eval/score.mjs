#!/usr/bin/env node
// AgentRig dynamic-eval aggregator (principle 6). Owns the results JSON shape and VALIDATES every
// score against the rubric registry in axes.json — so results are never hand-edited and a judge
// cannot invent axes, tiers, or issue codes. Inspired by epichan's pydantic-validated scoring.
//
// Usage:
//   node score.mjs save --type run --task add-small-feature --scenario add-small-feature \
//        --judge claude-opus-4.8 [--variant v1] [--run RID] \
//        --axis 'correctness=1.0' \
//        --axis 'scope=0.5:OQ-SCOPE-CHURN:left package-lock.json churn in the diff' \
//        --axis 'tests=na'                 # na = unobserved (confidence 0, excluded from rollups)
//   node score.mjs report [--type run] [--variant v1] [--json]
//   node score.mjs compare --scenario add-small-feature   # A/B variants side by side
//
// Score tiers: 0 / 0.5 / 1.0. Any axis < 1.0 (and observed) REQUIRES an issue code from that axis's
// registry plus an evidence string. Category and aggregate scores are recomputed from axis data.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const resultsDir = join(scriptDir, "results");
const axesPath = join(scriptDir, "axes.json");

function loadRegistry() {
  if (!existsSync(axesPath)) {
    console.error(`axes.json not found at ${axesPath}`);
    process.exit(2);
  }
  return JSON.parse(readFileSync(axesPath, "utf8"));
}

/** Build axis -> { category, codes, weight, veto } lookup for a rubric type. Supports
 *  both legacy schema (axis: [CODE,...]) and v2 schema (axis: { codes:[...], weight, veto }).
 */
function axisIndex(registry, type) {
  const def = registry.types?.[type];
  if (!def) {
    console.error(`unknown rubric type "${type}". Valid: ${Object.keys(registry.types).join(", ")}`);
    process.exit(2);
  }
  const index = new Map();
  for (const [category, axes] of Object.entries(def.categories)) {
    for (const [axis, spec] of Object.entries(axes)) {
      const meta = Array.isArray(spec)
        ? { category, codes: spec, weight: 1, veto: false }
        : { category, codes: spec.codes || [], weight: spec.weight ?? 1, veto: Boolean(spec.veto) };
      index.set(axis, meta);
    }
  }
  return index;
}

function getOpt(args, name, repeat = false) {
  const out = [];
  for (let i = 0; i < args.length; i++) if (args[i] === name) out.push(args[i + 1]);
  return repeat ? out : out[0];
}

function fail(msg) {
  console.error(`error: ${msg}`);
  process.exit(2);
}

const [cmd, ...args] = process.argv.slice(2);
const registry = loadRegistry();
const TIERS = new Set(registry.tiers ?? [0, 0.5, 1.0]);
const PASS = registry.passThreshold ?? 0.8;

if (cmd === "save") {
  const type = getOpt(args, "--type") || "run";
  const index = axisIndex(registry, type);
  const scenario = getOpt(args, "--scenario") || getOpt(args, "--task");
  const task = getOpt(args, "--task") || scenario;
  const judge = getOpt(args, "--judge") || "unknown";
  const variant = getOpt(args, "--variant") || null;
  const run = getOpt(args, "--run") || null;
  if (!scenario) fail("save requires --scenario <id> (or --task <id>)");

  const rawAxes = getOpt(args, "--axis", true);
  if (rawAxes.length === 0) fail("save requires at least one --axis name=score[:CODE[:evidence]]");

  const axes = rawAxes.map((spec) => {
    const eq = spec.indexOf("=");
    if (eq < 0) fail(`bad --axis "${spec}" (expected name=score[:CODE[:evidence]])`);
    const name = spec.slice(0, eq);
    const rest = spec.slice(eq + 1);
    const meta = index.get(name);
    if (!meta) fail(`unknown axis "${name}" for type "${type}". Valid: ${[...index.keys()].join(", ")}`);

    // "na" marks an unobserved axis (confidence 0) — excluded from rollups.
    if (rest === "na") return { name, category: meta.category, score: 0, issue: null, evidence: "", confidence: 0 };

    const [scoreStr, code, ...evidenceParts] = rest.split(":");
    const score = Number(scoreStr);
    if (!TIERS.has(score)) fail(`axis "${name}" score must be one of ${[...TIERS].join("/")} — got "${scoreStr}"`);
    const evidence = evidenceParts.join(":").trim();
    if (score < 1) {
      if (!code) fail(`axis "${name}" scored ${score} < 1.0 but has no issue code — use name=score:CODE[:evidence]`);
      if (!meta.codes.includes(code)) fail(`issue code "${code}" is not valid for axis "${name}". Valid: ${meta.codes.join(", ")}`);
      if (!evidence) fail(`axis "${name}" scored ${score} < 1.0 but has no evidence — use name=score:CODE:evidence`);
    }
    return { name, category: meta.category, weight: meta.weight, veto: meta.veto, score, issue: code || null, evidence, confidence: 1 };
  });

  // Recompute rollups from axis data (never trust hand-supplied totals). Confidence-gated + weighted.
  const observed = axes.filter((a) => a.confidence > 0);
  const categories = {};
  for (const a of observed) (categories[a.category] ||= []).push({ score: a.score, weight: a.weight });
  const categoryScores = Object.fromEntries(
    Object.entries(categories).map(([c, xs]) => {
      const wSum = xs.reduce((s, x) => s + x.weight, 0);
      const wScore = xs.reduce((s, x) => s + x.weight * x.score, 0);
      return [c, round(wSum ? wScore / wSum : 0)];
    }),
  );
  const wSum = observed.reduce((s, a) => s + a.weight, 0);
  const wScore = observed.reduce((s, a) => s + a.weight * a.score, 0);
  const aggregate = wSum ? round(wScore / wSum) : 0;

  // Pass rule: aggregate clears threshold AND no observed axis is zero AND no veto axis < 1.0.
  // veto axes encode "cosmetics cannot bail out a correctness/gate-compliance regression."
  const vetoFails = observed.filter((a) => a.veto && a.score < 1).map((a) => a.name);
  const hardZeros = observed.filter((a) => a.score === 0).map((a) => a.name);
  let pass = observed.length > 0 && aggregate >= PASS && hardZeros.length === 0 && vetoFails.length === 0;
  const failReason = !observed.length ? "no observed axes"
    : vetoFails.length ? `veto axis fail: ${vetoFails.join(", ")}`
    : hardZeros.length ? `zero score on: ${hardZeros.join(", ")}`
    : aggregate < PASS ? `aggregate ${aggregate.toFixed(2)} < ${PASS}`
    : null;

  const record = {
    schemaVersion: 2,
    type, task, scenario, variant, run, judge,
    timestamp: new Date().toISOString(),
    aggregate, pass, failReason, categoryScores, axes,
  };

  if (!existsSync(resultsDir)) mkdirSync(resultsDir, { recursive: true });
  const safe = (s) => String(s).replace(/[^a-zA-Z0-9_.-]/g, "_");
  const file = join(resultsDir, `${safe(type)}.${safe(scenario)}.${safe(variant || "base")}.${Date.now()}.json`);
  writeFileSync(file, JSON.stringify(record, null, 2));
  console.log(`Saved ${file}\n  aggregate=${aggregate.toFixed(2)} ${pass ? "PASS" : "FAIL"}${failReason ? ` — ${failReason}` : ""} (${observed.length}/${axes.length} axes observed)`);
  process.exit(0);
}

if (cmd === "report" || cmd === "compare") {
  const asJson = args.includes("--json");
  const filterType = getOpt(args, "--type");
  const filterVariant = getOpt(args, "--variant");
  const records = loadRecords();

  if (cmd === "compare") {
    compare(records, getOpt(args, "--scenario"), asJson, getOpt(args, "--baseline"));
    process.exit(0);
  }

  let scoped = records;
  if (filterType) scoped = scoped.filter((r) => r.type === filterType);
  if (filterVariant) scoped = scoped.filter((r) => (r.variant || "base") === filterVariant);

  // Latest record per (type, scenario, variant).
  const latest = new Map();
  for (const r of scoped.sort((a, b) => a.timestamp.localeCompare(b.timestamp))) {
    latest.set(`${r.type}::${r.scenario}::${r.variant || "base"}`, r);
  }
  const rows = [...latest.values()];
  const axisAgg = new Map();
  for (const r of rows) for (const a of r.axes) {
    if (a.confidence <= 0) continue;
    const x = axisAgg.get(a.name) || { sum: 0, n: 0 };
    x.sum += a.score; x.n += 1; axisAgg.set(a.name, x);
  }
  const overall = rows.length ? round(rows.reduce((s, r) => s + r.aggregate, 0) / rows.length) : 0;

  if (asJson) {
    console.log(JSON.stringify({
      overall,
      results: rows.map((r) => ({ type: r.type, scenario: r.scenario, variant: r.variant, aggregate: r.aggregate, pass: r.pass, judge: r.judge })),
      axes: [...axisAgg.entries()].map(([name, v]) => ({ name, mean: round(v.sum / v.n) })),
    }, null, 2));
  } else {
    console.log("AgentRig — dynamic eval report\n");
    if (rows.length === 0) {
      console.log("  No results yet. Run `score.mjs save ...` first.");
    } else {
      const byType = new Map();
      for (const r of rows) {
        if (!byType.has(r.type)) byType.set(r.type, []);
        byType.get(r.type).push(r);
      }
      for (const [type, group] of byType) {
        console.log(`  ${type.toUpperCase()}`);
        for (const r of group) {
          const v = r.variant ? ` [${r.variant}]` : "";
          console.log(`    ${r.pass ? "PASS" : "FAIL"}  ${(r.scenario + v).padEnd(30)} ${r.aggregate.toFixed(2)}  (${r.judge})`);
        }
      }
      console.log("\n  Per-axis means (observed only):");
      for (const [name, v] of axisAgg) console.log(`    ${name.padEnd(22)} ${round(v.sum / v.n).toFixed(2)}`);
      console.log(`\n  Overall: ${overall.toFixed(2)} across ${rows.length} result(s)`);
    }
  }
  process.exit(0);
}

console.error("Usage: score.mjs <save|report|compare> ...");
process.exit(2);

// --- helpers ---------------------------------------------------------------
function round(n) {
  return Math.round(n * 10000) / 10000;
}

function loadRecords() {
  if (!existsSync(resultsDir)) return [];
  const out = [];
  let skipped = 0;
  for (const f of readdirSync(resultsDir).filter((f) => f.endsWith(".json"))) {
    let rec;
    try {
      rec = JSON.parse(readFileSync(join(resultsDir, f), "utf8"));
    } catch {
      console.error(`warning: skipping corrupt result file ${f}`);
      skipped++;
      continue;
    }
    const reason = validateRecord(rec);
    if (reason) {
      console.error(`warning: skipping ${f} (${reason}) — move to results/_legacy/ to silence`);
      skipped++;
      continue;
    }
    out.push(rec);
  }
  if (skipped) console.error(`warning: ${skipped} result file(s) skipped due to invalid shape.`);
  return out;
}

/** Minimal shape check for v2 records. Returns reason string if invalid, null if OK. */
function validateRecord(r) {
  if (!r || typeof r !== "object") return "not an object";
  if (r.schemaVersion !== 2) return `schemaVersion=${r.schemaVersion ?? "missing"} (expected 2)`;
  if (typeof r.type !== "string") return "missing type";
  if (typeof r.scenario !== "string") return "missing scenario";
  if (!Array.isArray(r.axes)) return "axes is not an array";
  for (const a of r.axes) {
    if (!a || typeof a !== "object") return "axis is not an object";
    if (typeof a.name !== "string") return "axis missing name";
    if (typeof a.score !== "number") return `axis "${a.name}" missing numeric score`;
    if (typeof a.confidence !== "number") return `axis "${a.name}" missing numeric confidence`;
  }
  return null;
}

function compare(records, scenario, asJson, baseline) {
  if (!scenario) fail("compare requires --scenario <id>");
  const forScenario = records.filter((r) => r.scenario === scenario);
  const latestByVariant = new Map();
  for (const r of forScenario.sort((a, b) => a.timestamp.localeCompare(b.timestamp))) {
    latestByVariant.set(r.variant || "base", r);
  }
  const variants = [...latestByVariant.values()];

  // Harness-lift mode: delta of every other variant vs the baseline.
  let lift = null;
  if (baseline) {
    const base = latestByVariant.get(baseline);
    if (!base) fail(`no results for baseline variant "${baseline}" on scenario "${scenario}"`);
    lift = variants
      .filter((r) => (r.variant || "base") !== baseline)
      .map((r) => {
        const axisDelta = {};
        const baseAxes = Object.fromEntries((base.axes || []).filter((a) => a.confidence > 0).map((a) => [a.name, a.score]));
        for (const a of (r.axes || []).filter((a) => a.confidence > 0)) {
          if (baseAxes[a.name] !== undefined) axisDelta[a.name] = round(a.score - baseAxes[a.name]);
        }
        return { variant: r.variant || "base", aggregateDelta: round(r.aggregate - base.aggregate), axisDelta };
      });
  }

  if (asJson) {
    console.log(JSON.stringify({
      scenario,
      variants: variants.map((r) => ({ variant: r.variant || "base", aggregate: r.aggregate, pass: r.pass, judge: r.judge, categoryScores: r.categoryScores })),
      ...(lift ? { baseline, lift } : {}),
    }, null, 2));
    process.exit(0);
  }

  console.log(`AgentRig — variant comparison for "${scenario}"\n`);
  if (variants.length === 0) console.log("  No results for that scenario.");
  for (const r of variants) {
    console.log(`  ${(r.variant || "base").padEnd(12)} ${r.aggregate.toFixed(2)} ${r.pass ? "PASS" : "FAIL"}  (${r.judge})`);
    for (const [c, s] of Object.entries(r.categoryScores || {})) console.log(`      ${c.padEnd(20)} ${s.toFixed(2)}`);
  }
  if (lift) {
    console.log(`\n  Harness lift vs baseline "${baseline}":`);
    for (const l of lift) {
      const sign = l.aggregateDelta > 0 ? "+" : "";
      const verdict = l.aggregateDelta > 0 ? "HELPS" : l.aggregateDelta < 0 ? "HURTS" : "no change";
      console.log(`    ${l.variant.padEnd(12)} aggregate ${sign}${l.aggregateDelta.toFixed(2)}  → harness ${verdict}`);
      for (const [name, d] of Object.entries(l.axisDelta)) {
        if (d !== 0) console.log(`        ${name.padEnd(20)} ${d > 0 ? "+" : ""}${d.toFixed(2)}`);
      }
    }
  }
  process.exit(0);
}
