import { CopilotClient, approveAll } from "@github/copilot-sdk";
import type { CopilotSession } from "@github/copilot-sdk";
import type {
  AgentConversation,
  AgentProvider,
  ConversationOptions,
  PreflightResult,
} from "./provider.js";

/**
 * AgentProvider backed by the GitHub Copilot SDK. Spawns the Copilot CLI runtime over stdio and
 * uses the logged-in user's credentials by default.
 */
export class CopilotProvider implements AgentProvider {
  readonly name = "copilot";

  async preflight(): Promise<PreflightResult> {
    const client = new CopilotClient({ logLevel: "none" });
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

  async startConversation(options: ConversationOptions): Promise<AgentConversation> {
    const client = new CopilotClient({
      workingDirectory: options.cwd,
      logLevel: "none",
    });
    await client.start();

    const session: CopilotSession = await client.createSession({
      ...(options.model ? { model: options.model } : {}),
      onPermissionRequest: approveAll,
      ...(options.systemMessage ? { systemMessage: { content: options.systemMessage } } : {}),
    });

    if (options.onEvent) {
      session.on("assistant.message", (event) => {
        const content = event.data?.content;
        if (content) options.onEvent!({ type: "assistant", text: content });
      });
      session.on("tool.execution_start", (event) => {
        const name = (event.data as { name?: string } | undefined)?.name;
        if (name) options.onEvent!({ type: "tool", text: name });
      });
    }

    const timeoutMs = options.timeoutMs ?? 15 * 60 * 1000;

    return {
      async send(prompt: string): Promise<string> {
        const result = await session.sendAndWait({ prompt }, timeoutMs);
        return result?.data?.content ?? "";
      },
      async end(): Promise<void> {
        await session.disconnect().catch(() => undefined);
        await client.stop().catch(() => undefined);
      },
    };
  }
}
