export interface AgentEvent {
  type: "assistant" | "tool" | "reasoning";
  text: string;
}

export interface ConversationOptions {
  cwd: string;
  model?: string;
  systemMessage?: string;
  /** Per-message wait timeout in ms. Defaults to a generous value for long agentic steps. */
  timeoutMs?: number;
  onEvent?: (event: AgentEvent) => void;
}

/**
 * A stateful exchange with an agent. The same conversation is reused across steps (investigate →
 * scaffold) so the agent keeps context about the repository.
 */
export interface AgentConversation {
  send(prompt: string): Promise<string>;
  end(): Promise<void>;
}

export interface PreflightResult {
  ok: boolean;
  detail: string;
}

/**
 * Abstraction over an agentic backend. The CopilotProvider implements this today; a ClaudeProvider
 * can be added later without touching command logic.
 */
export interface AgentProvider {
  readonly name: string;
  preflight(): Promise<PreflightResult>;
  startConversation(options: ConversationOptions): Promise<AgentConversation>;
}
