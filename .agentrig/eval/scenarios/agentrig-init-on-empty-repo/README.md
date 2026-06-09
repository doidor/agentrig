# Scenario: AgentRig dogfood (the only scenario that tests the product itself)

Run `agentrig init --skip-agent` on a freshly-`git init`-ed repo with nothing
but a tiny `package.json` and a `README.md`. The oracle then verifies:

- **correctness**: the resulting harness audit clears the 80% install-completeness gate.
- **regression_risk**: running `agentrig compile` twice produces zero diff (idempotent).
- **tool_discipline**: every artifact declared in the manifest landed at the expected path.

This is the one scenario that fails when AgentRig itself regresses (broken
manifest, broken installer, broken compile, broken audit) — every other scenario
tests how an agent behaves *inside* a repo with AgentRig installed.

No model. No network. Runs in seconds.
