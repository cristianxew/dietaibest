import type { AgentContext } from "./context";
import type { AgentEvent } from "./events";
import { StreamingGuardrail } from "./nutrition-guardrail";
import type {
  ConversationTurnItem,
  LlmProvider,
  ProviderStreamEvent,
} from "./llm-provider";
import type { ConversationStore } from "./conversation-store";
import type { AnyTool, ToolEmit } from "./tools/types";
import { buildSystemPrompt } from "./system-prompt";

/**
 * Agent Runtime (DIE-33).
 *
 * Stateless. Constructed once with collaborators (LlmProvider, ConversationStore)
 * and a tool concurrency cap. Every `run()` call is independent; nothing
 * captured between turns.
 *
 * Contract:
 *  - input  : { ctx, userMessage }
 *  - output : AsyncIterable<AgentEvent> (domain events, not raw provider events)
 *
 * Responsibilities:
 *  - Load conversation history from store
 *  - Build system prompt for ctx.locale
 *  - Proactively filter tools by ctx.entitlements (Layer A of hybrid C+B)
 *  - Stream model output, transform provider events → AgentEvent
 *  - Dispatch tool calls in-turn with concurrency cap (default 4)
 *  - Defensive entitlement re-check at dispatch (Layer B of hybrid C+B)
 *  - Run streaming nutrition guardrail across text deltas
 *  - Persist user+assistant turns through ConversationStore at end of run
 *  - Handle confirmation requests for destructive tools
 */

export interface RuntimeDeps {
  llm: LlmProvider;
  store: ConversationStore;
  /**
   * Source-of-truth tool list. Runtime filters this per turn by ctx.entitlements
   * (Layer A of the hybrid C+B strategy) and re-checks defensively at dispatch
   * (Layer B). Injected so the runtime is decoupled from any specific registry
   * and stays testable without server-only imports.
   */
  tools: ReadonlyArray<AnyTool>;
  toolConcurrency?: number;
  maxToolLoops?: number;
}

export interface RunRequest {
  ctx: AgentContext;
  /**
   * The new user message. If empty/whitespace-only AND a pendingToolResolve
   * is provided, the runtime treats this as a confirmation-resume turn.
   */
  userMessage?: string;
  /**
   * If the previous turn emitted a `confirm.request`, the UI calls back with
   * this resolution so the deferred tool can actually run (or be skipped).
   */
  pendingResolve?: {
    callId: string;
    toolName: string;
    accepted: boolean;
    payload: unknown;
  };
}

/**
 * Minimal in-process concurrency limiter. Equivalent in semantics to the
 * `p-limit` package for our single use-site; kept inline to avoid a new dep
 * for one tool. Tool concurrency cap is the locked architecture decision.
 */
function createLimiter(max: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    if (active >= max) return;
    const task = queue.shift();
    if (task) {
      active++;
      task();
    }
  };

  return <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const run = () => {
        fn()
          .then((v) => {
            active--;
            next();
            resolve(v);
          })
          .catch((e) => {
            active--;
            next();
            reject(e);
          });
      };
      queue.push(run);
      next();
    });
}

export class AgentRuntime {
  private readonly llm: LlmProvider;
  private readonly store: ConversationStore;
  private readonly tools: ReadonlyArray<AnyTool>;
  private readonly toolsByName: ReadonlyMap<string, AnyTool>;
  private readonly limit: <T>(fn: () => Promise<T>) => Promise<T>;
  private readonly maxToolLoops: number;

  constructor(deps: RuntimeDeps) {
    this.llm = deps.llm;
    this.store = deps.store;
    this.tools = deps.tools;
    this.toolsByName = new Map(deps.tools.map((t) => [t.name, t]));
    this.limit = createLimiter(deps.toolConcurrency ?? 4);
    this.maxToolLoops = deps.maxToolLoops ?? 5;
  }

  private filterForContext(ctx: AgentContext): AnyTool[] {
    return this.tools.filter((tool) => {
      if (!tool.requiresFeature) return true;
      return ctx.entitlements.features[tool.requiresFeature] === true;
    });
  }

  private findTool(name: string): AnyTool | undefined {
    return this.toolsByName.get(name);
  }

  async *run(req: RunRequest, signal?: AbortSignal): AsyncIterable<AgentEvent> {
    const { ctx } = req;
    const history = await this.store.load(ctx.conversationId);
    const tools = this.filterForContext(ctx);

    const pendingPersist: ConversationTurnItem[] = [];

    // Step 1: append user message OR resolve pending confirmation.
    if (req.pendingResolve) {
      // The runtime previously paused on confirm.request and emitted a virtual
      // tool-call (callId, toolName). Now we run the real execute() with the
      // resolved payload (if accepted), and synthesise the matching turn item.
      if (req.pendingResolve.accepted) {
        const tool = this.findTool(req.pendingResolve.toolName);
        if (!tool) {
          yield {
            type: "tool.failed",
            toolName: req.pendingResolve.toolName,
            callId: req.pendingResolve.callId,
            reason: "generic",
          };
        } else {
          const callItem: ConversationTurnItem = {
            kind: "tool-call",
            callId: req.pendingResolve.callId,
            toolName: tool.name,
            input: req.pendingResolve.payload,
          };
          pendingPersist.push(callItem);
          history.push(callItem);
          yield* this.runOneTool(tool, callItem, ctx, history, pendingPersist);
        }
      }
      // After resolving (accepted or not), loop back into the LLM for an ack.
    }

    if (req.userMessage && req.userMessage.trim().length > 0) {
      const userItem: ConversationTurnItem = {
        kind: "text",
        role: "user",
        text: req.userMessage.trim(),
      };
      pendingPersist.push(userItem);
      history.push(userItem);
    }

    const systemPrompt = buildSystemPrompt(ctx.locale);
    const guardrail = new StreamingGuardrail();

    // Step 2: tool loop. Cap at maxToolLoops to avoid runaway tool ping-pong.
    let loops = 0;
    while (loops++ < this.maxToolLoops) {
      if (signal?.aborted) {
        yield { type: "error", message: "Cancelled" };
        await this.store.append(ctx.conversationId, pendingPersist);
        return;
      }

      let sawToolCall = false;
      const toolCallBatch: ConversationTurnItem[] = [];

      for await (const ev of this.llm.stream({
        systemPrompt,
        messages: history,
        tools,
        signal,
      })) {
        if (signal?.aborted) {
          yield { type: "error", message: "Cancelled" };
          await this.store.append(ctx.conversationId, pendingPersist);
          return;
        }

        const wrapped = await this.handleProviderEvent(ev, guardrail);
        for (const out of wrapped) yield out;

        if (ev.kind === "text-delta") {
          pendingPersist.push({
            kind: "text",
            role: "assistant",
            text: ev.text,
          });
          history.push({ kind: "text", role: "assistant", text: ev.text });
        }
        if (ev.kind === "tool-call") {
          sawToolCall = true;
          const item: ConversationTurnItem = {
            kind: "tool-call",
            callId: ev.callId,
            toolName: ev.toolName,
            input: ev.input,
          };
          toolCallBatch.push(item);
          pendingPersist.push(item);
          history.push(item);
        }
      }

      // Flush any guardrail buffer at end of model output.
      const tail = guardrail.flush();
      if (tail.text) yield { type: "text.delta", text: tail.text };
      if (guardrail.totalRedactions > 0) {
        yield { type: "guardrail.redacted", reason: "nutrition" };
      }

      if (!sawToolCall) break;

      // Execute the tools requested in this LLM turn.
      let cancelled = false;
      for (const call of toolCallBatch) {
        if (cancelled) break;
        if (call.kind !== "tool-call") continue;
        const tool = this.findTool(call.toolName);
        if (!tool) {
          yield {
            type: "tool.failed",
            toolName: call.toolName,
            callId: call.callId,
            reason: "generic",
          };
          continue;
        }

        // Confirmation gate. If the tool requires confirmation, emit a
        // confirm.request and STOP. The client will re-call run() with
        // pendingResolve once the user has answered.
        if (tool.requiresConfirmation) {
          const descriptor = await tool.requiresConfirmation(call.input, ctx);
          if (descriptor) {
            yield {
              type: "confirm.request",
              callId: call.callId,
              toolName: tool.name,
              message: descriptor.message,
              payload: descriptor.payload,
            };
            await this.store.append(ctx.conversationId, pendingPersist);
            return;
          }
        }

        yield* this.runOneTool(tool, call, ctx, history, pendingPersist, guardrail);
      }
    }

    yield { type: "finish" };
    await this.store.append(ctx.conversationId, pendingPersist);
  }

  /**
   * Wraps a single provider event into AgentEvent(s). For text deltas, runs
   * them through the streaming nutrition guardrail.
   */
  private async handleProviderEvent(
    ev: ProviderStreamEvent,
    guardrail: StreamingGuardrail
  ): Promise<AgentEvent[]> {
    if (ev.kind === "text-delta") {
      const result = guardrail.push(ev.text);
      const out: AgentEvent[] = [];
      if (result.text) out.push({ type: "text.delta", text: result.text });
      return out;
    }
    if (ev.kind === "tool-call") {
      const tool = this.findTool(ev.toolName);
      return [
        {
          type: "tool.invoked",
          toolName: ev.toolName,
          callId: ev.callId,
          statusKey: tool?.statusKey ?? "tool.invoked",
        },
      ];
    }
    if (ev.kind === "finish") {
      return [];
    }
    return [];
  }

  private async *runOneTool(
    tool: AnyTool,
    call: Extract<ConversationTurnItem, { kind: "tool-call" }>,
    ctx: AgentContext,
    history: ConversationTurnItem[],
    pendingPersist: ConversationTurnItem[],
    guardrail?: StreamingGuardrail
  ): AsyncIterable<AgentEvent> {
    // Defensive entitlement re-check (Layer B).
    if (tool.requiresFeature && !ctx.entitlements.features[tool.requiresFeature]) {
      yield {
        type: "tool.failed",
        toolName: tool.name,
        callId: call.callId,
        reason: "unauthorized",
        entitlement: { code: "PRO_ONLY", feature: tool.requiresFeature },
      };
      return;
    }

    let parsed: unknown;
    try {
      parsed = tool.inputSchema.parse(call.input);
    } catch {
      yield {
        type: "tool.failed",
        toolName: tool.name,
        callId: call.callId,
        reason: "generic",
      };
      return;
    }

    // Build an emit callback that buffers progress events into a queue.
    // The queue is drained as events arrive, interleaved before tool.completed.
    const progressQueue: AgentEvent[] = [];
    let progressNotify: (() => void) | null = null;

    const emit: ToolEmit = (e) => {
      progressQueue.push({
        type: "tool.progress",
        callId: call.callId,
        toolName: tool.name,
        statusKey: e.statusKey,
        payload: e.payload,
      });
      progressNotify?.();
    };

    // The pLimit is used for parallel scheduling when multiple tool calls
    // exist; here we still go through it so we share the cap across the run.
    const execPromise = this.limit(() => tool.execute(parsed as never, ctx, emit));

    // Race loop: yield buffered progress events as they arrive, finish when exec resolves.
    let toolResult: Awaited<ReturnType<AnyTool["execute"]>> | undefined;
    let execDone = false;

    execPromise.then(
      (r) => {
        toolResult = r;
        execDone = true;
        progressNotify?.();
      },
      (err) => {
        toolResult = { ok: false, reason: "generic", message: String(err) };
        execDone = true;
        progressNotify?.();
      }
    );

    while (!execDone || progressQueue.length > 0) {
      while (progressQueue.length > 0) {
        yield progressQueue.shift()!;
      }
      if (execDone) break;
      await new Promise<void>((resolve) => {
        progressNotify = resolve;
      });
    }

    // Flush any remaining events emitted right as the promise settled
    while (progressQueue.length > 0) {
      yield progressQueue.shift()!;
    }

    const result = toolResult!;

    if (!result.ok) {
      yield {
        type: "tool.failed",
        toolName: tool.name,
        callId: call.callId,
        reason: result.reason,
      };
      const resultItem: ConversationTurnItem = {
        kind: "tool-result",
        callId: call.callId,
        toolName: tool.name,
        result: { ok: false, reason: result.reason, message: result.message },
      };
      pendingPersist.push(resultItem);
      history.push(resultItem);
      return;
    }

    // If the tool returned grounded nutrition values, feed them to the guardrail
    // so the model's follow-up acknowledgement can reference them safely.
    const data = result.data as { groundedValues?: number[] } | undefined;
    if (guardrail && Array.isArray(data?.groundedValues)) {
      guardrail.addGroundedValues(data.groundedValues);
    }

    yield {
      type: "tool.completed",
      toolName: tool.name,
      callId: call.callId,
      link: result.link,
    };
    const resultItem: ConversationTurnItem = {
      kind: "tool-result",
      callId: call.callId,
      toolName: tool.name,
      result: { ok: true, data: result.data },
    };
    pendingPersist.push(resultItem);
    history.push(resultItem);
  }
}
