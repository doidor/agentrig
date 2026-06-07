import type { AgentProvider } from "./provider.js";
import { CopilotProvider } from "./copilot.js";
import { ClaudeProvider } from "./claude.js";

export type { AgentProvider, AgentConversation, ConversationOptions, AgentEvent } from "./provider.js";

/**
 * Resolve the agent provider. `AGENTRIG_PROVIDER` selects the backend (default `copilot`). The
 * Claude provider needs the optional `@anthropic-ai/claude-agent-sdk` package + `ANTHROPIC_API_KEY`.
 */
export function getProvider(name = process.env.AGENTRIG_PROVIDER ?? "copilot"): AgentProvider {
  switch (name) {
    case "copilot":
      return new CopilotProvider();
    case "claude":
      return new ClaudeProvider();
    default:
      throw new Error(`Unknown AgentRig provider "${name}". Supported: copilot, claude.`);
  }
}
