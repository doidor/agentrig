import { existsSync, statSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import YAML from "yaml";
import { readText } from "./fsutil.js";
import { loadCanonicalChecks, type CheckDef } from "./knowledge.js";
import { sameFamily } from "./model-family.js";

export type CheckLayer = "completeness" | "quality";

export interface CheckResult {
  id: string;
  principle: number;
  title: string;
  score: number; // 0 | 0.5 | 1
  evidence: string;
  layer: CheckLayer;
}

export interface AuditReport {
  harnessScore: number; // percent 0..100 — completeness aggregate (Layer A1)
  aggregate: number; // 0..1 — completeness aggregate
  qualityScore: number; // percent 0..100 — quality probes aggregate (Layer A2)
  qualityAggregate: number; // 0..1 — quality aggregate
  results: CheckResult[];
  byPrinciple: { principle: number; score: number }[];
  source: "repo" | "canonical";
}

function frontmatter(text: string | null): string | null {
  if (!text || !text.startsWith("---")) return null;
  const end = text.indexOf("\n---", 3);
  return end < 0 ? null : text.slice(3, end);
}

function extractValue(text: string | null, key: string): string | null {
  if (!text) return null;
  const m = text.match(new RegExp("^\\s*" + key + "\\s*:\\s*(.+)\\s*$", "m"));
  return m ? m[1]!.trim() : null;
}

function scoreCheck(repoRoot: string, c: CheckDef): { score: number; evidence: string } {
  const rel = (p: string) => resolve(repoRoot, p);
  const read = (p: string) => readText(rel(p));
  switch (c.type) {
    case "path-exists": {
      const p = String(c.path);
      return existsSync(rel(p)) ? { score: 1, evidence: "" } : { score: 0, evidence: `missing ${p}` };
    }
    case "file-contains": {
      const p = String(c.path);
      const text = read(p);
      if (text == null) return { score: 0, evidence: `missing ${p}` };
      const patterns = (c.patterns as string[]) ?? [];
      const missing = patterns.filter((x) => !text.includes(x));
      return missing.length === 0
        ? { score: 1, evidence: "" }
        : { score: 0.5, evidence: `present but missing markers: ${missing.join(", ")}` };
    }
    case "dir-min": {
      const p = String(c.path);
      const abs = rel(p);
      if (!existsSync(abs) || !statSync(abs).isDirectory()) return { score: 0, evidence: `missing dir ${p}` };
      const n = readdirSync(abs).filter((e) => !e.startsWith(".")).length;
      const min = Number(c.min ?? 1);
      return n >= min ? { score: 1, evidence: "" } : { score: 0.5, evidence: `${n} entries, need ${min}` };
    }
    case "frontmatter-keys": {
      const p = String(c.path);
      const fm = frontmatter(read(p));
      if (fm == null) return { score: 0, evidence: `no frontmatter in ${p}` };
      const keys = (c.keys as string[]) ?? [];
      const missing = keys.filter((k) => !new RegExp("^\\s*" + k + "\\s*:", "m").test(fm));
      return missing.length === 0
        ? { score: 1, evidence: "" }
        : { score: 0.5, evidence: `missing keys: ${missing.join(", ")}` };
    }
    case "frontmatter-keys-all": {
      // Walk every <dir>/<entry>/<file> and assert each has the required frontmatter keys.
      // Catches the gap where today only one skill (self-verify) is spot-checked.
      const dir = String(c.path);
      const fileName = String(c.file ?? "SKILL.md");
      const abs = rel(dir);
      if (!existsSync(abs) || !statSync(abs).isDirectory()) {
        return { score: 0, evidence: `missing dir ${dir}` };
      }
      const keys = (c.keys as string[]) ?? [];
      const offenders: string[] = [];
      for (const entry of readdirSync(abs)) {
        if (entry.startsWith(".") || entry.startsWith("_")) continue;
        const subAbs = join(abs, entry);
        if (!statSync(subAbs).isDirectory()) continue;
        const filePath = join(subAbs, fileName);
        if (!existsSync(filePath)) {
          offenders.push(`${entry}/${fileName} missing`);
          continue;
        }
        const fm = frontmatter(readText(filePath));
        if (fm == null) {
          offenders.push(`${entry} no frontmatter`);
          continue;
        }
        const missing = keys.filter((k) => !new RegExp("^\\s*" + k + "\\s*:", "m").test(fm));
        if (missing.length) offenders.push(`${entry} missing ${missing.join("/")}`);
      }
      if (offenders.length === 0) return { score: 1, evidence: "" };
      return { score: 0.5, evidence: offenders.join("; ") };
    }
    case "roles-distinct-models": {
      // Legacy: kept for back-compat. Prefer roles-distinct-families.
      const key = String(c.key ?? "model");
      const dev = extractValue(read(String(c.developer)), key);
      const rev = extractValue(read(String(c.reviewer)), key);
      if (!dev || !rev) return { score: 0, evidence: "developer/reviewer model not declared" };
      return dev !== rev
        ? { score: 1, evidence: "" }
        : { score: 0.5, evidence: `developer and reviewer share model "${dev}"` };
    }
    case "roles-distinct-families": {
      // The single-model-bias mitigation principle is about model FAMILIES, not exact ids.
      // claude-sonnet-4.5 vs claude-sonnet-4.6 must FAIL here.
      const key = String(c.key ?? "model");
      const dev = extractValue(read(String(c.developer)), key);
      const rev = extractValue(read(String(c.reviewer)), key);
      if (!dev || !rev) return { score: 0, evidence: "developer/reviewer model not declared" };
      if (!sameFamily(dev, rev)) return { score: 1, evidence: "" };
      return { score: 0, evidence: `developer "${dev}" and reviewer "${rev}" share a model family` };
    }
    case "state-machine-dag": {
      // Structural: parse the state machine YAML and assert it actually IS a DAG with
      // the minimum lifecycle present, instead of just substring-matching "states:".
      const p = String(c.path);
      const text = read(p);
      if (text == null) return { score: 0, evidence: `missing ${p}` };
      let parsed: { states?: { name?: string }[]; transitions?: { from?: string; to?: string; trigger?: string }[] };
      try {
        parsed = YAML.parse(text);
      } catch (e) {
        return { score: 0, evidence: `${p} is not valid YAML: ${(e as Error).message}` };
      }
      const states = Array.isArray(parsed?.states) ? parsed.states : [];
      const transitions = Array.isArray(parsed?.transitions) ? parsed.transitions : [];
      const minStates = Number(c.minStates ?? 6);
      const requirePath = String(c.requirePath ?? "queued->merged");
      const problems: string[] = [];
      if (states.length < minStates) problems.push(`${states.length} states, need ≥${minStates}`);
      const stateNames = new Set(states.map((s) => String(s?.name ?? "")).filter(Boolean));
      const badTransitions = transitions.filter((t) => !t?.from || !t?.to || !t?.trigger);
      if (badTransitions.length) problems.push(`${badTransitions.length} transitions missing from/to/trigger`);
      // BFS for the required path. The 'any' wildcard from-state acts as a universal source.
      const [src, dst] = requirePath.split("->") as [string, string];
      if (src && dst) {
        const adj = new Map<string, Set<string>>();
        for (const t of transitions) {
          const from = String(t?.from ?? "");
          const to = String(t?.to ?? "");
          if (!from || !to) continue;
          if (from === "any") {
            for (const s of stateNames) {
              if (!adj.has(s)) adj.set(s, new Set());
              adj.get(s)!.add(to);
            }
          } else {
            if (!adj.has(from)) adj.set(from, new Set());
            adj.get(from)!.add(to);
          }
        }
        if (!hasPath(adj, src, dst)) problems.push(`no path ${src}→${dst}`);
      }
      if (problems.length === 0) return { score: 1, evidence: "" };
      return { score: 0.5, evidence: problems.join("; ") };
    }
    case "quality-probe": {
      // A handful of cheap content sanity checks (P1.4). Each probe has a `probe` kind.
      const probe = String(c.probe ?? "");
      const p = String(c.path ?? "");
      switch (probe) {
        case "no-unfilled-placeholders": {
          const text = read(p);
          if (text == null) return { score: 0, evidence: `missing ${p}` };
          // Strip ```code blocks``` and `inline code` before scanning, so the probe doesn't
          // false-positive on docs that *describe* placeholder syntax (e.g. "{{VAR}} substitution").
          const stripped = text
            .replace(/```[\s\S]*?```/g, "")
            .replace(/`[^`\n]*`/g, "");
          const tokens = stripped.match(/\{\{[A-Z_]+\}\}/g) ?? [];
          return tokens.length === 0
            ? { score: 1, evidence: "" }
            : { score: 0, evidence: `unfilled tokens in ${p}: ${[...new Set(tokens)].join(", ")}` };
        }
        case "axes-json-coherent": {
          const text = read(p);
          if (text == null) return { score: 0, evidence: `missing ${p}` };
          let j: { types?: Record<string, { categories?: Record<string, Record<string, unknown>> }> };
          try {
            j = JSON.parse(text);
          } catch (e) {
            return { score: 0, evidence: `${p} not valid JSON: ${(e as Error).message}` };
          }
          if (!j?.types) return { score: 0, evidence: `${p} missing "types"` };
          const issues: string[] = [];
          for (const [tname, t] of Object.entries(j.types)) {
            if (!t?.categories) {
              issues.push(`${tname}: no categories`);
              continue;
            }
            for (const [cname, cat] of Object.entries(t.categories)) {
              for (const [axis, spec] of Object.entries(cat)) {
                // Both shapes: v1 = ["CODE",...]; v2 = { codes: [...], weight, veto }
                const codes = Array.isArray(spec) ? spec : (spec as { codes?: unknown[] })?.codes;
                if (!Array.isArray(codes) || codes.length === 0) {
                  issues.push(`${tname}/${cname}/${axis}: no issue codes`);
                }
              }
            }
          }
          return issues.length === 0
            ? { score: 1, evidence: "" }
            : { score: 0.5, evidence: issues.join("; ") };
        }
        case "checks-json-coherent": {
          const text = read(p);
          if (text == null) return { score: 0, evidence: `missing ${p}` };
          let j: { checks?: { id?: string; type?: string }[] };
          try {
            j = JSON.parse(text);
          } catch (e) {
            return { score: 0, evidence: `${p} not valid JSON: ${(e as Error).message}` };
          }
          const checks = j?.checks ?? [];
          const knownTypes = new Set([
            "path-exists", "file-contains", "dir-min", "frontmatter-keys",
            "frontmatter-keys-all", "roles-distinct-models", "roles-distinct-families",
            "state-machine-dag", "quality-probe",
          ]);
          const ids = checks.map((x) => x?.id ?? "");
          const dupIds = ids.filter((id, i) => id && ids.indexOf(id) !== i);
          const badTypes = checks.filter((x) => !knownTypes.has(String(x?.type ?? "")));
          const issues: string[] = [];
          if (dupIds.length) issues.push(`duplicate ids: ${[...new Set(dupIds)].join(", ")}`);
          if (badTypes.length) issues.push(`unknown check types: ${badTypes.map((x) => x?.type).join(", ")}`);
          return issues.length === 0
            ? { score: 1, evidence: "" }
            : { score: 0.5, evidence: issues.join("; ") };
        }
        case "context-md-present": {
          return existsSync(rel(p))
            ? { score: 1, evidence: "" }
            : { score: 0.5, evidence: `${p} missing — run \`agentrig init\` to investigate the repo` };
        }
        default:
          return { score: 0, evidence: `unknown quality probe "${probe}"` };
      }
    }
    default:
      return { score: 0, evidence: `unknown check type ${c.type}` };
  }
}

/** BFS path existence. Used by the state-machine-dag check. */
function hasPath(adj: Map<string, Set<string>>, src: string, dst: string): boolean {
  if (src === dst) return true;
  const seen = new Set<string>([src]);
  const queue: string[] = [src];
  while (queue.length) {
    const cur = queue.shift()!;
    const nexts = adj.get(cur);
    if (!nexts) continue;
    for (const n of nexts) {
      if (n === dst) return true;
      if (!seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return false;
}

/** Resolve which checks to use: prefer the repo's installed checks.json, else AgentRig canonical. */
function resolveChecks(repoRoot: string): { checks: CheckDef[]; source: "repo" | "canonical" } {
  const repoChecks = readText(join(repoRoot, ".agentrig", "eval", "checks.json"));
  if (repoChecks) {
    try {
      return { checks: (JSON.parse(repoChecks).checks ?? []) as CheckDef[], source: "repo" };
    } catch {
      /* fall through to canonical */
    }
  }
  return { checks: loadCanonicalChecks(), source: "canonical" };
}

export function auditHarness(repoRoot: string): AuditReport {
  const { checks, source } = resolveChecks(repoRoot);
  const results: CheckResult[] = checks.map((c) => {
    const { score, evidence } = scoreCheck(repoRoot, c);
    // Default layer is "completeness" so unannotated check files still work.
    const layer: CheckLayer = (c as { layer?: string }).layer === "quality" ? "quality" : "completeness";
    return { id: c.id, principle: c.principle, title: c.title, score, evidence, layer };
  });

  let cwSum = 0, cwScore = 0; // completeness
  let qwSum = 0, qwScore = 0; // quality
  const principleAcc = new Map<number, { sum: number; n: number }>();
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    const w = Number(checks[i]!.weight ?? 1);
    if (r.layer === "quality") {
      qwSum += w;
      qwScore += w * r.score;
    } else {
      cwSum += w;
      cwScore += w * r.score;
    }
    const acc = principleAcc.get(r.principle) ?? { sum: 0, n: 0 };
    acc.sum += r.score;
    acc.n += 1;
    principleAcc.set(r.principle, acc);
  }
  const aggregate = cwSum ? cwScore / cwSum : 0;
  const qualityAggregate = qwSum ? qwScore / qwSum : 0;
  return {
    harnessScore: Math.round(aggregate * 1000) / 10,
    aggregate,
    qualityScore: Math.round(qualityAggregate * 1000) / 10,
    qualityAggregate,
    results,
    byPrinciple: [...principleAcc.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([principle, v]) => ({ principle, score: v.sum / v.n })),
    source,
  };
}
