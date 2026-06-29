---
title: AgentRig
description: A meta-harness for agent harnesses. Investigate any repo, install best-practice agent rules, skills, and surfaces — every agent reads from one source.
layout: landing
order: 0
---

<section class="site-section site-manifesto">
  <p class="site-manifesto-quote">
    In a world full of agentic factories, it's better to work <em>on</em> the factory,
    rather than <em>in</em> it.
  </p>
</section>

<section class="site-section">
  <h2>One source, every agent</h2>
  <p class="site-section-lede">
    AgentRig treats <strong>AGENTS.md</strong> + <code>.agents/rules/</code> as the single
    source of truth and compiles it into Copilot, Claude, Cursor, Codex, OpenCode, and MCP.
    Edit once; every surface updates.
  </p>
  <div class="site-hero-spotlight">
    <h3>Safe on existing repos</h3>
    <p><code>init</code> is non-destructive by default — your existing <code>AGENTS.md</code>,
    <code>.mcp.json</code>, and rules are preserved verbatim.
    <a href="./getting-started.html#adopting-agentrig-in-a-repo-that-already-has-an-agent-harness">Details →</a></p>
  </div>
</section>

<section class="site-section">
  <h2>What you get</h2>
  <p class="site-section-lede">
    A turnkey harness built around <a href="./principles.html">12 principles</a> from production
    agent systems — and a compiler that projects it into every surface.
  </p>
  <div class="site-feature-grid">
    <div class="site-feature">
      <div class="site-feature-icon">🧭</div>
      <h3>AGENTS.md as source of truth</h3>
      <p>Plain markdown. Glob-scoped reflex rules in <code>.agents/rules/</code>. No DSL.</p>
    </div>
    <div class="site-feature">
      <div class="site-feature-icon">🔁</div>
      <h3>Compiles to every surface</h3>
      <p>Projects into Copilot, Claude Code, Cursor, Codex, OpenCode, and VS Code MCP in one
      command. <a href="./agent-surfaces.html">Surface map →</a></p>
    </div>
    <div class="site-feature">
      <div class="site-feature-icon">🧱</div>
      <h3>12 principles, scaffolded</h3>
      <p>State machine, role prompts (triager / developer / reviewer / judge / security-reviewer), skills, rules,
      wiki — all editable. <a href="./principles.html">Read them →</a></p>
    </div>
    <div class="site-feature">
      <div class="site-feature-icon">🧪</div>
      <h3>Evals you can run</h3>
      <p>Install-completeness + quality probes (deterministic), plus fixture-based agentic eval
      with an independent judge and paired sign-test lift. <code>eval --scaffold</code> even
      generates the scenarios from <em>your</em> repo's stack — answer <em>"is this harness paying
      for the tokens it spends?"</em> with a real verdict. <a href="./evals.html">How →</a></p>
    </div>
    <div class="site-feature">
      <div class="site-feature-icon">📈</div>
      <h3>Live dashboard</h3>
      <p>Terminal or HTML. Agent roster, live GitHub tasks per harness label, audit score —
      offline.</p>
    </div>
    <div class="site-feature">
      <div class="site-feature-icon">🛡</div>
      <h3>No lock-in</h3>
      <p>Local files, MIT licensed, no hosted service. Switching primary agents is a config
      change, not a rewrite.</p>
    </div>
  </div>
</section>

<section class="site-section">
  <h2>Pick a starting point</h2>
  <div class="site-guide-grid">
    <a class="site-guide-card" href="./getting-started.html">
      <strong>Getting started →</strong>
      <span>Install, run <code>init</code>, see what lands in your repo. Five minutes.</span>
    </a>
    <a class="site-guide-card" href="./principles.html">
      <strong>The 12 principles →</strong>
      <span>The opinionated playbook AgentRig encodes.</span>
    </a>
    <a class="site-guide-card" href="./commands.html">
      <strong>Commands reference →</strong>
      <span><code>init</code>, <code>compile</code>, <code>update</code>, <code>doctor</code>,
      <code>eval</code>, <code>dashboard</code>.</span>
    </a>
    <a class="site-guide-card" href="./agent-surfaces.html">
      <strong>Agent surfaces →</strong>
      <span>Which files project where, and the symlink layout.</span>
    </a>
    <a class="site-guide-card" href="./evals.html">
      <strong>Evaluating the harness →</strong>
      <span>3 layers — install completeness, quality probes, fixture-based agentic eval with
      sign-test lift. Honest about what each does and does not prove.</span>
    </a>
    <a class="site-guide-card" href="https://github.com/doidor/agentrig">
      <strong>Source on GitHub →</strong>
      <span><code>doidor/agentrig</code> — issues, discussions, editable knowledge.</span>
    </a>
  </div>
</section>
