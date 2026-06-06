import { existsSync, statSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { readText } from "./fsutil.js";
import { loadCanonicalChecks, type CheckDef } from "./knowledge.js";

export interface CheckResult {
  id: string;
  principle: number;
  title: string;
  score: number; // 0 | 0.5 | 1
  evidence: string;
}

export interface AuditReport {
  harnessScore: number; // percent 0..100
  aggregate: number; // 0..1
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
    case "roles-distinct-models": {
      const key = String(c.key ?? "model");
      const dev = extractValue(read(String(c.developer)), key);
      const rev = extractValue(read(String(c.reviewer)), key);
      if (!dev || !rev) return { score: 0, evidence: "developer/reviewer model not declared" };
      return dev !== rev
        ? { score: 1, evidence: "" }
        : { score: 0.5, evidence: `developer and reviewer share model "${dev}"` };
    }
    default:
      return { score: 0, evidence: `unknown check type ${c.type}` };
  }
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
    return { id: c.id, principle: c.principle, title: c.title, score, evidence };
  });

  let wSum = 0;
  let wScore = 0;
  const principleAcc = new Map<number, { sum: number; n: number }>();
  for (let i = 0; i < results.length; i++) {
    const w = Number(checks[i]!.weight ?? 1);
    wSum += w;
    wScore += w * results[i]!.score;
    const acc = principleAcc.get(results[i]!.principle) ?? { sum: 0, n: 0 };
    acc.sum += results[i]!.score;
    acc.n += 1;
    principleAcc.set(results[i]!.principle, acc);
  }
  const aggregate = wSum ? wScore / wSum : 0;
  return {
    harnessScore: Math.round(aggregate * 1000) / 10,
    aggregate,
    results,
    byPrinciple: [...principleAcc.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([principle, v]) => ({ principle, score: v.sum / v.n })),
    source,
  };
}
