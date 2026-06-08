#!/usr/bin/env node
// Sync knowledge/PRINCIPLES.md into docs/principles.md with markbook frontmatter.
// Runs before `markbook build` / `markbook dev` so the docsite reflects the canonical
// PRINCIPLES.md without manual duplication or drift.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(repoRoot, "knowledge/PRINCIPLES.md");
const dst = resolve(repoRoot, "docs/principles.md");

const body = readFileSync(src, "utf8");
// Strip the first H1 — markbook will render the page title from the frontmatter.
const stripped = body.replace(/^#\s+.*\n+/, "");

const frontmatter = `---
title: Principles
description: The 12 principles AgentRig encodes — the contract a healthy agent harness should satisfy.
order: 5
---
`;

const out = `${frontmatter}
> This page is auto-generated from \`knowledge/PRINCIPLES.md\`. To change the principles, edit that file and re-run \`npm run docs:build\`.

${stripped}`;

mkdirSync(dirname(dst), { recursive: true });
writeFileSync(dst, out);
console.log(`✓ synced ${src} → ${dst}`);
