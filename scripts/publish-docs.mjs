import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const assets = [
  { source: ".agents/agents/builder.md", path: "core/agents/builder.md", name: "Builder prompt" },
  { source: ".agents/agents/paranoid.md", path: "core/agents/paranoid.md", name: "Paranoid prompt" },
  { source: ".agents/skills/self-verify/SKILL.md", path: "core/skills/self-verify/SKILL.md", name: "Self-verify skill" },
  { source: ".agents/rules/engineering-principles.md", path: "core/rules/engineering-principles.md", name: "Engineering principles rule" },
  { source: "validate.mjs", path: "core/validate.mjs", name: "Static validator" },
];

for (const asset of assets) {
  const destination = new URL(`../site/${asset.path}`, import.meta.url);
  mkdirSync(dirname(fileURLToPath(destination)), { recursive: true });
  copyFileSync(new URL(`../${asset.source}`, import.meta.url), destination);
}

for (const page of ["index", "getting-started", "principles", "migration"]) {
  const markdown = readFileSync(new URL(`../docs/${page}.md`, import.meta.url), "utf8");
  for (const match of markdown.matchAll(/\]\(\.\/(core\/[^)#]+)(?:#[^)]*)?\)/g)) {
    if (!existsSync(new URL(`../site/${match[1]}`, import.meta.url))) {
      throw new Error(`docs/${page}.md links to an unpublished Core file: ${match[1]}`);
    }
  }
}

const indexPath = new URL("../site/llms.txt", import.meta.url);
const index = readFileSync(indexPath, "utf8");
if (!index.includes("./llms/principles.txt")) {
  throw new Error("Markbook did not generate the specification entry in site/llms.txt");
}
if (index.includes("## Core files (verbatim, from this site build)")) {
  throw new Error("Core links were already published; rerun npm run docs:build to regenerate the index");
}
const links = assets.map((asset) => `- [${asset.name}](./${asset.path}): ${asset.source}`);
writeFileSync(indexPath, `${index.trimEnd()}

## Core files (verbatim, from this site build)

Fetch these links relative to this index URL. Copy the four Markdown files to
the listed target paths; download the validator to a temporary file and run it
with Node.js against the target repository. No AgentRig checkout is needed.

${links.join("\n")}
`);

for (const page of ["index", "getting-started", "principles", "migration"]) {
  const path = new URL(`../site/llms/${page}.txt`, import.meta.url);
  const text = readFileSync(path, "utf8")
    .replace(/\.\/(index|getting-started|principles|migration)\.html/g, (_, name) => `./${name}.txt`)
    .replace(/(?<!\.)\.\/llms\.txt/g, "../llms.txt")
    .replace(/(?<!\.)\.\/core\//g, "../core/");
  writeFileSync(path, text);
}
