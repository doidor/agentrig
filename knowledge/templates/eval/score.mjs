#!/usr/bin/env node
// AgentRig dynamic-eval aggregator (principle 6). Owns the results JSON shape so scores are never
// hand-edited. Usage:
//   node score.mjs save --scenario fix-failing-test --judge gpt-5 \
//        --axis correctness=1.0 --axis self_verification=0.5:AB1 --axis memory=1.0
//   node score.mjs report [--json]
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const resultsDir = join(scriptDir, "results");
const PASS_THRESHOLD = 0.8;

function getOpt(args, name, repeat = false) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === name) out.push(args[i + 1]);
  }
  return repeat ? out : out[0];
}

const [cmd, ...args] = process.argv.slice(2);

if (cmd === "save") {
  const scenario = getOpt(args, "--scenario");
  const judge = getOpt(args, "--judge") || "unknown";
  if (!scenario) {
    console.error("save requires --scenario <id>");
    process.exit(2);
  }
  const axes = getOpt(args, "--axis", true).map((a) => {
    const [name, rest] = a.split("=");
    const [scoreStr, code] = (rest || "").split(":");
    const score = Number(scoreStr);
    if (Number.isNaN(score)) {
      console.error(`bad --axis ${a} (expected name=score[:CODE])`);
      process.exit(2);
    }
    if (score < 1 && !code) {
      console.error(`axis ${name} scored ${score} < 1.0 but has no issue code — use name=score:CODE`);
      process.exit(2);
    }
    return { name, score, code: code || null };
  });
  if (axes.length === 0) {
    console.error("save requires at least one --axis name=score[:CODE]");
    process.exit(2);
  }
  const aggregate = axes.reduce((s, a) => s + a.score, 0) / axes.length;
  const pass = aggregate >= PASS_THRESHOLD && axes.every((a) => a.score > 0);
  const record = { scenario, judge, timestamp: new Date().toISOString(), axes, aggregate, pass };
  if (!existsSync(resultsDir)) mkdirSync(resultsDir, { recursive: true });
  const file = join(resultsDir, `${scenario}.${Date.now()}.json`);
  writeFileSync(file, JSON.stringify(record, null, 2));
  console.log(`Saved ${file}\n  aggregate=${aggregate.toFixed(2)} ${pass ? "PASS" : "FAIL"}`);
  process.exit(0);
}

if (cmd === "report") {
  const asJson = args.includes("--json");
  if (!existsSync(resultsDir)) {
    console.log("No results yet. Run `score.mjs save ...` first.");
    process.exit(0);
  }
  const records = readdirSync(resultsDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(resultsDir, f), "utf8")));
  // Latest record per scenario.
  const latest = new Map();
  for (const r of records.sort((a, b) => a.timestamp.localeCompare(b.timestamp))) latest.set(r.scenario, r);
  const scenarios = [...latest.values()];
  const axisAgg = new Map();
  for (const r of scenarios) for (const a of r.axes) {
    const x = axisAgg.get(a.name) || { sum: 0, n: 0 };
    x.sum += a.score; x.n += 1; axisAgg.set(a.name, x);
  }
  const overall = scenarios.length ? scenarios.reduce((s, r) => s + r.aggregate, 0) / scenarios.length : 0;
  if (asJson) {
    console.log(JSON.stringify({
      overall,
      scenarios: scenarios.map((r) => ({ scenario: r.scenario, aggregate: r.aggregate, pass: r.pass, judge: r.judge })),
      axes: [...axisAgg.entries()].map(([name, v]) => ({ name, mean: v.sum / v.n })),
    }, null, 2));
  } else {
    console.log("AgentRig — dynamic eval report\n");
    for (const r of scenarios) console.log(`  ${r.pass ? "PASS" : "FAIL"}  ${r.scenario.padEnd(28)} ${r.aggregate.toFixed(2)}  (judge: ${r.judge})`);
    console.log("\n  Per-axis means:");
    for (const [name, v] of axisAgg) console.log(`    ${name.padEnd(22)} ${(v.sum / v.n).toFixed(2)}`);
    console.log(`\n  Overall: ${overall.toFixed(2)} across ${scenarios.length} scenario(s)`);
  }
  process.exit(0);
}

console.error("Usage: score.mjs <save|report> ...");
process.exit(2);
