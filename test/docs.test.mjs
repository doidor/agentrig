import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url));
const site = (path) => readFileSync(new URL(`../site/${path}`, import.meta.url));

const coreAssets = [
  [".agents/agents/builder.md", "core/agents/builder.md"],
  [".agents/agents/paranoid.md", "core/agents/paranoid.md"],
  [".agents/skills/self-verify/SKILL.md", "core/skills/self-verify/SKILL.md"],
  [".agents/rules/engineering-principles.md", "core/rules/engineering-principles.md"],
  [".agents/rules/security.md", "core/rules/security.md"],
  [".agents/rules/code-review.md", "core/rules/code-review.md"],
  [".agents/rules/no-debug-logging.md", "core/rules/no-debug-logging.md"],
  ["validate.mjs", "core/validate.mjs"],
];
const optionalSkills = [
  [".agents/skills/fix-ci/SKILL.md", "core/skills/fix-ci/SKILL.md"],
  [".agents/skills/address-review-comments/SKILL.md", "core/skills/address-review-comments/SKILL.md"],
  [".agents/skills/resolve-conflicts/SKILL.md", "core/skills/resolve-conflicts/SKILL.md"],
  [".agents/skills/log-gotcha/SKILL.md", "core/skills/log-gotcha/SKILL.md"],
];

test("llms index links Core and optional assets from the same build, byte for byte", () => {
  const index = site("llms.txt").toString("utf8");
  assert.equal(index.split("## Core files (verbatim, from this site build)").length, 2);
  assert.equal(index.split("## Optional skills (choose only when relevant)").length, 2);
  const [coreSection, optionalSection] = index.split("## Optional skills (choose only when relevant)");
  for (const [path, published] of [...coreAssets, ...optionalSkills]) {
    const section = coreAssets.some(([required]) => required === path) ? coreSection : optionalSection;
    assert.ok(section.includes(`](./${published}): ${path}`), `${path} missing from its llms.txt section`);
    assert.deepEqual(site(published), source(path), `${published} diverged from ${path}`);
  }
  assert.equal([...index.matchAll(/^\- \[[^\]]+\]\(\.\/core\/[^)]+\):/gm)].length, 12);
});

test("published catalog covers every retained native skill and rule", () => {
  const skills = readdirSync(new URL("../.agents/skills/", import.meta.url), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("markbook-"))
    .map((entry) => `.agents/skills/${entry.name}/SKILL.md`);
  const rules = readdirSync(new URL("../.agents/rules/", import.meta.url), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md")
    .map((entry) => `.agents/rules/${entry.name}`);
  const published = [...coreAssets, ...optionalSkills]
    .map(([path]) => path)
    .filter((path) => path.startsWith(".agents/skills/") || path.startsWith(".agents/rules/"));
  assert.deepEqual(published.sort(), [...skills, ...rules].sort());
});

test("the expanded Core contract has a versioned migration path", () => {
  assert.match(source("AGENT-RIG.md").toString("utf8"), /\*\*Specification version:\*\* 2\.0/);
  const migration = source("MIGRATION.md").toString("utf8");
  for (const rule of ["security.md", "code-review.md", "no-debug-logging.md"]) {
    assert.ok(migration.includes(rule), `${rule} is missing from the Core 2.0 upgrade guidance`);
  }
});

test("relative links work at localhost root and at the deployed /agentrig/ path", () => {
  const pages = [
    "llms.txt", "llms/index.txt", "llms/getting-started.txt",
    "llms/principles.txt", "llms/migration.txt",
    "index.html", "getting-started.html", "principles.html", "migration.html",
  ];
  for (const base of ["http://localhost:8000/", "https://tudorpopa.com/agentrig/"]) {
    const prefix = new URL(base).pathname;
    for (const page of pages) {
      const body = site(page).toString("utf8");
      const links = [
        ...body.matchAll(/\]\((\.{1,2}\/[^)\s]+)\)/g),
        ...body.matchAll(/\bhref="(\.{1,2}\/[^"]+)"/g),
      ];
      for (const [, link] of links) {
        const destination = new URL(link, new URL(page, base));
        assert.ok(destination.pathname.startsWith(prefix), `${page}: ${link} escapes ${prefix}`);
        const file = destination.pathname.slice(prefix.length);
        assert.ok(existsSync(new URL(`../site/${file}`, import.meta.url)), `${page}: ${link} is missing`);
      }
    }
  }
});

test("onboarding shows the reviewed one-sentence prompt with the configured domain", () => {
  const config = source("markbook.config.ts").toString("utf8");
  const siteUrl = config.match(/\bsiteUrl:\s*"([^"]+)"/)?.[1];
  assert.ok(siteUrl, "markbook.config.ts needs a siteUrl");
  const prompt = `Read ${siteUrl}/llms.txt, tailor its Core harness to this repo without overwriting existing work, run the repo’s checks and validator, and request an independent Paranoid review.`;
  const home = site("index.html").toString("utf8");
  const start = source("docs/getting-started.md").toString("utf8");
  const readme = source("README.md").toString("utf8");
  const spec = source("AGENT-RIG.md").toString("utf8");
  assert.ok(home.includes(`<div class="site-install" role="text">${prompt}</div>`));
  assert.ok(start.includes(prompt));
  assert.ok(readme.includes(prompt));
  assert.ok(spec.includes(`${siteUrl}/llms.txt`));
  assert.doesNotMatch(home + start + readme + spec, /http:\/\/localhost:8000\/llms\.txt|git clone|npx\s+@doidor\/agentrig\s+init/i);
});
