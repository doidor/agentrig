import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url));
const site = (path) => readFileSync(new URL(`../site/${path}`, import.meta.url));

const assets = [
  [".agents/agents/builder.md", "core/agents/builder.md"],
  [".agents/agents/paranoid.md", "core/agents/paranoid.md"],
  [".agents/skills/self-verify/SKILL.md", "core/skills/self-verify/SKILL.md"],
  [".agents/rules/engineering-principles.md", "core/rules/engineering-principles.md"],
  ["validate.mjs", "core/validate.mjs"],
];

test("llms index links all Core assets from the same build, byte for byte", () => {
  const index = site("llms.txt").toString("utf8");
  assert.equal(index.split("## Core files (verbatim, from this site build)").length, 2);
  for (const [path, published] of assets) {
    assert.ok(index.includes(`](./${published}): ${path}`), `${path} missing from llms.txt`);
    assert.deepEqual(site(published), source(path), `${published} diverged from ${path}`);
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

test("onboarding points to llms.txt instead of a repository clone", () => {
  const home = site("index.html").toString("utf8");
  const start = source("docs/getting-started.md").toString("utf8");
  assert.match(home, /href="\.\/llms\.txt"/);
  assert.match(start, /http:\/\/localhost:8000\/llms\.txt/);
  assert.doesNotMatch(home + start, /git clone|npx\s+@doidor\/agentrig\s+init/i);
});
