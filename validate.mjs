import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";

function section(markdown, name) {
  const headings = [...markdown.matchAll(/^##[ \t]+(.+)$/gm)];
  const heading = headings.find((match) =>
    match[1].replace(/[ \t]+#+[ \t]*$/, "").trim().toLowerCase() === name.toLowerCase()
  );
  if (!heading) return null;
  const next = headings.find((match) => match.index > heading.index);
  return markdown.slice(heading.index + heading[0].length, next?.index).trim();
}

function withoutYamlComment(raw) {
  let quote = null;
  let escaped = false;
  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];
    if (quote === '"' && char === "\\" && !escaped) {
      escaped = true;
      continue;
    }
    if (char === quote && !escaped) {
      if (quote === "'" && raw[i + 1] === "'") {
        i++;
        continue;
      }
      quote = null;
    } else if (!quote && (char === '"' || char === "'")) {
      quote = char;
    } else if (!quote && char === "#" && (i === 0 || /\s/.test(raw[i - 1]))) {
      return raw.slice(0, i).trim();
    }
    escaped = false;
  }
  return raw.trim();
}

function scalar(raw) {
  const text = withoutYamlComment(raw);
  if (text.startsWith('"')) {
    try {
      const value = JSON.parse(text);
      return typeof value === "string" && value.trim() ? value : null;
    } catch {
      return null;
    }
  }
  if (text.startsWith("'")) {
    return /^'(?:[^']|'')*'$/.test(text)
      ? text.slice(1, -1).replace(/''/g, "'").trim() || null
      : null;
  }
  return text && !/:\s|:$/.test(text) &&
      !/^(?:null|~|true|false|\[\]|\{\}|[+-]?\d+(?:\.\d+)?)$/i.test(text)
    ? text : null;
}

function inlineItems(text) {
  const items = [];
  let start = 0;
  let quote = null;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "\\" && quote === '"' && !escaped) {
      escaped = true;
      continue;
    }
    if (char === quote && !escaped) quote = null;
    else if (!quote && (char === '"' || char === "'")) quote = char;
    else if (!quote && char === ",") {
      items.push(text.slice(start, i));
      start = i + 1;
    }
    escaped = false;
  }
  if (quote) return null;
  items.push(text.slice(start));
  return items;
}

function textList(field) {
  if (!field) return null;
  const value = withoutYamlComment(field.value);
  let items;
  if (!value) {
    items = field.continuation.filter((line) => line.trim()).map((line) =>
      line.match(/^\s*-\s+(.+)$/)?.[1]
    );
  } else if (value.startsWith("[")) {
    items = value.endsWith("]") ? inlineItems(value.slice(1, -1)) : null;
  } else {
    items = value.startsWith("{") || value.startsWith("*") ? null : [value];
  }
  if (!items?.length) return null;
  const strings = items.map((item) => item === undefined ? null : scalar(item));
  return strings.every(Boolean) ? strings : null;
}

function frontmatter(markdown, path, errors) {
  const lines = markdown.split("\n");
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (lines[0] !== "---" || end < 0) {
    errors.push(`${path}: add YAML frontmatter delimited by --- at the start of the file.`);
    return null;
  }
  const fields = new Map();
  for (let i = 1; i < end; i++) {
    const match = lines[i].match(/^([a-z][a-z0-9-]*):[ \t]*(.*)$/i);
    if (!match) continue;
    const continuation = [];
    while (i + 1 < end && /^\s+/.test(lines[i + 1])) {
      continuation.push(lines[++i]);
    }
    if (fields.has(match[1])) {
      errors.push(`${path}: remove duplicate "${match[1]}" frontmatter field.`);
    } else {
      fields.set(match[1], { value: match[2], continuation });
    }
  }
  return { fields, body: lines.slice(end + 1).join("\n") };
}

function description(fields) {
  const field = fields.get("description");
  if (!field) return null;
  return /^[>|][+-]?$/.test(withoutYamlComment(field.value))
    ? field.continuation.join(" ").trim() || null
    : scalar(field.value);
}

function validGlob(pattern) {
  if (!pattern || pattern !== pattern.trim() || /[\x00-\x1f]/.test(pattern) ||
      pattern.startsWith("/") || /(^|\/)\.\.(\/|$)/.test(pattern)) return false;
  let brackets = 0;
  let braces = 0;
  for (const char of pattern) {
    if (char === "[") brackets++;
    if (char === "]") {
      brackets--;
      if (brackets < 0) return false;
    }
    if (char === "{") braces++;
    if (char === "}") {
      braces--;
      if (braces < 0) return false;
    }
  }
  return brackets === 0 && braces === 0;
}

function actionableGuidance(body) {
  const text = body
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#{3,}.*$/gm, "")
    .replace(/[`*_#>-]/g, " ")
    .replace(/\b(?:keep it simple(?:, stupid)?|don't repeat yourself|fail fast|least surprise)\b/gi, " ")
    .replace(/\s+/g, " ").trim();
  return (text.match(/\b[a-z]+\b/gi)?.length ?? 0) >= 9 &&
    /\b(?:choose|prefer|avoid|reject|extract|reuse|validate|stop|return|preserve|document|explain|check|use|remove|make|limit|defer|keep|require|handle|record)\b/i.test(text);
}

function runnableCommand(value) {
  const candidate = (value.match(/`([^`]+)`/)?.[1] ?? value).trim();
  return !/^(?:none|no|not|n\/a|todo|tbd|manual|see|read|run|pending|later|unavailable|tests?\s+(?:are|is|were|will|have|not|unavailable|missing|pending|suite))\b/i.test(candidate) &&
    /^(?:[a-z0-9_./+-]+)(?:\s|$)/i.test(candidate);
}

function checkCommands(commands, errors) {
  const lines = commands.split("\n").map((line) => line.replace(/\*\*/g, "").trim());
  for (const name of ["Build", "Test", "Lint"]) {
    const entry = lines.map((line) => {
      if (line.startsWith("|")) {
        const cells = line.split("|").map((cell) => cell.trim());
        return cells[1]?.toLowerCase() === name.toLowerCase() ? cells[2] : undefined;
      }
      return line.match(new RegExp(`^(?:[-*+]\\s*|\\d+\\.\\s*)?${name}\\s*:\\s*(.*)$`, "i"))?.[1];
    })
      .find((value) => value !== undefined);
    if (entry === undefined) {
      errors.push(`AGENTS.md: ## Commands needs a ${name}: entry.`);
    } else if (/^none\b/i.test(entry)) {
      const reason = entry.replace(/^none\b/i, "").replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, "");
      if (name === "Test" || !/[a-z]{3}/i.test(reason)) {
        errors.push(`AGENTS.md: ${name}: ${name === "Test" ? "provide a runnable test command, not none" : 'explain why "none" applies'}.`);
      }
    } else if (!runnableCommand(entry)) {
      errors.push(`AGENTS.md: ${name}: provide a runnable command${name === "Test" ? " (tests cannot be none or manual)" : ' or "none" with a reason'}.`);
    }
  }
}

function checkParanoid(markdown, path, errors) {
  if (!/\bindependen(?:t|tly|ce)\b/i.test(markdown) ||
      !/\b(?:without|do not|don't|never|avoid|no access to)\b[^\n.]{0,120}\b(?:other|earlier|prior|previous)\b[^\n.]{0,100}\b(?:review(?:er)?s?|conclusions|findings)\b/i.test(markdown)) {
    errors.push(`${path}: require independent review without reading other reviewers' conclusions first.`);
  }
  if (!/\b(?:read.only|do not (?:edit|write|modify)|don't (?:edit|write|modify)|never (?:edit|write|modify)|no (?:file |project )?edits)\b/i.test(markdown) ||
      !/\b(?:do not|don't|never|no)\b[^\n.]{0,90}\b(?:commit|push|upstream change)\b/i.test(markdown)) {
    errors.push(`${path}: require read-only review (no file edits or commits).`);
  }
  if (!/\b(?:confirmed|actionable)\b[^\n.]{0,100}\b(?:findings?|defects?)\b[^\n.]{0,100}\b(?:evidence|proof)\b/i.test(markdown) &&
      !/\b(?:evidence|proof)\b[^\n.]{0,100}\b(?:confirmed|actionable)\b[^\n.]{0,100}\b(?:findings?|defects?)\b/i.test(markdown)) {
    errors.push(`${path}: require evidence for confirmed, actionable findings.`);
  }
  if (!/\b(?:verify|reproduce|confirm|run)\b[\s\S]{0,220}\b(?:test|script|command)\b[\s\S]{0,180}\b(?:record|observed|result|output)\b/i.test(markdown)) {
    errors.push(`${path}: require verifying suspected defects with a test/script/command and recording its result.`);
  }
  if (!/\bconfirmed\b/i.test(markdown) || !/\bunverified\b/i.test(markdown) ||
      !/\b(?:separate|distinct|distinguish)\b[^\n.]{0,120}\b(?:unverified|leads|concerns)\b/i.test(markdown)) {
    errors.push(`${path}: separate confirmed findings from unverified leads.`);
  }
  if (!markdown.split("\n").some((line) =>
    /\b(?:finish|end|conclude)\b/i.test(line) && /\bscope\b/i.test(line) &&
    /\b(?:checks|tests|commands|results|validation)\b/i.test(line)
  )) {
    errors.push(`${path}: finish with inspected scope and checks/results (including validation not performed).`);
  }
}

function markdownFiles(repo, directory, errors) {
  let entries;
  try {
    entries = readdirSync(join(repo, directory), { withFileTypes: true });
  } catch (error) {
    if (error.code !== "ENOENT") {
      errors.push(`${directory}: cannot list installed assets (${error.message}).`);
    }
    return [];
  }
  return entries.flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(repo, path, errors);
    return entry.name.endsWith(".md") ? [path] : [];
  });
}

function hasEngineeringRuleLink(markdown) {
  const visible = markdown.replace(/<!--[\s\S]*?-->/g, "")
    .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, "");
  const codeSpans = [...visible.matchAll(/(`+)[^`\n]*?\1/g)];
  const outsideCode = (match) => codeSpans.every((span) =>
    match.index < span.index || match.index + match[0].length > span.index + span[0].length
  );

  if ([...visible.matchAll(/(?<!!)\[[^\]\n]+\]\(\s*(?:\.\/)?\.agents\/rules\/engineering-principles\.md(?:#[^\s)]+)?(?:\s+(?:"[^"\n]*"|'[^'\n]*'))?\s*\)/g)]
    .some(outsideCode)) return true;

  const references = new Set(
    [...visible.matchAll(/^ {0,3}\[([^\]\n]+)\]:[ \t]*(?:\.\/)?\.agents\/rules\/engineering-principles\.md(?:#[^\s]+)?[ \t]*$/gm)]
      .filter(outsideCode)
      .map((match) => match[1].trim().replace(/\s+/g, " ").toLowerCase())
  );
  return [...visible.matchAll(/(?<!!)\[([^\]\n]+)\]\[([^\]\n]*)\]/g)]
    .some((match) => references.has((match[2] || match[1]).trim().replace(/\s+/g, " ").toLowerCase()) && outsideCode(match));
}

function validate(repo) {
  const errors = [];
  const files = new Map();
  function read(path, required = false) {
    if (files.has(path)) return files.get(path);
    let markdown;
    try {
      markdown = readFileSync(join(repo, path), "utf8").replace(/\r\n/g, "\n");
    } catch (error) {
      errors.push(`${path}: ${error.code === "ENOENT"
        ? required ? "missing; create this required Core-profile file" : "missing installed asset; create it or remove its entry"
        : `cannot read file (${error.message})`}.`);
      files.set(path, null);
      return null;
    }
    files.set(path, markdown);
    const tokens = [...new Set(markdown.match(/(?<!\\)\{\{\s*[A-Za-z][A-Za-z0-9_]*\s*\}\}/g) ?? [])];
    if (tokens.length) errors.push(`${path}: replace unresolved placeholder(s) ${tokens.join(", ")}.`);
    return markdown;
  }

  const agents = read("AGENTS.md", true);
  if (agents !== null) {
    for (const name of ["Purpose", "Commands"]) {
      const body = section(agents, name);
      if (!body?.replace(/<!--[\s\S]*?-->/g, "").trim()) {
        errors.push(`AGENTS.md: add a nonempty ## ${name} section.`);
      } else if (name === "Commands") {
        checkCommands(body, errors);
      }
    }
    if (!hasEngineeringRuleLink(agents)) {
      errors.push("AGENTS.md: link to .agents/rules/engineering-principles.md instead of copying its guidance.");
    }
  }

  const builder = read(".agents/agents/builder.md", true);
  if (builder !== null && !builder.trim()) {
    errors.push(".agents/agents/builder.md: add the Builder prompt; the file is empty.");
  }
  const paranoidPath = ".agents/agents/paranoid.md";
  const paranoid = read(paranoidPath, true);
  if (paranoid !== null) checkParanoid(paranoid, paranoidPath, errors);

  const skillPaths = new Set([".agents/skills/self-verify/SKILL.md"]);
  try {
    for (const entry of readdirSync(join(repo, ".agents/skills"), { withFileTypes: true })) {
      const path = join(".agents/skills", entry.name);
      if (entry.isDirectory()) {
        skillPaths.add(join(path, "SKILL.md"));
      } else if (entry.isSymbolicLink()) {
        try {
          if (statSync(join(repo, path)).isDirectory()) {
            errors.push(`${path}: symlinked skill directories cannot be validated; use a real directory with SKILL.md or remove the link.`);
          }
        } catch (error) {
          errors.push(`${path}: broken or unreadable skill symlink (${error.message}); repair or remove it.`);
        }
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") errors.push(`.agents/skills: cannot list installed skills (${error.message}).`);
  }
  for (const path of skillPaths) {
    const markdown = read(path, path === ".agents/skills/self-verify/SKILL.md");
    if (markdown === null) continue;
    const parsed = frontmatter(markdown, path, errors);
    if (!parsed) continue;
    if (!description(parsed.fields)) {
      errors.push(`${path}: frontmatter needs a nonempty description (quote values containing ": ").`);
    }
    if (!textList(parsed.fields.get("allowed-tools"))) {
      errors.push(`${path}: frontmatter needs nonempty allowed-tools (quote values containing ": ").`);
    }
    if (!parsed.body.replace(/<!--[\s\S]*?-->/g, "").trim()) {
      errors.push(`${path}: add skill instructions after the frontmatter.`);
    }
  }

  const rulePath = ".agents/rules/engineering-principles.md";
  const requiredRules = [
    rulePath,
    ".agents/rules/security.md",
    ".agents/rules/code-review.md",
    ".agents/rules/no-debug-logging.md",
  ];
  const rulePaths = new Set(requiredRules);
  for (const path of markdownFiles(repo, ".agents/rules", errors)) {
    if (basename(path) !== "README.md") rulePaths.add(path);
  }
  for (const path of rulePaths) {
    const markdown = read(path, requiredRules.includes(path));
    if (markdown === null) continue;
    const parsed = frontmatter(markdown, path, errors);
    if (parsed) {
      if (!description(parsed.fields)) {
        errors.push(`${path}: frontmatter needs a nonempty description (quote values containing ": ").`);
      }
      const globs = textList(parsed.fields.get("globs"));
      if (!globs?.every(validGlob)) errors.push(`${path}: frontmatter needs valid, nonempty relative globs.`);
      if (!/^[1-9]\d*$/.test(withoutYamlComment(parsed.fields.get("priority")?.value ?? ""))) {
        errors.push(`${path}: frontmatter needs a positive integer priority.`);
      }
      if (requiredRules.includes(path) && !parsed.body.replace(/<!--[\s\S]*?-->/g, "").trim()) {
        errors.push(`${path}: add rule instructions after the frontmatter.`);
      }
    }
    if (path === rulePath) {
      for (const name of ["KISS", "DRY", "Fail fast", "Least surprise"]) {
        const body = section(parsed?.body ?? markdown, name);
        if (body === null) errors.push(`${path}: add a named ## ${name} section with actionable guidance.`);
        else if (!actionableGuidance(body)) {
          errors.push(`${path}: ## ${name} needs substantive action guidance, not just a slogan.`);
        }
      }
    }
  }

  for (const directory of [".agents/agents", ".agents/skills", ".agents/rules"]) {
    for (const path of markdownFiles(repo, directory, errors)) read(path);
  }
  return errors;
}

const args = process.argv.slice(2);
if (args.length > 1 || args[0]?.startsWith("-")) {
  console.error("Usage: node validate.mjs [repoPath] (one directory path; no options)");
  process.exitCode = 2;
} else {
  const label = args[0] ?? ".";
  const repo = resolve(label);
  let directory;
  try {
    directory = statSync(repo).isDirectory();
  } catch (error) {
    console.error(`Repository path ${JSON.stringify(label)}: ${error.message}`);
    process.exitCode = 2;
  }
  if (directory === false) {
    console.error(`Repository path ${JSON.stringify(label)}: not a directory.`);
    process.exitCode = 2;
  } else if (directory) {
    const errors = validate(repo);
    if (errors.length) {
      console.error(`Core profile invalid at ${repo}:\n${errors.map((error) => `- ${error}`).join("\n")}`);
      process.exitCode = 1;
    } else {
      console.log(`Core profile structurally valid at ${repo} (static checks only; commands and agent behavior were not run).`);
    }
  }
}
