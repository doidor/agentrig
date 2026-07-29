import { defineConfig } from "@doidor/markbook-core";

export default defineConfig({
  // Site identity
  title: "AgentRig",
  description:
    "A meta-harness for agent harnesses — install best-practice agent rules, skills, and surfaces into any repo with one command.",
  siteUrl: "https://tudorpopa.com/agentrig",
  themeColor: "#0a1228",

  // Layout
  contentDir: "docs",
  outDir: "site",
  layoutsDir: "layouts",
});
