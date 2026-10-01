import { readFileSync, writeFileSync } from "node:fs";

const pages = [
  {
    source: "AGENT-RIG.md",
    destination: "principles.md",
    title: "Principles and specification",
    description: "The canonical AgentRig Core profile and implementation guidance.",
    order: 2,
  },
  {
    source: "MIGRATION.md",
    destination: "migration.md",
    title: "Migrating from the CLI",
    description: "The clean break from the former AgentRig CLI.",
    order: 3,
  },
];

for (const page of pages) {
  const source = readFileSync(new URL(`../${page.source}`, import.meta.url), "utf8");
  const body = source
    .replace(/\]\(AGENT-RIG\.md\)/g, "](./principles.html)")
    .replace(/\]\(MIGRATION\.md\)/g, "](./migration.html)")
    .replace(/\]\((\.agents\/[^)\s]+\.md)\)/g,
      (_, path) => `](./core/${path.slice(".agents/".length)})`);
  const unresolved = [...body.matchAll(/\]\((?!https?:\/\/|\.\/core\/)([^)#]+\.md)(?:#[^)]*)?\)/g)];
  if (unresolved.length) {
    throw new Error(`${page.source} has an unmapped local Markdown link: ${unresolved[0][1]}`);
  }
  writeFileSync(
    new URL(`../docs/${page.destination}`, import.meta.url),
    `---\ntitle: ${page.title}\ndescription: ${page.description}\norder: ${page.order}\n---\n\n${body}`,
  );
}
