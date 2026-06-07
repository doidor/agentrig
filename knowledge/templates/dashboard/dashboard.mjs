#!/usr/bin/env node
// AgentRig harness dashboard. Dependency-free. Surfaces, in one place:
//   • the agent roster (roles + models)            (principle 2)
//   • live GitHub tasks per harness label via `gh` (principle 3 — system of record)
//   • the static Harness Score + per-principle      (principle 6)
//   • the latest dynamic eval summary               (principle 6)
//   • the harness hard limits                       (principle 10)
// Usage:
//   node .agentrig/dashboard/dashboard.mjs            terminal dashboard
//   node .agentrig/dashboard/dashboard.mjs --json     machine-readable
//   node .agentrig/dashboard/dashboard.mjs --html [file]   write a self-contained HTML page
//   node .agentrig/dashboard/dashboard.mjs --no-tasks live GitHub lookups skipped (offline)
import { readFileSync, existsSync, readdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..", "..");

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const htmlIdx = args.indexOf("--html");
const asHtml = htmlIdx >= 0;
const htmlOut = asHtml ? args[htmlIdx + 1] && !args[htmlIdx + 1].startsWith("-") ? args[htmlIdx + 1] : join(scriptDir, "dashboard.html") : null;
const noTasks = args.includes("--no-tasks");

const rel = (p) => resolve(repoRoot, p);
const read = (p) => (existsSync(rel(p)) ? readFileSync(rel(p), "utf8") : null);

function runNode(scriptRelPath, scriptArgs) {
  try {
    const out = execFileSync(process.execPath, [rel(scriptRelPath), ...scriptArgs], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return JSON.parse(out);
  } catch {
    return null;
  }
}

// --- Agent roster -----------------------------------------------------------
function loadRoster() {
  const dir = rel(".agentrig/agents");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".yml"))
    .map((f) => {
      const text = readFileSync(join(dir, f), "utf8");
      const get = (k) => (text.match(new RegExp("^\\s*" + k + "\\s*:\\s*(.+)\\s*$", "m")) || [])[1]?.trim() ?? null;
      return { role: get("role") || f.replace(/\.yml$/, ""), model: get("model"), tier: get("model_tier") };
    })
    .sort((a, b) => a.role.localeCompare(b.role));
}

// --- State<->label map from the state machine -------------------------------
function loadStateLabels() {
  const text = read(".agentrig/harness/state-machine.yml");
  if (!text) return {};
  const lines = text.split("\n");
  const map = {};
  let inStateMap = false;
  let baseIndent = null;
  for (const line of lines) {
    if (/^\s*state_map:\s*$/.test(line)) {
      inStateMap = true;
      baseIndent = null;
      continue;
    }
    if (inStateMap) {
      if (line.trim() === "") continue;
      const indent = line.length - line.trimStart().length;
      const m = line.match(/^\s*([a-z_]+)\s*:\s*([A-Za-z0-9_-]+)\s*$/);
      if (baseIndent === null && m) baseIndent = indent;
      if (m && indent === baseIndent) map[m[1]] = m[2];
      else if (indent <= (baseIndent ?? 0) - 1 || /^\s*[a-z_]+:\s*$/.test(line)) {
        if (!m) break;
      }
    }
  }
  return map;
}

function loadLimits() {
  const text = read(".agentrig/harness/state-machine.yml");
  if (!text) return {};
  const out = {};
  const block = text.split(/^\s*limits:\s*$/m)[1];
  if (!block) return out;
  for (const line of block.split("\n")) {
    const m = line.match(/^\s{2,}([a-z_]+)\s*:\s*(\d+)\s*$/);
    if (m) out[m[1]] = Number(m[2]);
    else if (/^\S/.test(line) && line.trim() !== "") break;
  }
  return out;
}

// --- Live GitHub tasks via gh ----------------------------------------------
function ghAvailable() {
  try {
    execFileSync("gh", ["auth", "status"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function ghList(kind, label) {
  // kind: "issue" | "pr"
  try {
    const out = execFileSync(
      "gh",
      [kind, "list", "--label", label, "--state", "open", "--limit", "30", "--json", "number,title,url,assignees"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    return JSON.parse(out).map((x) => ({
      kind,
      number: x.number,
      title: x.title,
      url: x.url,
      assignees: (x.assignees || []).map((a) => a.login),
    }));
  } catch {
    return [];
  }
}

function loadTasks(stateLabels) {
  if (noTasks) return { available: false, reason: "skipped (--no-tasks)", byState: {} };
  if (!ghAvailable()) return { available: false, reason: "gh not installed or not authenticated", byState: {} };
  const byState = {};
  for (const [state, label] of Object.entries(stateLabels)) {
    byState[state] = { label, items: [...ghList("issue", label), ...ghList("pr", label)] };
  }
  return { available: true, reason: null, byState };
}

// --- Gather everything ------------------------------------------------------
const audit = runNode(".agentrig/eval/static-audit.mjs", ["--json"]);
const evals = runNode(".agentrig/eval/score.mjs", ["report", "--json"]) || { overall: 0, scenarios: [], axes: [] };
const roster = loadRoster();
const stateLabels = loadStateLabels();
const limits = loadLimits();
const tasks = loadTasks(stateLabels);

const data = {
  generatedAt: new Date().toISOString(),
  repo: repoRoot,
  harnessScore: audit?.harnessScore ?? null,
  principles: audit?.principles ?? [],
  roster,
  tasks,
  evals,
  limits,
};

// --- Render -----------------------------------------------------------------
if (asJson) {
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

if (asHtml) {
  writeFileSync(htmlOut, renderHtml(data));
  console.log(`Wrote ${htmlOut}`);
  process.exit(0);
}

renderTerminal(data);

function renderTerminal(d) {
  const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
  const c = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
  const bold = (s) => c("1", s), dim = (s) => c("2", s), green = (s) => c("32", s), yellow = (s) => c("33", s), red = (s) => c("31", s), cyan = (s) => c("36", s);
  const rule = dim("─".repeat(64));

  console.log(`\n${bold("AgentRig — harness dashboard")}  ${dim(d.repo)}`);
  console.log(rule);

  const scoreColor = d.harnessScore == null ? dim : d.harnessScore >= 80 ? green : d.harnessScore >= 50 ? yellow : red;
  console.log(`${bold("Harness Score")}  ${scoreColor(d.harnessScore == null ? "n/a" : d.harnessScore + "%")}`);
  if (d.principles.length) {
    const weak = d.principles.filter((p) => p.score < 1).map((p) => `P${p.principle} ${(p.score * 100).toFixed(0)}%`);
    console.log(dim(`  weak principles: ${weak.length ? weak.join(", ") : "none — all full credit"}`));
  }

  console.log(`\n${bold("Agents")} ${dim(`(${d.roster.length} roles)`)}`);
  for (const a of d.roster) console.log(`  ${cyan(a.role.padEnd(11))} ${(a.model || "?").padEnd(20)} ${dim(a.tier || "")}`);

  console.log(`\n${bold("Tasks")}`);
  if (!d.tasks.available) {
    console.log(dim(`  unavailable — ${d.tasks.reason}`));
  } else {
    let total = 0;
    for (const [state, info] of Object.entries(d.tasks.byState)) {
      const items = info.items;
      total += items.length;
      const head = `  ${state.padEnd(16)} ${dim(info.label)}  ${bold(String(items.length))}`;
      console.log(head);
      for (const it of items.slice(0, 8)) {
        const who = it.assignees.length ? dim(` @${it.assignees.join(", @")}`) : dim(" unassigned");
        console.log(`      ${it.kind === "pr" ? "PR" : "# "}${it.number} ${it.title.slice(0, 48)}${who}`);
      }
    }
    if (total === 0) console.log(dim("  no open tasks carrying harness labels"));
  }

  console.log(`\n${bold("Evals")} ${dim("(dynamic)")}`);
  const evalRows = d.evals.results || d.evals.scenarios || [];
  if (!evalRows.length) {
    console.log(dim("  no dynamic eval runs yet — `agentrig eval --dynamic`"));
  } else {
    console.log(`  overall ${bold(d.evals.overall.toFixed(2))} across ${evalRows.length} result(s)`);
    for (const s of evalRows) {
      const label = `${s.type ? s.type + "/" : ""}${s.scenario}${s.variant ? " [" + s.variant + "]" : ""}`;
      console.log(`    ${s.pass ? green("PASS") : red("FAIL")} ${label.padEnd(28)} ${s.aggregate.toFixed(2)} ${dim("(" + s.judge + ")")}`);
    }
  }

  if (Object.keys(d.limits).length) {
    console.log(`\n${bold("Limits")}`);
    console.log(dim("  " + Object.entries(d.limits).map(([k, v]) => `${k}=${v}`).join("  ")));
  }
  console.log("");
}

function renderHtml(d) {
  const esc = (s) => String(s).replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m]));
  const scoreClass = d.harnessScore == null ? "na" : d.harnessScore >= 80 ? "good" : d.harnessScore >= 50 ? "warn" : "bad";
  const rosterRows = d.roster.map((a) => `<tr><td>${esc(a.role)}</td><td>${esc(a.model || "?")}</td><td>${esc(a.tier || "")}</td></tr>`).join("");
  let tasksHtml;
  if (!d.tasks.available) {
    tasksHtml = `<p class="muted">Tasks unavailable — ${esc(d.tasks.reason)}</p>`;
  } else {
    tasksHtml = Object.entries(d.tasks.byState).map(([state, info]) => {
      const items = info.items.map((it) => `<li><span class="tag">${it.kind === "pr" ? "PR" : "#"}${it.number}</span> <a href="${esc(it.url)}">${esc(it.title)}</a> <span class="muted">${it.assignees.length ? "@" + it.assignees.map(esc).join(", @") : "unassigned"}</span></li>`).join("");
      return `<div class="state"><h4>${esc(state)} <span class="muted">${esc(info.label)} · ${info.items.length}</span></h4><ul>${items || '<li class="muted">none</li>'}</ul></div>`;
    }).join("");
  }
  const evalList = d.evals.results || d.evals.scenarios || [];
  const evalRows = evalList.map((s) => `<tr><td>${s.pass ? "✅" : "❌"}</td><td>${esc((s.type ? s.type + "/" : "") + s.scenario + (s.variant ? " [" + s.variant + "]" : ""))}</td><td>${s.aggregate.toFixed(2)}</td><td class="muted">${esc(s.judge)}</td></tr>`).join("");
  const limits = Object.entries(d.limits).map(([k, v]) => `<code>${esc(k)}=${esc(v)}</code>`).join(" ");
  return `<!doctype html><html><head><meta charset="utf-8"><title>AgentRig dashboard</title>
<style>
:root{color-scheme:light dark}body{font:14px/1.5 system-ui,sans-serif;margin:2rem auto;max-width:880px;padding:0 1rem}
h1{font-size:1.3rem}h2{font-size:1rem;border-bottom:1px solid #8884;padding-bottom:.2rem;margin-top:2rem}
.score{font-size:2rem;font-weight:700}.good{color:#1a7f37}.warn{color:#9a6700}.bad{color:#cf222e}.na{color:#888}
table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:.25rem .5rem;border-bottom:1px solid #8882}
.muted{color:#888}.tag{display:inline-block;background:#8882;border-radius:4px;padding:0 .35rem;font-size:.8em}
.state h4{margin:.6rem 0 .2rem}code{background:#8882;border-radius:4px;padding:0 .3rem}
</style></head><body>
<h1>AgentRig — harness dashboard</h1>
<p class="muted">${esc(d.repo)} · generated ${esc(d.generatedAt)}</p>
<h2>Harness Score</h2><p class="score ${scoreClass}">${d.harnessScore == null ? "n/a" : d.harnessScore + "%"}</p>
<h2>Agents (${d.roster.length})</h2><table><tr><th>Role</th><th>Model</th><th>Tier</th></tr>${rosterRows}</table>
<h2>Tasks</h2>${tasksHtml}
<h2>Evals</h2>${evalRows ? `<table><tr><th></th><th>Scenario</th><th>Score</th><th>Judge</th></tr>${evalRows}</table><p class="muted">overall ${d.evals.overall.toFixed(2)}</p>` : '<p class="muted">No dynamic eval runs yet.</p>'}
${limits ? `<h2>Limits</h2><p>${limits}</p>` : ""}
</body></html>`;
}
