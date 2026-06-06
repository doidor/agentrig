import { color, log, isVerbose } from "./logger.js";
import type { AgentEvent } from "../agent/index.js";

function truncate(s: string, n: number): string {
  const oneLine = s.replace(/\s+/g, " ").trim();
  return oneLine.length > n ? oneLine.slice(0, n - 1) + "…" : oneLine;
}

/**
 * Renders the agent's live activity (intents, tool calls, reasoning, narration) as timestamped
 * lines, and emits a heartbeat so long, quiet steps never look frozen. Pass its `handle` as the
 * conversation's `onEvent`.
 */
export class ActivityMonitor {
  private readonly startMs = Date.now();
  private lastEventMs = Date.now();
  private toolCount = 0;
  private lastLabel = "thinking…";
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly verbose = isVerbose();

  constructor(private readonly heartbeatSeconds = 15) {}

  private elapsed(): string {
    const s = Math.floor((Date.now() - this.startMs) / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s`;
  }

  private line(symbol: string, text: string): void {
    log.activity(`[${this.elapsed()}] ${symbol} ${text}`);
  }

  /** Start the heartbeat. Call `stop()` when the step completes. */
  start(): this {
    this.timer = setInterval(() => {
      const quietFor = Math.floor((Date.now() - this.lastEventMs) / 1000);
      if (quietFor >= this.heartbeatSeconds) {
        this.line("·", `still working — ${this.toolCount} tool calls so far, last: ${this.lastLabel}`);
        this.lastEventMs = Date.now();
      }
    }, this.heartbeatSeconds * 1000);
    if (this.timer.unref) this.timer.unref();
    return this;
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Bind for use as `onEvent`. */
  readonly handle = (e: AgentEvent): void => {
    this.lastEventMs = Date.now();
    switch (e.type) {
      case "intent":
        this.lastLabel = truncate(e.text, 50);
        this.line(color.cyan("▸"), truncate(e.text, 100));
        break;
      case "tool_start":
        this.toolCount++;
        this.lastLabel = e.text;
        this.line("⚙", `${e.text}${e.detail ? color.dim(" · " + truncate(e.detail, 60)) : ""}`);
        break;
      case "tool_done":
        if (e.ok === false) this.line(color.red("✗"), `tool failed: ${truncate(e.text, 80)}`);
        else if (this.verbose) this.line(color.dim("✓"), "ok");
        break;
      case "assistant":
        // Intermediate narration between tool batches — show a short summary.
        this.line(color.dim("…"), truncate(e.text, 100));
        break;
      case "reasoning":
        if (this.verbose) this.line(color.dim("~"), truncate(e.text, 100));
        break;
      case "compaction":
        this.line(color.yellow("⟳"), e.text);
        break;
    }
  };
}
