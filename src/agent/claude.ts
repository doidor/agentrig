import {
  AgentTimeoutError,
  type AgentConversation,
  type AgentProvider,
  type ConversationOptions,
  type PreflightResult,
} from "./provider.js";

// The Claude Agent SDK is an OPTIONAL peer dependency. A non-literal specifier keeps TypeScript
// from resolving it at build time, so AgentRig builds and runs without it installed.
const CLAUDE_SDK = "@anthropic-ai/claude-agent-sdk";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function loadSdk(): Promise<any> {
  try {
    return await import(CLAUDE_SDK);
  } catch {
    throw new Error(
      `Claude provider requires the optional package ${CLAUDE_SDK}. Install it: npm i ${CLAUDE_SDK}`,
    );
  }
}

function summarizeInput(input: Record<string, unknown> | undefined): string | undefined {
  if (!input) return undefined;
  for (const key of ["command", "file_path", "path", "pattern", "query", "url", "prompt"]) {
    const v = input[key];
    if (typeof v === "string" && v.length > 0) return `${key}=${v.length > 60 ? v.slice(0, 57) + "…" : v}`;
  }
  return undefined;
}

/**
 * AgentProvider backed by the Claude Agent SDK (`query()`), kept behind the same interface as the
 * Copilot provider. Selected via `AGENTRIG_PROVIDER=claude`. Auth via `ANTHROPIC_API_KEY`.
 */
export class ClaudeProvider implements AgentProvider {
  readonly name = "claude";

  async preflight(): Promise<PreflightResult> {
    try {
      await loadSdk();
    } catch (err) {
      return { ok: false, detail: (err as Error).message };
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return { ok: false, detail: "ANTHROPIC_API_KEY is not set" };
    }
    return { ok: true, detail: "Claude Agent SDK ready (ANTHROPIC_API_KEY set)" };
  }

  async startConversation(options: ConversationOptions): Promise<AgentConversation> {
    const sdk = await loadSdk();
    const emit = options.onEvent;
    const inactivityMs = options.inactivityMs ?? 5 * 60 * 1000;
    const maxMs = options.maxMs ?? 45 * 60 * 1000;
    let sessionId: string | undefined;

    return {
      async send(prompt: string): Promise<string> {
        const abort = new AbortController();
        let lastActivity = Date.now();
        const startedAt = Date.now();
        let timeoutKind: "inactivity" | "absolute" | null = null;

        const watch = setInterval(() => {
          if (Date.now() - lastActivity >= inactivityMs) {
            timeoutKind = "inactivity";
            abort.abort();
          } else if (Date.now() - startedAt >= maxMs) {
            timeoutKind = "absolute";
            abort.abort();
          }
        }, 5000);
        if (watch.unref) watch.unref();

        let finalText = "";
        try {
          const q = sdk.query({
            prompt,
            options: {
              cwd: options.cwd,
              permissionMode: "bypassPermissions",
              abortController: abort,
              ...(options.model ? { model: options.model } : {}),
              ...(options.systemMessage ? { systemPrompt: options.systemMessage } : {}),
              ...(sessionId ? { resume: sessionId } : {}),
            },
          });

          for await (const msg of q) {
            lastActivity = Date.now();
            if (msg.session_id) sessionId = msg.session_id;

            if (msg.type === "assistant" && msg.message?.content) {
              for (const block of msg.message.content) {
                if (block.type === "tool_use" && emit) {
                  const detail = summarizeInput(block.input as Record<string, unknown>);
                  emit({ type: "tool_start", text: block.name, ...(detail ? { detail } : {}) });
                } else if (block.type === "text" && block.text && emit) {
                  emit({ type: "assistant", text: block.text });
                }
              }
            } else if (msg.type === "result") {
              if (typeof msg.result === "string") finalText = msg.result;
            }
          }
        } catch (err) {
          if (timeoutKind) {
            throw new AgentTimeoutError(
              timeoutKind === "inactivity"
                ? `no agent activity for ${Math.round(inactivityMs / 1000)}s`
                : `exceeded max turn time of ${Math.round(maxMs / 60000)}m`,
              timeoutKind,
            );
          }
          throw err;
        } finally {
          clearInterval(watch);
        }

        if (timeoutKind) {
          throw new AgentTimeoutError(
            timeoutKind === "inactivity"
              ? `no agent activity for ${Math.round(inactivityMs / 1000)}s`
              : `exceeded max turn time of ${Math.round(maxMs / 60000)}m`,
            timeoutKind,
          );
        }
        return finalText;
      },
      async end(): Promise<void> {
        // query() is stateless per call; nothing to tear down.
      },
    };
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
