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

// Mirror of src/core/model-family.ts. Kept inline to keep this script dep-free so it
// works in target repos that haven't run `npm install` after `agentrig init`.
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

  // Producer / judge metadata. Comes from --producer-model / --judge-model flags OR from
  // env vars (the orchestrator sets AGENTRIG_PRODUCER_MODEL / AGENTRIG_JUDGE_MODEL so it
  // doesn't have to thread two more positional args through). Family-divergence is enforced:
  // a result where producer + judge share a family is rejected unless --allow-same-family
  // (or AGENTRIG_ALLOW_SAME_FAMILY=1) is set, and the override gets recorded so reviewers
  // can spot lazy single-model setups.
  const producerModel = getOpt(args, "--producer-model") || process.env.AGENTRIG_PRODUCER_MODEL || "";
  const judgeModel = getOpt(args, "--judge-model") || process.env.AGENTRIG_JUDGE_MODEL || judge;
  const allowSameFamily = args.includes("--allow-same-family") || process.env.AGENTRIG_ALLOW_SAME_FAMILY === "1";
  const trialIndex = getOpt(args, "--trial");
  if (producerModel && judgeModel) {
    if (modelFamily(producerModel) === modelFamily(judgeModel) && !allowSameFamily) {
      fail(`producer "${producerModel}" and judge "${judgeModel}" share family "${modelFamily(producerModel)}". ` +
        `Pass --allow-same-family (or set AGENTRIG_ALLOW_SAME_FAMILY=1) to override; the override will be recorded.`);
    }
  }

  const record = {
    schemaVersion: 2,
    type, task, scenario, variant, run, judge,
    producerModel: producerModel || null,
    judgeModel: judgeModel || null,
    producerFamily: producerModel ? modelFamily(producerModel) : null,
    judgeFamily: judgeModel ? modelFamily(judgeModel) : null,
    allowSameFamily,
    trialIndex: trialIndex != null ? Number(trialIndex) : null,
    timestamp: new Date().toISOString(),
    aggregate, pass, failReason, categoryScores, axes,
  };

  if (!existsSync(resultsDir)) mkdirSync(resultsDir, { recursive: true });
  const safe = (s) => String(s).replace(/[^a-zA-Z0-9_.-]/g, "_");
  const file = join(resultsDir, `${safe(type)}.${safe(scenario)}.${safe(variant || "base")}${trialIndex != null ? "." + safe("trial" + trialIndex) : ""}.${Date.now()}.json`);
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
  const filterRun = getOpt(args, "--run");
  if (filterRun) scoped = scoped.filter((r) => r.run === filterRun);

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
      const passed = rows.filter((r) => r.pass).length;
      const failed = rows.length - passed;
      console.log(`  Summary: ${passed}/${rows.length} scenario${rows.length === 1 ? "" : "s"} PASS, ${failed} FAIL`);
      console.log(`  Overall aggregate (mean of per-scenario aggregates): ${overall.toFixed(2)}\n`);
      console.log("  Pass rule: aggregate ≥ 0.8 AND no observed axis = 0 AND no veto axis < 1.0.");
      console.log("  Veto axes per type: run → correctness/gate_compliance; review → finding_correctness/blocking_decision.\n");

      const byType = new Map();
      for (const r of rows) {
        if (!byType.has(r.type)) byType.set(r.type, []);
        byType.get(r.type).push(r);
      }
      for (const [type, group] of byType) {
        console.log(`  ${type.toUpperCase()}`);
        for (const r of group) {
          const v = r.variant ? ` [${r.variant}]` : "";
          const verdict = r.pass ? "PASS" : "FAIL";
          console.log(`    ${verdict}  ${(r.scenario + v).padEnd(30)} ${r.aggregate.toFixed(2)}  ${r.failReason ? `← ${r.failReason}` : ""}`);
          // Print failing axes with their issue code + evidence so the operator can act.
          if (!r.pass) {
            const failing = (r.axes || []).filter((a) => a.confidence > 0 && a.score < 1);
            for (const a of failing) {
              const tag = a.score === 0 ? "0  " : "½  ";
              const code = a.issue ? `[${a.issue}]` : "";
              const ev = (a.evidence || "").slice(0, 110);
              console.log(`        ${tag} ${a.name.padEnd(22)} ${code} ${ev}`);
            }
          }
        }
      }
      // Per-axis means: explicitly label which are observed across multiple scenarios.
      console.log("\n  Per-axis means across all observed scenarios (lower = worse on average):");
      const axisRows = [...axisAgg.entries()].map(([name, v]) => ({ name, mean: round(v.sum / v.n), n: v.n }))
        .sort((a, b) => a.mean - b.mean);
      for (const a of axisRows) {
        const flag = a.mean < 0.5 ? "  ← weakest" : a.mean < 0.8 ? "  ← weak" : "";
        console.log(`    ${a.name.padEnd(22)} ${a.mean.toFixed(2)}  (n=${a.n})${flag}`);
      }

      console.log(`\n  How to read this:`);
      console.log(`    • A scenario PASS means the harness handled this task well per the rubric.`);
      console.log(`    • A scenario FAIL means at least one veto axis dropped below 1.0 OR an observed axis was 0.`);
      console.log(`    • The overall aggregate (${overall.toFixed(2)}) is NOT the harness lift — that requires`);
      console.log(`      a baseline comparison: \`agentrig eval --dynamic --variant baseline --n 5\` then`);
      console.log(`      \`node .agentrig/eval/score.mjs compare --scenario <id> --baseline baseline\`.`);
      if (failed > 0) {
        console.log(`    • To investigate a FAIL: open \`.agentrig/eval/results/runs/<runId>/<scenario>.trial0.diff.patch\``);
        console.log(`      and \`<scenario>.trial0.judge.json\` to see exactly what the producer did and what the judge saw.`);
      }
    }
  }
  process.exit(0);
}

if (cmd === "calibrate") {
  // Calibrate a judge model against the hand-labeled set in eval/calibration/.
  // For each instance, the calibrate script simply compares the agent-supplied
  // judge_scores.json (path passed via --judge-scores) against the ground truth.
  // The orchestration of "actually invoke the judge and capture its output" is
  // CLI-side (`agentrig doctor` does it); this script is the pure scoring half.
  //
  // Usage:
  //   node score.mjs calibrate --instance <path-to-instance.yml> --judge-scores <path.json>
  //   node score.mjs calibrate --report   # roll up cached results in calibration/results/
  const calibDir = join(scriptDir, "calibration");
  if (args.includes("--report")) {
    runCalibrateReport(calibDir);
    process.exit(0);
  }
  const instancePath = getOpt(args, "--instance");
  const judgeScoresPath = getOpt(args, "--judge-scores");
  const judgeModel = getOpt(args, "--judge") || "unknown";
  if (!instancePath || !judgeScoresPath) fail("calibrate requires --instance <path.yml> and --judge-scores <path.json> (or --report)");
  const result = runCalibrateOne(instancePath, judgeScoresPath, judgeModel);
  const resultsDir2 = join(calibDir, "results");
  if (!existsSync(resultsDir2)) mkdirSync(resultsDir2, { recursive: true });
  const safe = (s) => String(s).replace(/[^a-zA-Z0-9_.-]/g, "_");
  const out = join(resultsDir2, `${safe(judgeModel)}.${safe(result.instanceId)}.${Date.now()}.json`);
  writeFileSync(out, JSON.stringify(result, null, 2));
  console.log(`Saved ${out}`);
  console.log(`  ${result.instanceId}: agreement=${(result.agreement * 100).toFixed(1)}% (${result.matches}/${result.compared})  bias=${result.bias.toFixed(3)}`);
  process.exit(0);
}

console.error("Usage: score.mjs <save|report|compare|calibrate> ...");
process.exit(2);

// --- calibration helpers ---------------------------------------------------
function runCalibrateOne(instancePath, judgeScoresPath, judgeModel) {
  if (!existsSync(instancePath)) fail(`instance not found: ${instancePath}`);
  if (!existsSync(judgeScoresPath)) fail(`judge scores not found: ${judgeScoresPath}`);
  // Tiny YAML reader inline — only needs to handle the flat structure of our calibration files.
  // For brevity we punt to a real parse via a child process; but to stay dep-free we just JSON-parse
  // judge scores and use a regex-based reader for the YAML ground truth.
  const text = readFileSync(instancePath, "utf8");
  const truth = parseCalibYaml(text);
  const judge = JSON.parse(readFileSync(judgeScoresPath, "utf8"));
  const judgeAxes = new Map((judge.axes || []).map((a) => [a.name, a]));
  const compared = [];
  for (const t of truth.ground_truth || []) {
    const j = judgeAxes.get(t.axis);
    if (!j) { compared.push({ axis: t.axis, truth: t.score, judge: null, diff: null, within: false }); continue; }
    if ((t.confidence ?? 1) === 0 && (j.confidence ?? 1) === 0) {
      compared.push({ axis: t.axis, truth: 0, judge: 0, diff: 0, within: true });
      continue;
    }
    const diff = j.score - t.score;
    const within = Math.abs(diff) <= 0.5;
    compared.push({ axis: t.axis, truth: t.score, judge: j.score, diff, within });
  }
  const matches = compared.filter((c) => c.within).length;
  const agreement = compared.length ? matches / compared.length : 0;
  const signedDiffs = compared.filter((c) => c.diff != null).map((c) => c.diff);
  const bias = signedDiffs.length ? signedDiffs.reduce((s, x) => s + x, 0) / signedDiffs.length : 0;
  return {
    instanceId: truth.id || "unknown",
    judgeModel,
    compared: compared.length,
    matches,
    agreement: round(agreement),
    bias: round(bias),
    axes: compared,
  };
}

function runCalibrateReport(calibDir) {
  const resultsDir2 = join(calibDir, "results");
  if (!existsSync(resultsDir2)) {
    console.log("No calibration results yet. Run `score.mjs calibrate --instance <path> --judge-scores <path>` first.");
    return;
  }
  const byJudge = new Map();
  for (const f of readdirSync(resultsDir2).filter((f) => f.endsWith(".json"))) {
    let rec;
    try { rec = JSON.parse(readFileSync(join(resultsDir2, f), "utf8")); }
    catch { continue; }
    if (!byJudge.has(rec.judgeModel)) byJudge.set(rec.judgeModel, []);
    byJudge.get(rec.judgeModel).push(rec);
  }
  console.log("AgentRig — judge calibration report\n");
  if (byJudge.size === 0) { console.log("  No calibration results yet."); return; }
  console.log(`  ${"judge".padEnd(28)} ${"n".padStart(3)}  ${"agree%".padStart(7)}  ${"bias".padStart(7)}`);
  for (const [judge, recs] of byJudge) {
    const meanAgree = recs.reduce((s, r) => s + r.agreement, 0) / recs.length;
    const meanBias = recs.reduce((s, r) => s + r.bias, 0) / recs.length;
    const flag = meanAgree < 0.8 ? " (below 80% threshold)" : "";
    console.log(`  ${(judge || "unknown").padEnd(28)} ${String(recs.length).padStart(3)}  ${(meanAgree * 100).toFixed(1).padStart(6)}%  ${meanBias.toFixed(3).padStart(7)}${flag}`);
  }
}

/** Minimal YAML reader for our calibration file shape: top-level scalars + a `ground_truth` list of
 *  `{ axis, score, confidence?, code?, evidence? }` flow-mapping items. Avoids adding `yaml` as a
 *  dep so the installed score.mjs stays self-contained. */
function parseCalibYaml(text) {
  const out = { ground_truth: [] };
  let inGT = false;
  for (const raw of text.split(/\r?\n/)) {
    if (/^ground_truth:\s*$/.test(raw)) { inGT = true; continue; }
    if (inGT && /^\s*-\s*\{/.test(raw)) {
      const body = raw.replace(/^\s*-\s*\{/, "").replace(/\}\s*$/, "");
      const kv = {};
      for (const pair of body.split(",")) {
        const m = pair.trim().match(/^(\w+):\s*(.*)$/);
        if (!m) continue;
        let v = m[2].trim();
        if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
        else if (v.startsWith('"')) v = v.slice(1, -1);
        kv[m[1]] = v;
      }
      out.ground_truth.push(kv);
      continue;
    }
    // Any top-level (non-indented) key exits the ground_truth block.
    if (/^\S/.test(raw)) inGT = false;
    const m = raw.match(/^(\w+):\s*(.+?)\s*$/);
    if (m && !inGT) out[m[1]] = /^-?\d+(\.\d+)?$/.test(m[2]) ? Number(m[2]) : m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

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

  // Group by variant; keep ALL trials, not just the latest. This is the spine of P4.
  const trialsByVariant = new Map();
  for (const r of forScenario.sort((a, b) => a.timestamp.localeCompare(b.timestamp))) {
    const v = r.variant || "base";
    if (!trialsByVariant.has(v)) trialsByVariant.set(v, []);
    trialsByVariant.get(v).push(r);
  }

  // Per-variant summary: n trials, mean ± stdev of aggregate, pass-rate.
  const variantSummaries = [];
  for (const [variant, trials] of trialsByVariant) {
    const aggs = trials.map((t) => t.aggregate);
    const mean = aggs.reduce((s, x) => s + x, 0) / aggs.length;
    const variance = aggs.length > 1 ? aggs.reduce((s, x) => s + (x - mean) ** 2, 0) / (aggs.length - 1) : 0;
    const stdev = Math.sqrt(variance);
    const passRate = trials.filter((t) => t.pass).length / trials.length;
    variantSummaries.push({
      variant,
      n: trials.length,
      meanAggregate: round(mean),
      stdevAggregate: round(stdev),
      passRate: round(passRate),
      judge: trials[trials.length - 1].judge,
    });
  }

  // Harness-lift mode: paired sign test of every other variant vs the baseline.
  let lift = null;
  if (baseline) {
    const baseTrials = trialsByVariant.get(baseline);
    if (!baseTrials) fail(`no results for baseline variant "${baseline}" on scenario "${scenario}"`);
    lift = [];
    for (const [variant, trials] of trialsByVariant) {
      if (variant === baseline) continue;
      // Pair trial i of variant with trial i of baseline. If trial counts differ, pair what we can.
      const paired = Math.min(trials.length, baseTrials.length);
      if (paired === 0) continue;
      const deltas = [];
      for (let i = 0; i < paired; i++) deltas.push(trials[i].aggregate - baseTrials[i].aggregate);
      const median = deltas.slice().sort((a, b) => a - b)[Math.floor(deltas.length / 2)];
      // Binomial sign test: under H0 (no effect), wins ~ Binomial(n, 0.5).
      // Two-sided p-value = 2 * P(X >= k_wins | n, 0.5) for k_wins >= n/2.
      const wins = deltas.filter((d) => d > 0).length;
      const losses = deltas.filter((d) => d < 0).length;
      const ties = deltas.filter((d) => d === 0).length;
      const nNonTie = wins + losses;
      const pValue = signTestPValue(Math.max(wins, losses), nNonTie);
      const verdict = nNonTie < 3
        ? "INCONCLUSIVE (n<3, need more trials)"
        : pValue >= 0.05
          ? "INCONCLUSIVE (p>=0.05)"
          : Math.abs(median) < 0.05
            ? "INCONCLUSIVE (effect <0.05)"
            : median > 0 ? "HELPS" : "HURTS";

      // Per-axis median delta across paired trials (axes present in both sides).
      const axisDelta = {};
      const axesInBoth = new Set(baseTrials[0].axes.map((a) => a.name));
      for (const axis of axesInBoth) {
        const ds = [];
        for (let i = 0; i < paired; i++) {
          const ba = baseTrials[i].axes.find((a) => a.name === axis && a.confidence > 0);
          const va = trials[i].axes.find((a) => a.name === axis && a.confidence > 0);
          if (ba && va) ds.push(va.score - ba.score);
        }
        if (ds.length === 0) continue;
        const sorted = ds.slice().sort((a, b) => a - b);
        axisDelta[axis] = round(sorted[Math.floor(sorted.length / 2)]);
      }
      lift.push({ variant, n: paired, medianDelta: round(median), wins, losses, ties, pValue: round(pValue), verdict, axisDelta });
    }
  }

  if (asJson) {
    console.log(JSON.stringify({
      scenario,
      variants: variantSummaries,
      ...(lift ? { baseline, lift } : {}),
    }, null, 2));
    process.exit(0);
  }

  console.log(`AgentRig — variant comparison for "${scenario}"\n`);
  if (variantSummaries.length === 0) {
    console.log("  No results for that scenario.");
  } else {
    console.log(`  ${"variant".padEnd(12)} ${"n".padStart(3)}  ${"mean".padStart(6)}  ${"stdev".padStart(6)}  ${"pass%".padStart(6)}   judge`);
    for (const s of variantSummaries) {
      console.log(`  ${s.variant.padEnd(12)} ${String(s.n).padStart(3)}  ${s.meanAggregate.toFixed(3).padStart(6)}  ${s.stdevAggregate.toFixed(3).padStart(6)}  ${(s.passRate * 100).toFixed(0).padStart(5)}%   ${s.judge}`);
    }
  }
  if (lift) {
    console.log(`\n  Harness lift vs baseline "${baseline}" (paired sign test):`);
    for (const l of lift) {
      const sign = l.medianDelta > 0 ? "+" : "";
      console.log(`    ${l.variant.padEnd(12)} n=${l.n}  median Δ ${sign}${l.medianDelta.toFixed(3)}  wins/losses/ties ${l.wins}/${l.losses}/${l.ties}  p=${l.pValue.toFixed(3)}  → ${l.verdict}`);
      for (const [name, d] of Object.entries(l.axisDelta)) {
        if (d !== 0) console.log(`        ${name.padEnd(22)} median Δ ${d > 0 ? "+" : ""}${d.toFixed(3)}`);
      }
    }
  }
  process.exit(0);
}

/** Two-sided binomial sign-test p-value: P(X >= k or X <= n-k | n, 0.5). */
function signTestPValue(k, n) {
  if (n === 0) return 1;
  // sum of binomial PMF from max(k, n-k) to n, then double (two-sided).
  const upper = Math.max(k, n - k);
  let pTail = 0;
  for (let i = upper; i <= n; i++) pTail += binomCoeff(n, i) * Math.pow(0.5, n);
  // Cap at 1.0 (two-sided x2, but when k == n/2 exactly the tails meet).
  return Math.min(1, pTail * 2);
}
function binomCoeff(n, k) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  k = Math.min(k, n - k);
  let c = 1;
  for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1);
  return c;
}
