import type { AgentProvider } from "./provider.js";
import { CopilotProvider } from "./copilot.js";

export type { AgentProvider, AgentConversation, ConversationOptions, AgentEvent } from "./provider.js";

/**
 * Resolve the agent provider. Copilot is the only backend today; `AGENTRIG_PROVIDER=copilot` is the
 * default. A `claude` provider can be slotted in here later.
 */
export function getProvider(name = process.env.AGENTRIG_PROVIDER ?? "copilot"): AgentProvider {
  switch (name) {
    case "copilot":
      return new CopilotProvider();
    default:
      throw new Error(`Unknown AgentRig provider "${name}". Supported: copilot.`);
  }
}
