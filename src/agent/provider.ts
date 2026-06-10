export type AgentEventType =
  | "intent"
  | "reasoning"
  | "tool_start"
  | "tool_done"
  | "assistant"
  | "compaction";

export interface AgentEvent {
  type: AgentEventType;
  /** Primary label, e.g. the tool name or a short text. */
  text: string;
  /** Optional secondary detail, e.g. a summary of tool arguments. */
  detail?: string;
  /** For tool_done: whether the tool succeeded. */
  ok?: boolean;
}

/** Thrown when a turn is aborted by the inactivity watchdog or the absolute cap. */
export class AgentTimeoutError extends Error {
  constructor(
    message: string,
    readonly kind: "inactivity" | "absolute",
  ) {
    super(message);
    this.name = "AgentTimeoutError";
  }
}

export interface ConversationOptions {
  cwd: string;
  model?: string;
  systemMessage?: string;
  /**
   * Abort the turn if no events arrive for this long. Productive long runs (which emit a steady
   * stream of events) are never killed — only genuine stalls. Defaults to 5 minutes.
   */
  inactivityMs?: number;
  /** Absolute safety cap on a single turn regardless of activity. Defaults to 45 minutes. */
  maxMs?: number;
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

export interface ModelValidationResult {
  ok: boolean;
  /** When ok=false, the closest matches the provider knows about (for "did you mean…" hints). */
  available?: string[];
  detail?: string;
}

/**
 * Abstraction over an agentic backend. The CopilotProvider implements this today; a ClaudeProvider
 * can be added later without touching command logic.
 */
export interface AgentProvider {
  readonly name: string;
  preflight(): Promise<PreflightResult>;
  /** Best-effort check that `modelId` exists. Optional — providers that can't list models
   *  should return `{ ok: true }` so the orchestrator falls through to runtime errors. */
  validateModel?(modelId: string): Promise<ModelValidationResult>;
  startConversation(options: ConversationOptions): Promise<AgentConversation>;
}
