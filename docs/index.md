---
title: AgentRig
description: One clear specification for a repository-local coding-agent harness, not another installer.
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
  <h2>One document, tailored to your repository</h2>
  <p class="site-section-lede">
    Point an agent at the <a href="./principles.html">AgentRig specification</a>.
    It inspects your repository, then adds only the instructions, skills, rules,
    and review roles that make sense there.
  </p>
  <div class="site-hero-spotlight">
    <h3>Not another agent runtime</h3>
    <p>No AgentRig CLI, installer, or model integration is required in your project.
    The canonical text and directly copyable assets are the product.</p>
  </div>
</section>

<section class="site-section">
  <h2>What you get</h2>
  <p class="site-section-lede">
    A small Core profile; more elaborate orchestration is a conditional recipe,
    not a default dependency.
  </p>
  <div class="site-feature-grid">
    <div class="site-feature">
      <span class="site-feature-icon" aria-hidden="true">&#x1F9ED;</span>
      <h3>Practical engineering principles</h3>
      <p>KISS, DRY, fail fast, and least surprise guide every change without
      adding another framework to your repository.</p>
    </div>
    <div class="site-feature">
      <span class="site-feature-icon" aria-hidden="true">&#x1F6E1;</span>
      <h3>Two complementary roles</h3>
      <p>Builder implements and self-verifies; an independent, read-only
      Paranoid reviewer checks for consequential defects.</p>
    </div>
    <div class="site-feature">
      <span class="site-feature-icon" aria-hidden="true">&#x1F9EA;</span>
      <h3>Evidence over ceremony</h3>
      <p>Run the repository's own checks, then use a dependency-free validator
      for structural conformance. It does not claim to prove agent behavior.</p>
    </div>
  </div>
</section>

<section class="site-section">
  <h2>Pick a starting point</h2>
  <div class="site-guide-grid">
    <a class="site-guide-card" href="./getting-started.html">
      <strong>Get started</strong>
      <span>Read the spec, inspect your repository, and install only the Core profile.</span>
    </a>
    <a class="site-guide-card" href="./principles.html">
      <strong>Principles and specification</strong>
      <span>The canonical contract, mirrored from AGENT-RIG.md.</span>
    </a>
    <a class="site-guide-card" href="./migration.html">
      <strong>Migrate from the old CLI</strong>
      <span>Understand the clean break without losing local customizations.</span>
    </a>
    <a class="site-guide-card" href="./llms.txt">
      <strong>Agent-readable pages</strong>
      <span>Plain-text versions of the site for agents and other tools.</span>
    </a>
  </div>
</section>
