import { ulid } from "ulid";
import type { CoreDependencies, RunOptions, RunResult } from "./types";
import { modelToolCallToRequest } from "./types";
import { RunRegistry } from "./run-state";
import { ContextBuilder } from "./context-builder";
import { ModelRouter } from "./model-router";
import { ToolCallDispatcher } from "./tool-dispatcher";
import { EventPublisher } from "./event-publisher";
import { RunLedger } from "./run-ledger";
import type { ToolExecutionContext } from "@agent-workbench/tools";
import { assertSafePath } from "@agent-workbench/tools";
import { generateDiffPreview, extractDiffParams } from "@agent-workbench/diff";
import type { DiffPreview } from "@agent-workbench/protocol";
import { previewCommand } from "@agent-workbench/shell";
import type { CommandPreview } from "@agent-workbench/shell";
import type { AgentProfile } from "./agent";

/** Default maximum model/tool loop iterations per run. */
const DEFAULT_MAX_ITERATIONS = 20;

function truncateForSummary(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}

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
 * Phase 7 change:
 *  - Reads session.projectPath and passes it as projectRoot to each tool call
 *    via ToolExecutionContext.
 *
 * Phase 9 change:
 *  - Generates a diff preview for write/edit/apply_patch/revert_last_change
 *    BEFORE the permission gate so the preview is available in the permission
 *    request payload (docs/14 §7, decisions/0008, decisions/0015).
 *  - Includes diffSummaryJson in the persisted PermissionRequest row.
 *  - After successful dispatch, emits file.change_applied or revert events
 *    and records mutation ledger entries.
 *  - After successful dispatch, records revert-specific ledger events.
 *  - Cache invalidation is handled inside each mutation tool executor.
 *
 * Phase 8 change:
 *  - Evaluates permissions before every tool execution via PermissionEngine.
 *  - Deny: blocks execution, ledgers + emits permission.denied, updates tool_call to "denied".
 *  - Ask: persists PermissionRequest, emits permission.requested, pauses on
 *    PermissionGate, then continues (allow) or blocks (deny) after user decision.
 *    The server decision route emits permission.decided and records the ledger
 *    entry for user decisions. SessionRunner records permission.decided only for
 *    policy-level denies to avoid duplicate entries.
 *
 * Phase 6 constraints (unchanged):
 *  - Uses StubModelProvider by default — real providers are future phases.
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
    this.contextBuilder = new ContextBuilder(deps.messageRepository, deps.summaryRepository);
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

    // ── Resolve active agent ─────────────────────────────────────────────────
    // Phase 11: default to "build" when session.activeAgent is null/undefined.
    const resolvedAgentId =
      options.agentId ?? session.activeAgent ?? "build";
    const agentProfile = this.deps.agentRegistry.resolveActiveAgent(resolvedAgentId);
    const agentSystemPrompt =
      options.systemPrompt ?? agentProfile.systemPrompt;

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

    // Phase 11: record the active agent profile for this run.
    events.publishAgentProfileApplied(agentProfile.id);
    ledger.recordAgentProfileApplied(agentProfile.id, agentProfile.promptVersion);

    try {
      return await this.executeLoop(
        sessionId,
        runId,
        session.projectPath,
        content,
        agentSystemPrompt,
        maxIterations,
        signal,
        events,
        ledger,
        agentProfile
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

  /**
   * Phase 12: compute the current token health status for a session.
   * Delegates to TokenHealthService — server route handlers call this.
   */
  getTokenHealth(sessionId: string): {
    budget: number;
    used: number;
    remaining: number;
    threshold: number;
    utilizationPercent: number;
    level: string;
    isEstimate: boolean;
    compactionSuggested: boolean;
  } {
    const budget = this.deps.tokenHealthService.computeBudget(sessionId);
    const compaction = this.deps.tokenHealthService.suggestCompaction(sessionId);
    return {
      budget: budget.limit,
      used: budget.used,
      remaining: budget.remaining,
      threshold: budget.limit,
      utilizationPercent: budget.utilizationPercent,
      level: budget.level,
      isEstimate: budget.isEstimate,
      compactionSuggested: compaction.suggested,
    };
  }

  /**
   * Phase 12: generate and persist a session summary.
   * Requires user invocation — never runs automatically.
   * Emits and ledgers compaction.started/completed around persistence.
   */
  summarizeSession(sessionId: string): { summary: string } {
    const session = this.deps.sessionRepository.findById(sessionId);
    if (session === undefined) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const messages = this.deps.messageRepository.listBySession(sessionId);
    if (messages.length === 0) {
      throw new Error(`No messages to summarize in session ${sessionId}`);
    }

    const summaryRunId = ulid();
    const events = new EventPublisher(this.deps.eventBus, sessionId, summaryRunId);
    const ledger = new RunLedger(
      this.deps.ledgerRepository,
      sessionId,
      summaryRunId
    );

    events.publishCompactionStarted();
    ledger.recordCompactionStarted();

    const parts: string[] = [];
    parts.push(`Project: ${session.projectPath}`);

    const userMessages = messages.filter((m) => m.role === "user");
    if (userMessages.length > 0) {
      parts.push(`User goals: ${userMessages.map((m) => truncateForSummary(m.content, 200)).join("; ")}`);
    }

    const assistantMessages = messages.filter((m) => m.role === "assistant");
    if (assistantMessages.length > 0) {
      parts.push(`Assistant responses: ${assistantMessages.length} messages`);
    }

    const toolMessages = messages.filter((m) => m.role === "tool");
    if (toolMessages.length > 0) {
      parts.push(`Tool results: ${toolMessages.length} results`);
    }

    const summaryContent = parts.join("\n");

    const summaryId = ulid();
    this.deps.summaryRepository.create({
      id: summaryId,
      sessionId,
      runId: null,
      summaryType: "session",
      sourceRangeJson: null,
      content: summaryContent,
      qualityStatus: "unchecked",
      createdAt: new Date().toISOString(),
      metadataJson: JSON.stringify({
        messageCount: messages.length,
        generatedBy: "core",
      }),
    });

    events.publishCompactionCompleted(summaryId);
    ledger.recordCompactionCompleted(summaryId);

    return { summary: summaryContent };
  }

  // ── Private orchestration ──────────────────────────────────────────────────

  /**
   * Phase 12: compute token health, emit/ledger update, and emit/ledger
   * warning or compaction suggestion when budget level warrants it.
   *
   * Must be re-computed on every call; never stores mutable global state
   * on SessionRunner.
   */
  private emitTokenHealth(
    sessionId: string,
    events: EventPublisher,
    ledger: RunLedger
  ): void {
    const budget = this.deps.tokenHealthService.computeBudget(sessionId);
    const compaction = this.deps.tokenHealthService.suggestCompaction(sessionId);
    events.publishTokenHealthUpdated({
      budget: budget.limit,
      used: budget.used,
      remaining: budget.remaining,
      threshold: budget.limit,
      utilizationPercent: budget.utilizationPercent,
      level: budget.level,
      isEstimate: budget.isEstimate,
      compactionSuggested: compaction.suggested,
    });
    ledger.recordTokenHealthUpdated(
      budget.level,
      budget.used,
      budget.limit,
      budget.utilizationPercent
    );

    if (budget.level !== "healthy") {
      const warningMsg =
        budget.level === "critical"
          ? `Context nearly exhausted (${budget.utilizationPercent}% used)`
          : budget.level === "strained"
            ? `Context usage is high (${budget.utilizationPercent}% used)`
            : `Context usage is elevated (${budget.utilizationPercent}% used)`;
      events.publishTokenHealthWarning(budget.level, warningMsg);
      ledger.recordTokenHealthWarning(budget.level, warningMsg);
    }

    if (compaction.suggested) {
      events.publishCompactionSuggested(
        compaction.currentTokens,
        compaction.estimatedCompactedTokens,
        compaction.reason
      );
      ledger.recordCompactionSuggested(
        compaction.currentTokens,
        compaction.estimatedCompactedTokens
      );
    }
  }

  private async executeLoop(
    sessionId: string,
    runId: string,
    projectPath: string,
    userContent: string,
    agentSystemPrompt: string | undefined,
    maxIterations: number,
    signal: AbortSignal,
    events: EventPublisher,
    ledger: RunLedger,
    agentProfile: AgentProfile
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
      const context = await this.contextBuilder.build({
        sessionId,
        systemPrompt: undefined,
        agentSystemPrompt,
      });

      // Phase 12: compute and emit token health after context build.
      this.emitTokenHealth(sessionId, events, ledger);

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

      // Phase 12: re-compute token health after model usage is available.
      this.emitTokenHealth(sessionId, events, ledger);

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
        projectPath,
        kind.calls,
        signal,
        events,
        ledger,
        agentProfile
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
    projectPath: string,
    modelToolCalls: readonly import("@agent-workbench/models").ModelToolCall[],
    signal: AbortSignal,
    events: EventPublisher,
    ledger: RunLedger,
    agentProfile: AgentProfile
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

      // ── Phase 11: Tool availability enforcement by agent ──────────────────
      // Plan agent must not execute mutation tools. Block early with a deny
      // so no unnecessary previews are generated.
      if (!this.deps.agentRegistry.isToolAvailable(agentProfile.id, request.name)) {
        const reason = `Tool "${request.name}" is not available in ${agentProfile.mode} mode`;
        this.deps.toolCallRepository.update(storageId, {
          status: "denied",
          completedAt: new Date().toISOString(),
          errorJson: JSON.stringify({ error: reason }),
        });
        const permReqId = ulid();
        this.deps.permissionRepository.createRequest({
          id: permReqId,
          sessionId,
          runId,
          toolCallId: storageId,
          agentId: agentProfile.id,
          toolName: request.name,
          riskLevel: "high",
          reason,
          targetPathsJson: null,
          command: null,
          diffSummaryJson: null,
          dryRunSummaryJson: null,
          status: "denied",
          createdAt: new Date().toISOString(),
          expiresAt: null,
          metadataJson: null,
        });
        ledger.recordPermissionDeniedByPolicy(permReqId, request.name, reason);
        ledger.recordToolCallDenied(storageId, request.name, reason);
        events.publishPermissionDenied(permReqId, request.name, reason);
        events.publishToolCallFailed(storageId, request.name, `Permission denied: ${reason}`);
        results.push({
          id: storageId,
          modelCallId: request.modelCallId,
          name: request.name,
          result: null,
          error: `Permission denied: ${reason}`,
        });
        continue;
      }

      // ── Phase 10: Shell preview for bash tools ────────────────────────
      // For bash: generate a static command preview BEFORE the permission
      // gate. The preview classifies risk and detects destructive patterns
      // without executing the command. Preview failure for malformed input
      // is fatal — no execution without a valid preview.
      let commandPreview: CommandPreview | undefined;
      let command: string | undefined;
      let dryRunSummaryJson: string | null = null;

      if (request.name === "bash") {
        command = extractBashCommand(request.input);
        if (command === undefined || command.trim().length === 0) {
          const reason = "bash: missing or empty command";
          this.deps.toolCallRepository.update(storageId, {
            status: "failed",
            completedAt: new Date().toISOString(),
            errorJson: JSON.stringify({ error: reason }),
          });
          ledger.recordToolCallFailed(storageId, request.name, reason);
          events.publishToolCallFailed(storageId, request.name, reason);
          results.push({
            id: storageId,
            modelCallId: request.modelCallId,
            name: request.name,
            result: null,
            error: reason,
          });
          continue;
        }

        commandPreview = previewCommand(command, projectPath);
        dryRunSummaryJson = JSON.stringify({
          normalized: commandPreview.normalized,
          baseBinary: commandPreview.baseBinary,
          riskLevel: commandPreview.riskLevel,
          matchedRules: commandPreview.matchedRules,
        });

        ledger.recordShellCommandRequested(storageId, command);
        events.publishShellCommandRequested(storageId, commandPreview);
        ledger.recordShellRiskClassified(
          storageId,
          commandPreview.riskLevel,
          commandPreview.matchedRules
        );
        events.publishShellRiskClassified(
          storageId,
          commandPreview.riskLevel,
          commandPreview.matchedRules
        );
      }

      // ── Phase 9: Diff preview for mutation tools ──────────────────────
      // For write/edit/apply_patch: preview is REQUIRED before the permission
      // gate. Path safety (containment + sensitive-path) is enforced BEFORE
      // any file read to prevent unsafe reads of outside-project or denied paths.
      // If path safety fails or preview cannot be generated, the tool call is
      // failed immediately — execution never proceeds without a valid preview.
      //
      // revert_last_change does not need a pre-execution preview here; path
      // safety is enforced inside its own executor.
      let diffPreview: DiffPreview | undefined;
      let diffSummaryJson: string | null = null;

      if (DIFF_PREVIEW_REQUIRED.has(request.name)) {
        // 1. Extract typed params — fail early if the model gave malformed input.
        const params = extractDiffParams(request.name, request.input);
        if (params === undefined) {
          const reason = `${request.name}: cannot generate diff preview (malformed or incomplete input)`;
          this.deps.toolCallRepository.update(storageId, {
            status: "failed",
            completedAt: new Date().toISOString(),
            errorJson: JSON.stringify({ error: reason }),
          });
          ledger.recordToolCallFailed(storageId, request.name, reason);
          events.publishToolCallFailed(storageId, request.name, reason);
          results.push({
            id: storageId,
            modelCallId: request.modelCallId,
            name: request.name,
            result: null,
            error: reason,
          });
          continue;
        }

        // 2. Validate path safety BEFORE any file read.
        //    assertSafePath resolves the path against projectPath, checks
        //    project-root containment (including symlink resolution), and
        //    rejects sensitive paths (.env, .ssh, *.pem, etc.).
        let safePath: string;
        try {
          safePath = assertSafePath(params.path, projectPath);
        } catch (pathErr: unknown) {
          const reason = pathErr instanceof Error ? pathErr.message : String(pathErr);
          this.deps.toolCallRepository.update(storageId, {
            status: "failed",
            completedAt: new Date().toISOString(),
            errorJson: JSON.stringify({ error: reason }),
          });
          ledger.recordToolCallFailed(storageId, request.name, reason);
          events.publishToolCallFailed(storageId, request.name, reason);
          results.push({
            id: storageId,
            modelCallId: request.modelCallId,
            name: request.name,
            result: null,
            error: reason,
          });
          continue;
        }

        // 3. Generate diff preview with the validated, normalised path.
        //    Preview failure is fatal — do not silently continue to execution.
        const safeParams = { ...params, path: safePath };
        try {
          diffPreview = await generateDiffPreview(safeParams, projectPath);
          diffSummaryJson = JSON.stringify({
            id: diffPreview.id,
            path: diffPreview.path,
            linesAdded: diffPreview.linesAdded,
            linesRemoved: diffPreview.linesRemoved,
            patchLength: diffPreview.patch.length,
          });
          // Emit diff.preview_created so TUI can open the DiffViewer.
          ledger.recordDiffPreviewCreated(
            storageId,
            request.name,
            diffPreview.path,
            diffPreview.id
          );
          events.publishDiffPreviewCreated(storageId, request.name, diffPreview);
        } catch (previewErr: unknown) {
          const reason = `${request.name}: diff preview failed: ${
            previewErr instanceof Error ? previewErr.message : String(previewErr)
          }`;
          this.deps.toolCallRepository.update(storageId, {
            status: "failed",
            completedAt: new Date().toISOString(),
            errorJson: JSON.stringify({ error: reason }),
          });
          ledger.recordToolCallFailed(storageId, request.name, reason);
          events.publishToolCallFailed(storageId, request.name, reason);
          results.push({
            id: storageId,
            modelCallId: request.modelCallId,
            name: request.name,
            result: null,
            error: reason,
          });
          continue;
        }
      }

      // ── Phase 8: Permission evaluation ─────────────────────────────────
      const targetPaths = extractTargetPaths(request.input);
      const evalResult = this.deps.permissionEngine.evaluate({
        toolName: request.name,
        ...(targetPaths !== undefined ? { targetPaths } : {}),
        ...(command !== undefined ? { command } : {}),
        agentId: agentProfile.id,
      });

      if (evalResult.outcome === "deny") {
        // Policy-level deny — block execution immediately.
        const permReqId = ulid();
        this.deps.toolCallRepository.update(storageId, {
          status: "denied",
          completedAt: new Date().toISOString(),
          errorJson: JSON.stringify({ error: evalResult.reason }),
        });

        // Persist a minimal permission request record for auditability.
        this.deps.permissionRepository.createRequest({
          id: permReqId,
          sessionId,
          runId,
          toolCallId: storageId,
          agentId: agentProfile.id,
          toolName: request.name,
          riskLevel: evalResult.riskLevel,
          reason: evalResult.reason,
          targetPathsJson: targetPaths !== undefined ? JSON.stringify(targetPaths) : null,
          command: command ?? null,
          diffSummaryJson,
          dryRunSummaryJson,
          status: "denied",
          createdAt: new Date().toISOString(),
          expiresAt: null,
          metadataJson: null,
        });

        // Ledger the policy-level denial.
        ledger.recordPermissionDeniedByPolicy(permReqId, request.name, evalResult.reason);
        ledger.recordPermissionDecidedByPolicy(permReqId, "deny", evalResult.reason);
        ledger.recordToolCallDenied(storageId, request.name, evalResult.reason);

        events.publishPermissionDenied(permReqId, request.name, evalResult.reason);
        events.publishToolCallFailed(storageId, request.name, `Permission denied: ${evalResult.reason}`);

        results.push({
          id: storageId,
          modelCallId: request.modelCallId,
          name: request.name,
          result: null,
          error: `Permission denied: ${evalResult.reason}`,
        });
        continue;
      }

      if (evalResult.outcome === "ask") {
        // Ask-gated — suspend the run until the user decides.
        const permReqId = ulid();
        const now = new Date().toISOString();

        // Build the full permission request payload (sent via SSE to TUI).
        const permissionRequestPayload = {
          id: permReqId,
          sessionId,
          runId,
          toolCallId: storageId,
          toolName: request.name,
          riskLevel: evalResult.riskLevel,
          reason: evalResult.reason,
          targetPaths,
          // Include diff preview for the TUI permission modal to render.
          diffPreview: diffPreview ?? null,
          // Phase 10: include command and command preview for bash tools.
          command: command ?? null,
          commandPreview: commandPreview ?? null,
          status: "pending",
          createdAt: now,
        };

        // Persist the pending request.
        this.deps.permissionRepository.createRequest({
          id: permReqId,
          sessionId,
          runId,
          toolCallId: storageId,
          agentId: agentProfile.id,
          toolName: request.name,
          riskLevel: evalResult.riskLevel,
          reason: evalResult.reason,
          targetPathsJson: targetPaths !== undefined ? JSON.stringify(targetPaths) : null,
          command: command ?? null,
          diffSummaryJson,
          dryRunSummaryJson,
          status: "pending",
          createdAt: now,
          expiresAt: null,
          metadataJson: null,
        });

        // Update tool call status to permission_pending.
        this.deps.toolCallRepository.update(storageId, { status: "permission_pending" });

        // Ledger and emit.
        ledger.recordPermissionRequested(permReqId, request.name, evalResult.riskLevel);
        events.publishPermissionRequested(
          permReqId,
          request.name,
          evalResult.riskLevel,
          evalResult.reason,
          permissionRequestPayload
        );

        // ── Pause: wait for the user's decision via PermissionGate ────────
        const decision = await this.deps.permissionGate.waitForDecision(
          permReqId,
          signal
        );

        if (decision === "deny") {
          // User denied (or run was aborted while waiting).
          const deniedBy = signal.aborted ? "system" : "user";

          this.deps.permissionRepository.updateRequest(permReqId, { status: "denied" });
          this.deps.toolCallRepository.update(storageId, {
            status: "denied",
            completedAt: new Date().toISOString(),
            errorJson: JSON.stringify({ error: "Permission denied by user." }),
          });

          // NOTE: The server decision route already recorded permission.decided
          // and the ledger entry for user-submitted decisions. SessionRunner only
          // records the tool-level outcome here (not a duplicate permission.decided).
          ledger.recordToolCallDenied(storageId, request.name, "Permission denied by user.");
          events.publishPermissionDenied(permReqId, request.name, "Denied by user.");
          events.publishToolCallFailed(storageId, request.name, "Permission denied.");

          results.push({
            id: storageId,
            modelCallId: request.modelCallId,
            name: request.name,
            result: null,
            error: `Permission denied by ${deniedBy}.`,
          });

          if (signal.aborted) {
            break;
          }
          continue;
        }

        // User approved — update request status, fall through to execution.
        // (Server decision route already persisted the decision and emitted events.)
        this.deps.permissionRepository.updateRequest(permReqId, { status: "approved" });
      }

      // ── Dispatch ────────────────────────────────────────────────────────
      ledger.recordToolCallStarted(storageId, request.name);
      events.publishToolCallStarted(storageId, request.name);

      // Phase 10: emit shell.command_started for bash tools.
      if (request.name === "bash" && command !== undefined) {
        ledger.recordShellCommandStarted(storageId, command);
        events.publishShellCommandStarted(storageId, command);
      }

      this.deps.toolCallRepository.update(storageId, { status: "running" });

      // Phase 9: for revert_last_change, record the attempt before execution.
      if (request.name === "revert_last_change") {
        const targetPath = targetPaths?.[0] ?? "unknown";
        ledger.recordRevertAttempted(storageId, targetPath);
        events.publishFileRevertAttempted(storageId, targetPath);
      }

      // Build the execution context for Phase 7 tools.
      // Phase 10: include stdout/stderr chunk callbacks for bash tools
      // so the core can emit shell.output_chunk events during execution.
      const execContext: ToolExecutionContext = {
        sessionId,
        runId,
        toolCallId: storageId,
        projectRoot: projectPath,
        signal,
        ...(request.name === "bash"
          ? {
              onStdout: (chunk: string) => {
                ledger.recordShellOutputChunk(storageId, "stdout", Buffer.byteLength(chunk, "utf8"));
                events.publishShellOutputChunk(storageId, "stdout", chunk);
              },
              onStderr: (chunk: string) => {
                ledger.recordShellOutputChunk(storageId, "stderr", Buffer.byteLength(chunk, "utf8"));
                events.publishShellOutputChunk(storageId, "stderr", chunk);
              },
            }
          : {}),
      };

      const result = await this.toolDispatcher.dispatch(request, execContext);

      if (signal.aborted) {
        this.deps.toolCallRepository.update(storageId, {
          status: "aborted",
          completedAt: new Date().toISOString(),
          errorJson: JSON.stringify({ reason: "aborted" }),
        });

        // Phase 10: emit shell.command_aborted for bash tools.
        if (request.name === "bash") {
          ledger.recordShellCommandAborted(storageId, "aborted by signal");
          events.publishShellCommandAborted(storageId, "aborted by signal");
        }

        events.publishToolCallAborted(storageId, request.name);
        break;
      }

      // ── Persist result ──────────────────────────────────────────────────
      let truncatedResult: unknown = result.result;
      if (result.error !== undefined) {
        this.deps.toolCallRepository.update(storageId, {
          status: "failed",
          completedAt: new Date().toISOString(),
          resultJson: null,
          errorJson: JSON.stringify({ error: result.error }),
        });
        ledger.recordToolCallFailed(storageId, request.name, result.error);
        events.publishToolCallFailed(storageId, request.name, result.error);

        // Phase 10: emit shell.command_failed for bash tools.
        if (request.name === "bash") {
          ledger.recordShellCommandFailed(storageId, result.error);
          events.publishShellCommandFailed(storageId, result.error);
        }

        // Phase 9: emit file-mutation-specific failure events.
        if (MUTATION_TOOLS.has(request.name)) {
          const targetPath = targetPaths?.[0] ?? "unknown";
          if (request.name === "revert_last_change") {
            ledger.recordRevertFailed(storageId, targetPath, result.error);
            events.publishFileRevertFailed(storageId, targetPath, result.error);
          } else {
            ledger.recordMutationFailed(storageId, request.name, targetPath, result.error);
            events.publishFileChangeFailed(storageId, request.name, targetPath, result.error);
          }
        }
      } else {
        // Phase 12: truncate large tool results before persisting.
        const rawResultStr = JSON.stringify(result.result);
        const truncated = this.deps.tokenHealthService.truncateOutput(rawResultStr);
        if (truncated.meta.truncated) {
          ledger.recordToolResultTruncated(
            storageId,
            rawResultStr.length,
            truncated.content.length
          );
          events.publishToolResultTruncated(
            storageId,
            rawResultStr.length,
            truncated.content.length,
            truncated.meta.reason
          );
        }
        truncatedResult =
          truncated.meta.truncated
            ? {
                truncated: true,
                content: truncated.content,
                metadata: truncated.meta,
              }
            : result.result;

        this.deps.toolCallRepository.update(storageId, {
          status: "completed",
          completedAt: new Date().toISOString(),
          resultJson: truncated.meta.truncated
            ? JSON.stringify({
                truncated: true,
                content: truncated.content,
                metadata: truncated.meta,
              })
            : truncated.content,
          errorJson: null,
        });
        ledger.recordToolCallCompleted(storageId, request.name);
        events.publishToolCallCompleted(storageId, request.name);

        // Phase 10: emit shell.command_completed for bash tools.
        if (request.name === "bash") {
          const shellResult =
            result.result !== null && typeof result.result === "object"
              ? (result.result as Record<string, unknown>)
              : {};
          const exitCode =
            typeof shellResult["exitCode"] === "number"
              ? shellResult["exitCode"]
              : null;
          const timedOut = shellResult["timedOut"] === true;
          const truncated = shellResult["truncated"] === true;
          ledger.recordShellCommandCompleted(
            storageId,
            exitCode,
            timedOut,
            truncated
          );
          events.publishShellCommandCompleted(
            storageId,
            exitCode,
            timedOut,
            truncated
          );
        }

        // Phase 9: emit file-mutation-specific success events.
        if (MUTATION_TOOLS.has(request.name)) {
          const resultObj =
            result.result !== null && typeof result.result === "object"
              ? (result.result as Record<string, unknown>)
              : {};
          const targetPath =
            typeof resultObj["path"] === "string"
              ? resultObj["path"]
              : (targetPaths?.[0] ?? "unknown");
          const changeId =
            typeof resultObj["changeId"] === "string"
              ? resultObj["changeId"]
              : undefined;

          if (request.name === "revert_last_change") {
            const revertedChangeId =
              typeof resultObj["revertedChangeId"] === "string"
                ? resultObj["revertedChangeId"]
                : "";
            ledger.recordRevertCompleted(storageId, targetPath, revertedChangeId);
            events.publishFileRevertCompleted(storageId, targetPath, revertedChangeId);
          } else {
            ledger.recordMutationApplied(storageId, request.name, targetPath, changeId);
            events.publishFileChangeApplied(storageId, request.name, targetPath, changeId);
          }
        }
      }

      // Phase 12: apply truncated result to the return value so
      // the caller persists truncated content in tool result messages.
      if (result.error === undefined && truncatedResult !== null && truncatedResult !== undefined) {
        results.push({
          ...result,
          result: truncatedResult,
        });
      } else {
        results.push(result);
      }
    }

    return results;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Mutation tools that require a diff preview BEFORE the permission gate.
 * diff_preview is excluded (it IS the preview; no pre-gate preview needed).
 * revert_last_change is excluded because its path is looked up from storage,
 * not from raw model input; path safety is enforced in its own executor.
 */
const DIFF_PREVIEW_REQUIRED = new Set([
  "write",
  "edit",
  "apply_patch",
]);

/**
 * Full set of mutation tools — used for file-change event emission after dispatch.
 * diff_preview is excluded (read-only).
 */
const MUTATION_TOOLS = new Set([
  "write",
  "edit",
  "apply_patch",
  "revert_last_change",
]);

/**
 * Best-effort extraction of file paths from a tool call input.
 *
 * Inspects common path field names used by Phase 7 read-only tools.
 * Returns undefined if input is not an object or has no recognisable path fields.
 * Does not throw on unexpected input shapes.
 */
function extractTargetPaths(input: unknown): string[] | undefined {
  if (input === null || typeof input !== "object") return undefined;

  const obj = input as Record<string, unknown>;

  // "path" field (read, grep tools)
  if (typeof obj["path"] === "string") {
    return [obj["path"]];
  }

  // "paths" field (hypothetical multi-path tool)
  if (Array.isArray(obj["paths"])) {
    const strs = (obj["paths"] as unknown[]).filter(
      (p): p is string => typeof p === "string"
    );
    if (strs.length > 0) return strs;
  }

  // "pattern" field (glob tool) — pattern is not a literal path;
  // extract any leading directory portion for path-rule checking.
  if (typeof obj["pattern"] === "string") {
    const pattern = obj["pattern"] as string;
    // Extract directory prefix before any glob characters.
    const globChars = /[*?[\]{}!]/;
    if (!globChars.test(pattern)) {
      // Fully literal path — treat as a path.
      return [pattern];
    }
    const slashIdx = pattern.search(globChars);
    const lastSlash = pattern.lastIndexOf("/", slashIdx);
    if (lastSlash > 0) {
      return [pattern.slice(0, lastSlash)];
    }
  }

  return undefined;
}

/**
 * Extract command string from bash tool input.
 * Returns undefined if input is not an object or has no command field.
 */
function extractBashCommand(input: unknown): string | undefined {
  if (input === null || typeof input !== "object") return undefined;
  const obj = input as Record<string, unknown>;
  if (typeof obj["command"] === "string" && obj["command"].trim().length > 0) {
    return obj["command"];
  }
  return undefined;
}
