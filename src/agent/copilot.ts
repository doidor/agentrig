import { CopilotClient, approveAll } from "@github/copilot-sdk";
import type { CopilotSession } from "@github/copilot-sdk";
import {
  AgentTimeoutError,
  type AgentConversation,
  type AgentProvider,
  type ConversationOptions,
  type ModelValidationResult,
  type PreflightResult,
} from "./provider.js";

function summarizeArgs(args: Record<string, unknown> | undefined): string | undefined {
  if (!args) return undefined;
  for (const key of ["command", "path", "filePath", "pattern", "query", "url", "prompt"]) {
    const v = args[key];
    if (typeof v === "string" && v.length > 0) {
      return `${key}=${v.length > 60 ? v.slice(0, 57) + "…" : v}`;
    }
  }
  return undefined;
}

/**
 * AgentProvider backed by the GitHub Copilot SDK. Spawns the Copilot CLI runtime over stdio and
 * uses the logged-in user's credentials by default.
 */
export class CopilotProvider implements AgentProvider {
  readonly name = "copilot";

  async preflight(): Promise<PreflightResult> {
    const client = new CopilotClient({
      logLevel: "none",
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
    });
    try {
      await client.start();
      const status = await client.getAuthStatus();
      if (!status.isAuthenticated) {
        return { ok: false, detail: "not authenticated — run `copilot` once to sign in, or set GH_TOKEN" };
      }
      return { ok: true, detail: `authenticated as ${status.login ?? "user"} (${status.authType ?? "user"})` };
    } catch (err) {
      return { ok: false, detail: `could not start Copilot runtime: ${(err as Error).message}` };
    } finally {
      await client.stop().catch(() => undefined);
    }
  }

  async validateModel(modelId: string): Promise<ModelValidationResult> {
    const client = new CopilotClient({
      logLevel: "none",
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
    });
    try {
      await client.start();
      const models = await client.listModels();
      const ids = models.map((m) => m.id);
      if (ids.includes(modelId)) return { ok: true };
      // "did you mean…" — same family by prefix, sorted alphabetically.
      const prefix = modelId.split(/[-.]/)[0]!.toLowerCase();
      const near = ids.filter((id) => id.toLowerCase().startsWith(prefix)).sort();
      return {
        ok: false,
        available: ids.sort(),
        detail: near.length
          ? `Did you mean: ${near.slice(0, 5).join(", ")}?`
          : `Available: ${ids.slice(0, 8).join(", ")}${ids.length > 8 ? ", …" : ""}`,
      };
    } catch (err) {
      // If the listing call itself fails (offline, auth issue), don't block — let
      // startConversation surface the real error.
      return { ok: true, detail: `validateModel skipped: ${(err as Error).message}` };
    } finally {
      await client.stop().catch(() => undefined);
    }
  }

  async startConversation(options: ConversationOptions): Promise<AgentConversation> {
    const client = new CopilotClient({
      workingDirectory: options.cwd,
      logLevel: "none",
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
    });
    await client.start();

    const session: CopilotSession = await client.createSession({
      ...(options.model ? { model: options.model } : {}),
      onPermissionRequest: approveAll,
      ...(options.systemMessage ? { systemMessage: { content: options.systemMessage } } : {}),
    });

    const emit = options.onEvent;
    if (emit) {
      session.on("assistant.intent", (event) => {
        const intent = (event.data as { intent?: string } | undefined)?.intent;
        if (intent) emit({ type: "intent", text: intent });
      });
      session.on("assistant.reasoning", (event) => {
        const content = (event.data as { content?: string } | undefined)?.content;
        if (content) emit({ type: "reasoning", text: content });
      });
      session.on("tool.execution_start", (event) => {
        const data = event.data as { toolName?: string; arguments?: Record<string, unknown> } | undefined;
        if (data?.toolName) {
          const detail = summarizeArgs(data.arguments);
          emit({ type: "tool_start", text: data.toolName, ...(detail ? { detail } : {}) });
        }
      });
      session.on("tool.execution_complete", (event) => {
        const data = event.data as { success?: boolean; error?: { message?: string } } | undefined;
        emit({
          type: "tool_done",
          text: data?.success === false ? data.error?.message ?? "failed" : "ok",
          ok: data?.success !== false,
        });
      });
      session.on("assistant.message", (event) => {
        const content = event.data?.content;
        if (content) emit({ type: "assistant", text: content });
      });
      session.on("session.compaction_start", () => {
        emit({ type: "compaction", text: "compacting context…" });
      });
    }

    const inactivityMs = options.inactivityMs ?? 5 * 60 * 1000;
    const maxMs = options.maxMs ?? 45 * 60 * 1000;

    return {
      // Wait for the turn to go idle, but only abort on genuine inactivity (no events for
      // inactivityMs) or an absolute cap. This keeps long, productive multi-agent runs alive
      // instead of killing them at a fixed total timeout.
      send(prompt: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
          let finalContent = "";
          let lastActivity = Date.now();
          const startedAt = Date.now();
          let settled = false;

          const offActivity = session.on(() => {
            lastActivity = Date.now();
          });
          const offMessage = session.on("assistant.message", (event) => {
            const content = event.data?.content;
            if (content) finalContent = content;
          });
          const offIdle = session.on("session.idle", () => finish(() => resolve(finalContent)));

          const watch = setInterval(() => {
            const idleFor = Date.now() - lastActivity;
            const totalFor = Date.now() - startedAt;
            if (idleFor >= inactivityMs) {
              finish(() => {
                void session.abort().catch(() => undefined);
                reject(new AgentTimeoutError("no agent activity for " + Math.round(inactivityMs / 1000) + "s", "inactivity"));
              });
            } else if (totalFor >= maxMs) {
              finish(() => {
                void session.abort().catch(() => undefined);
                reject(new AgentTimeoutError("exceeded max turn time of " + Math.round(maxMs / 60000) + "m", "absolute"));
              });
            }
          }, 5000);
          if (watch.unref) watch.unref();

          function finish(action: () => void): void {
            if (settled) return;
            settled = true;
            clearInterval(watch);
            offActivity();
            offMessage();
            offIdle();
            action();
          }

          session.send({ prompt }).catch((err) => finish(() => reject(err)));
        });
      },
      async end(): Promise<void> {
        await session.disconnect().catch(() => undefined);
        await client.stop().catch(() => undefined);
      },
    };
  }
}
