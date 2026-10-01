---
globs: ["**/*"]
description: Apply practical KISS, DRY, fail-fast, and least-surprise decisions to every change.
priority: 3
---

# Engineering principles

Correctness, security, and explicit requirements outrank these heuristics. Resolve tradeoffs
without sacrificing required behavior or hiding failures.

## KISS

- Implement the simplest design that fully meets today's observed requirements, including error
  cases. Prefer a direct change in an existing path to speculative layers, configuration, or tools.
- Remove unnecessary moving parts, but never call a shortcut "simple" if it weakens correctness,
  security, or required verification.

## DRY

- Keep each stable contract, policy, and piece of knowledge in one authoritative place; reuse
  existing helpers when they express the same behavior.
- Extract shared logic only when repeated behavior is demonstrably identical and the abstraction
  is easier to understand than its call sites. Prefer a small amount of obvious duplication over
  a premature generic abstraction; consolidate when the shared concept becomes stable.

## Fail fast

- Validate untrusted input and required invariants at the boundary; reject invalid state with
  actionable errors before making partial changes.
- Do not swallow failures, silently invent defaults, or return success-shaped fallbacks. Preserve
  an explicitly required graceful-degradation path and make its limitations visible.

## Least surprise

- Preserve established inputs, outputs, defaults, and repository conventions unless the request
  intentionally changes them. Trace callers and cover behavior shifts with focused checks.
- Document intentional breaking changes and their migration path; do not conceal a clean break as
  a compatible update or introduce unexpected side effects.
