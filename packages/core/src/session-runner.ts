import { ulid } from "ulid";
import type { CoreDependencies, RunOptions, RunResult } from "./types";
import { modelToolCallToRequest } from "./types";
import { RunRegistry } from "./run-state";
import { ContextBuilder } from "./context-builder";
import { ModelRouter } from "./model-router";
import { ToolCallDispatcher } from "./tool-dispatcher";
import { EventPublisher } from "./event-publisher";
import { RunLedger } from "./run-ledger";

/** Default maximum model/tool loop iterations per run. */
const DEFAULT_MAX_ITERATIONS = 20;

/**
 * Orchestrates a single user prompt through the model/tool loop and produces
 * an assistant response.
 *
 * Responsibilities:
 *  - Persist the user message and assistant message.
 *  - Manage run lifecycle (start, complete, abort, fail).
 *  - Coordinate ContextBuilder → ModelRouter → ToolCallDispatcher loop.
 *  - Emit runtime events via EventPublisher.
 *  - Write audit entries via RunLedger.
 *  - Enforce one active run per session.
 *  - Respect abort signals (external and self-generated).
 *
 * Phase 6 constraints:
 *  - Uses StubModelProvider by default — real providers are future phases.
 *  - Permission check is a TODO placeholder at the tool dispatch layer.
 *  - No token-health enforcement (Phase 12).
 *  - No agent-mode selection (Phase 11).
 */
export class SessionRunner {
  private readonly runRegistry: RunRegistry;
  private readonly contextBuilder: ContextBuilder;
  private readonly modelRouter: ModelRouter;
  private readonly toolDispatcher: ToolCallDispatcher;
  private readonly deps: CoreDependencies;

  constructor(deps: CoreDependencies) {
    this.deps = deps;
    this.runRegistry = new RunRegistry();
    this.contextBuilder = new ContextBuilder(deps.messageRepository);
    this.modelRouter = new ModelRouter(deps.modelProvider);
    this.toolDispatcher = new ToolCallDispatcher(deps.toolRegistry);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Run a user prompt through the model/tool loop.
   *
   * Throws (rather than returning a failed result) only for programming errors
   * or concurrency violations. All runtime errors (model failure, tool failure,
   * abort) are captured in the returned RunResult.
   *
   * @param sessionId  Session to run within.
   * @param content    User message content.
   * @param options    Optional run configuration.
   * @returns          Completed run result with assistant message ID.
   */
  async run(
    sessionId: string,
    content: string,
    options: RunOptions = {}
  ): Promise<RunResult> {
    // ── Guard: verify session exists ─────────────────────────────────────────
    const session = this.deps.sessionRepository.findById(sessionId);
    if (session === undefined) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // ── Concurrency guard ────────────────────────────────────────────────────
    if (this.runRegistry.hasActive(sessionId)) {
      const active = this.runRegistry.get(sessionId)!;
      throw new Error(
        `Session ${sessionId} already has an active run (${active.runId}). ` +
          "Wait for it to complete or call abort() first."
      );
    }

    const runId = ulid();
    const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    const abortController = new AbortController();

    // Chain the caller's signal so external abort triggers ours as well.
    if (options.signal !== undefined) {
      if (options.signal.aborted) {
        return {
          runId,
          status: "aborted",
          error: "Run aborted before it started",
        };
      }
      options.signal.addEventListener("abort", () => abortController.abort());
    }

    const signal = abortController.signal;

    this.runRegistry.register({
      runId,
      sessionId,
      abortController,
      startedAt: new Date(),
    });

    const events = new EventPublisher(this.deps.eventBus, sessionId, runId);
    const ledger = new RunLedger(
      this.deps.ledgerRepository,
      sessionId,
      runId
    );

    events.publishRunStarted();
    ledger.recordRunStarted();

    try {
      return await this.executeLoop(
        sessionId,
        runId,
        content,
        options.systemPrompt,
        maxIterations,
        signal,
        events,
        ledger
      );
    } finally {
      this.runRegistry.remove(sessionId);
    }
  }

  /**
   * Abort the active run for a session.
   *
   * @returns `true` if a run was active and was aborted, `false` otherwise.
   */
  abort(sessionId: string): boolean {
    const active = this.runRegistry.get(sessionId);
    if (active === undefined) {
      return false;
    }
    active.abortController.abort();
    return true;
  }

  // ── Private orchestration ──────────────────────────────────────────────────

  private async executeLoop(
    sessionId: string,
    runId: string,
    userContent: string,
    systemPrompt: string | undefined,
    maxIterations: number,
    signal: AbortSignal,
    events: EventPublisher,
    ledger: RunLedger
  ): Promise<RunResult> {
    // ── Persist user message ─────────────────────────────────────────────────
    const userMessageId = ulid();
    this.deps.messageRepository.create({
      id: userMessageId,
      sessionId,
      runId,
      role: "user",
      content: userContent,
      contentFormat: "text",
      parentMessageId: null,
      createdAt: new Date().toISOString(),
      metadataJson: null,
      tokenCount: null,
    });
    events.publishMessageCreated(userMessageId, "user");

    // Update session lastRunAt.
    this.deps.sessionRepository.update(sessionId, {
      lastRunAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    let iteration = 0;
    let assistantMessageId: string | undefined;

    while (iteration < maxIterations) {
      // ── Abort check ────────────────────────────────────────────────────────
      if (signal.aborted) {
        ledger.recordRunAborted("signal");
        events.publishRunAborted("signal");
        return { runId, assistantMessageId, status: "aborted" };
      }

      iteration += 1;

      // ── Build context ──────────────────────────────────────────────────────
      // The user message for this run is already in storage, so we include it.
      const context = await this.contextBuilder.build(
        sessionId,
        systemPrompt
      );

      // ── Model call ─────────────────────────────────────────────────────────
      ledger.recordModelCallStarted(iteration);
      events.publishModelCallStarted(iteration);

      let modelResponse;
      try {
        modelResponse = await this.modelRouter.route(
          context,
          this.deps.toolRegistry.list(),
          signal
        );
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Unknown model error";

        // Check if abort is the cause.
        if (signal.aborted || (err instanceof DOMException && err.name === "AbortError")) {
          ledger.recordRunAborted("model_call_aborted");
          events.publishRunAborted("model_call_aborted");
          return { runId, assistantMessageId, status: "aborted" };
        }

        ledger.recordModelCallFailed(iteration, message);
        events.publishModelCallFailed(message);
        ledger.recordRunFailed(message);
        events.publishRunFailed(message);
        return { runId, assistantMessageId, status: "failed", error: message };
      }

      ledger.recordModelCallCompleted(iteration, modelResponse.usage);
      events.publishModelCallCompleted(modelResponse.usage);

      // ── Handle model response ──────────────────────────────────────────────
      const kind = modelResponse.kind;

      if (kind.type === "text") {
        // ── Text response: persist assistant message, end loop ───────────────
        assistantMessageId = ulid();
        this.deps.messageRepository.create({
          id: assistantMessageId,
          sessionId,
          runId,
          role: "assistant",
          content: kind.content,
          contentFormat: "text",
          parentMessageId: userMessageId,
          createdAt: new Date().toISOString(),
          metadataJson: null,
          tokenCount: modelResponse.usage?.outputTokens ?? null,
        });
        events.publishMessageCreated(assistantMessageId, "assistant");
        ledger.recordRunCompleted(assistantMessageId);
        events.publishRunCompleted(assistantMessageId);
        return { runId, assistantMessageId, status: "completed" };
      }

      // ── Tool calls: dispatch each, collect results, loop ──────────────────
      const toolCallResults = await this.dispatchToolCalls(
        sessionId,
        runId,
        kind.calls,
        signal,
        events,
        ledger
      );

      // Check for abort after tool dispatch.
      if (signal.aborted) {
        ledger.recordRunAborted("tool_dispatch_aborted");
        events.publishRunAborted("tool_dispatch_aborted");
        return { runId, assistantMessageId, status: "aborted" };
      }

      // Persist assistant tool-call message (the model's tool-use turn).
      const assistantToolMsgId = ulid();
      this.deps.messageRepository.create({
        id: assistantToolMsgId,
        sessionId,
        runId,
        role: "assistant",
        content: JSON.stringify(kind.calls),
        contentFormat: "json",
        parentMessageId: userMessageId,
        createdAt: new Date().toISOString(),
        metadataJson: JSON.stringify({ type: "tool_calls" }),
        tokenCount: null,
      });

      // Persist tool result messages so they appear in context on next loop.
      for (const result of toolCallResults) {
        const toolResultMsgId = ulid();
        this.deps.messageRepository.create({
          id: toolResultMsgId,
          sessionId,
          runId,
          role: "tool",
          content: result.error !== undefined
            ? JSON.stringify({ error: result.error })
            : JSON.stringify(result.result),
          contentFormat: "json",
          parentMessageId: assistantToolMsgId,
          createdAt: new Date().toISOString(),
          metadataJson: JSON.stringify({ toolCallId: result.modelCallId }),
          tokenCount: null,
        });
      }

      // Continue the loop — model will process tool results on next iteration.
    }

    // ── Max iterations exceeded ────────────────────────────────────────────
    ledger.recordMaxIterationsExceeded(maxIterations);
    ledger.recordRunFailed(`max_iterations_exceeded (${maxIterations})`);
    events.publishRunFailed("max_iterations_exceeded");
    return {
      runId,
      assistantMessageId,
      status: "failed",
      error: `Max iterations (${maxIterations}) exceeded without a final response`,
    };
  }

  /** Dispatch all tool calls from a single model response. */
  private async dispatchToolCalls(
    sessionId: string,
    runId: string,
    modelToolCalls: readonly import("@agent-workbench/models").ModelToolCall[],
    signal: AbortSignal,
    events: EventPublisher,
    ledger: RunLedger
  ): Promise<import("./types").ToolCallResult[]> {
    const results: import("./types").ToolCallResult[] = [];

    for (const modelCall of modelToolCalls) {
      if (signal.aborted) {
        break;
      }

      const storageId = ulid();
      const request = modelToolCallToRequest(modelCall, storageId);

      // ── Persist tool call record (requested) ────────────────────────────
      this.deps.toolCallRepository.create({
        id: storageId,
        sessionId,
        runId,
        messageId: null,
        toolName: request.name,
        status: "requested",
        inputJson: JSON.stringify(request.input),
        resultJson: null,
        errorJson: null,
        startedAt: new Date().toISOString(),
        completedAt: null,
        metadataJson: JSON.stringify({ modelCallId: request.modelCallId }),
      });

      ledger.recordToolCallRequested(storageId, request.name);
      events.publishToolCallRequested(storageId, request.name);

      // ── Dispatch ────────────────────────────────────────────────────────
      ledger.recordToolCallStarted(storageId, request.name);
      events.publishToolCallStarted(storageId, request.name);

      this.deps.toolCallRepository.update(storageId, { status: "running" });

      const result = await this.toolDispatcher.dispatch(request, signal);

      if (signal.aborted) {
        this.deps.toolCallRepository.update(storageId, {
          status: "aborted",
          completedAt: new Date().toISOString(),
          errorJson: JSON.stringify({ reason: "aborted" }),
        });
        events.publishToolCallAborted(storageId, request.name);
        break;
      }

      // ── Persist result ──────────────────────────────────────────────────
      if (result.error !== undefined) {
        this.deps.toolCallRepository.update(storageId, {
          status: "failed",
          completedAt: new Date().toISOString(),
          resultJson: null,
          errorJson: JSON.stringify({ error: result.error }),
        });
        ledger.recordToolCallFailed(storageId, request.name, result.error);
        events.publishToolCallFailed(storageId, request.name, result.error);
      } else {
        this.deps.toolCallRepository.update(storageId, {
          status: "completed",
          completedAt: new Date().toISOString(),
          resultJson: JSON.stringify(result.result),
          errorJson: null,
        });
        ledger.recordToolCallCompleted(storageId, request.name);
        events.publishToolCallCompleted(storageId, request.name);
      }

      results.push(result);
    }

    return results;
  }
}
