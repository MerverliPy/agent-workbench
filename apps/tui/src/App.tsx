import type { JSX } from "@opentui/solid";
import { onMount, onCleanup } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import type { EventEnvelope, PermissionRequest, DiffPreview, AgentListItem } from "@agent-workbench/protocol";
import type { Plan } from "@agent-workbench/protocol";
import { sdk } from "./lib/sdk";
import {
  setServerStatus,
  setServerError,
  addPendingPermissionRequest,
  removePendingPermissionRequest,
  appendMessage,
  appendSystemNotice,
  appendStreamingContent,
  finalizeStreamingMessage,
  cancelStreaming,
  setStreamingMessageId,
  commandPaletteOpen,
  setCommandPaletteOpen,
  setPermissionModalOpen,
  setCurrentDiffPreview,
  setDiffViewerOpen,
  setMutationStatus,
  setShellStatus,
  appendShellOutputChunk,
  clearShellOutput,
  setCurrentAgentId,
  setAvailableAgents,
  setTokenHealth,
  setTokenHealthOpen,
  setCompactionSuggestion,
  setCurrentPlan,
  PLACEHOLDER_SESSION_ID,
} from "./state/app";
import { AppLayout } from "./components/layout/AppLayout";

/**
 * Root application component.
 *
 * Responsibilities:
 *  - Initiate SDK health check on mount
 *  - Start SSE subscription on mount
 *  - Route incoming SSE events to state updates
 *  - Handle global keyboard shortcuts (Ctrl+P)
 *  - Render the AppLayout shell
 *
 * Phase 4 constraints:
 *  - No tool execution
 *  - No file mutation
 *  - No model calls
 *  - No shell execution
 *  - No storage access
 *  - No permission policy decisions
 */
export function App(): JSX.Element {
  // ── Phase 11: Agent selection helper ─────────────────────────────────────

  async function selectAgent(agentId: string): Promise<void> {
    setCurrentAgentId(agentId);
    try {
      await sdk.sessions.update(PLACEHOLDER_SESSION_ID, { activeAgent: agentId as "build" | "plan" });
    } catch {
      // Session may not exist yet — local state already updated; server update
      // will be retried on next full session creation.
    }
    appendSystemNotice(`Agent switched to ${agentId}`);
  }

  // ── Global keyboard handling ─────────────────────────────────────────────

  useKeyboard((key) => {
    // Ctrl+P: toggle command palette
    if (key.ctrl && key.name === "p") {
      setCommandPaletteOpen((open) => !open);
      return;
    }

    // Escape: close command palette if open
    if (key.name === "escape" && commandPaletteOpen()) {
      setCommandPaletteOpen(false);
    }

    // Ctrl+T: toggle token health panel
    if (key.ctrl && key.name === "t") {
      setTokenHealthOpen((open) => !open);
      return;
    }

    // Phase 11: Agent selection (Ctrl+1 = Build, Ctrl+2 = Plan)
    if (key.ctrl && key.name === "1") {
      void selectAgent("build");
      return;
    }
    if (key.ctrl && key.name === "2") {
      void selectAgent("plan");
      return;
    }
  });

  // ── SSE event routing ────────────────────────────────────────────────────

  function handleEvent(event: EventEnvelope): void {
    const type = event.type;

    if (type === "message.created" || type === "message.delta") {
      // Phase 6+: assistant messages via SSE
      const payload = event.payload as Record<string, unknown>;
      const role = (payload["role"] as string | undefined) ?? "assistant";
      const content = (payload["content"] as string | undefined) ?? "";
      if (content) {
        appendMessage({
          id: event.id,
          role: role as "user" | "assistant" | "system",
          content,
          createdAt: event.timestamp,
        });
      }
      return;
    }

    if (type === "permission.requested") {
      // The server embeds the full PermissionRequest in the payload so the TUI
      // can render the modal without a follow-up API call.
      // TUI does not evaluate the request — it only displays backend-provided data.
      const payload = event.payload as Record<string, unknown>;
      const req = payload["permissionRequest"] as PermissionRequest | undefined;
      if (req !== undefined) {
        addPendingPermissionRequest(req);
        setPermissionModalOpen(true);
      } else {
        // Fallback: increment-only if payload shape is unexpected.
        // This preserves backward compatibility during development.
        setPermissionModalOpen(true);
      }
      return;
    }

    if (type === "permission.decided") {
      const payload = event.payload as Record<string, unknown>;
      const requestId = payload["requestId"] as string | undefined;
      if (requestId !== undefined) {
        removePendingPermissionRequest(requestId);
      }
      // Close modal when all pending requests are resolved.
      // The modal component also derives visibility from pendingPermissionRequests().
      return;
    }

    // ── Phase 9: Diff and file mutation events ────────────────────────────

    if (type === "diff.preview_created") {
      // Backend generated a diff preview before the permission gate.
      // TUI opens DiffViewer to show the preview (render-only — no mutation here).
      const payload = event.payload as Record<string, unknown>;
      const preview = payload["preview"] as DiffPreview | undefined;
      if (preview !== undefined) {
        setCurrentDiffPreview(preview);
        setMutationStatus("proposed");
        setDiffViewerOpen(true);
      }
      return;
    }

    if (type === "file.change_applied") {
      const payload = event.payload as Record<string, unknown>;
      const path = payload["path"] as string | undefined;
      setMutationStatus("applied");
      setCurrentDiffPreview(null);
      appendSystemNotice(
        path !== undefined ? `File changed: ${path}` : "File mutation applied."
      );
      return;
    }

    if (type === "file.change_failed") {
      const payload = event.payload as Record<string, unknown>;
      const error = payload["error"] as string | undefined;
      setMutationStatus("failed");
      setCurrentDiffPreview(null);
      appendSystemNotice(
        `Mutation failed: ${error ?? "unknown error"}`
      );
      return;
    }

    if (type === "file.revert_attempted") {
      setMutationStatus("reverting");
      return;
    }

    if (type === "file.revert_completed") {
      const payload = event.payload as Record<string, unknown>;
      const path = payload["path"] as string | undefined;
      setMutationStatus("reverted");
      setCurrentDiffPreview(null);
      appendSystemNotice(
        path !== undefined ? `Reverted: ${path}` : "File reverted."
      );
      return;
    }

    if (type === "file.revert_failed") {
      const payload = event.payload as Record<string, unknown>;
      const error = payload["error"] as string | undefined;
      setMutationStatus("failed");
      appendSystemNotice(
        `Revert failed: ${error ?? "unknown error"}`
      );
      return;
    }

    // ── Phase 10: Shell execution events ───────────────────────────────

    if (type === "shell.command_requested") {
      const payload = event.payload as Record<string, unknown>;
      const preview = payload["preview"] as Record<string, unknown> | undefined;
      if (preview !== undefined) {
        appendSystemNotice(
          `Shell command: ${preview["normalized"] ?? "unknown"} (risk: ${preview["riskLevel"] ?? "high"})`
        );
      }
      return;
    }

    if (type === "shell.command_started") {
      setShellStatus("running");
      clearShellOutput();
      return;
    }

    if (type === "shell.output_chunk") {
      const payload = event.payload as Record<string, unknown>;
      const stream = payload["stream"] as "stdout" | "stderr" | undefined;
      const chunk = payload["chunk"] as string | undefined;
      if (stream !== undefined && chunk !== undefined) {
        appendShellOutputChunk({ stream, chunk });
      }
      return;
    }

    if (type === "shell.command_completed") {
      const payload = event.payload as Record<string, unknown>;
      const exitCode = payload["exitCode"];
      const timedOut = payload["timedOut"];
      setShellStatus("completed");
      appendSystemNotice(
        `Shell command completed (exit code: ${exitCode ?? "null"}${timedOut ? ", timed out" : ""})`
      );
      return;
    }

    if (type === "shell.command_failed") {
      const payload = event.payload as Record<string, unknown>;
      const error = payload["error"] as string | undefined;
      setShellStatus("failed");
      appendSystemNotice(
        `Shell command failed: ${error ?? "unknown error"}`
      );
      return;
    }

    if (type === "shell.command_aborted") {
      const payload = event.payload as Record<string, unknown>;
      const reason = payload["reason"] as string | undefined;
      setShellStatus("aborted");
      appendSystemNotice(
        `Shell command aborted: ${reason ?? "unknown reason"}`
      );
      return;
    }

    // ── Phase 11: Agent events ──────────────────────────────────────────

    if (type === "agent.selected") {
      const payload = event.payload as Record<string, unknown>;
      const agentId = payload["agentId"] as string | undefined;
      if (agentId !== undefined) {
        setCurrentAgentId(agentId);
      }
      return;
    }

    // ── Phase 12: Token health events ──────────────────────────────────

    if (type === "token_health.updated") {
      const payload = event.payload as Record<string, unknown>;
      setTokenHealth({
        budget: (payload["budget"] as number) ?? 0,
        used: (payload["used"] as number) ?? 0,
        remaining: (payload["remaining"] as number) ?? 0,
        utilizationPercent: (payload["utilizationPercent"] as number) ?? 0,
        level: (payload["level"] as string) ?? "healthy",
        isEstimate: (payload["isEstimate"] as boolean) ?? true,
        compactionSuggested: (payload["compactionSuggested"] as boolean) ?? false,
      });
      return;
    }

    if (type === "token_health.warning") {
      const payload = event.payload as Record<string, unknown>;
      const level = payload["level"] as string | undefined;
      const message = payload["message"] as string | undefined;
      appendSystemNotice(
        `Token health (${level ?? "unknown"}): ${message ?? "check usage"}`
      );
      return;
    }

    if (type === "compaction.suggested") {
      const payload = event.payload as Record<string, unknown>;
      setCompactionSuggestion({
        currentTokens: payload["currentTokens"] as number,
        estimatedCompactedTokens: payload["estimatedCompactedTokens"] as number | undefined,
        reason: payload["reason"] as string | undefined,
      });
      setTokenHealthOpen(true);
      appendSystemNotice(
        `Compaction suggested: ${(payload["reason"] as string) ?? "context usage is high"}`
      );
      return;
    }

    if (type === "compaction.started") {
      appendSystemNotice("Compaction started...");
      return;
    }

    if (type === "compaction.completed") {
      const payload = event.payload as Record<string, unknown>;
      const summaryId = payload["summaryId"] as string | undefined;
      appendSystemNotice(
        `Compaction completed${summaryId !== undefined ? ` (${summaryId})` : ""}`
      );
      return;
    }

    if (type === "compaction.rejected") {
      setCompactionSuggestion(null);
      appendSystemNotice("Compaction rejected");
      return;
    }

    if (type === "tool_result.truncated") {
      const payload = event.payload as Record<string, unknown>;
      const toolCallId = payload["toolCallId"] as string | undefined;
      const originalLen = payload["originalLength"] as number | undefined;
      const truncatedLen = payload["truncatedLength"] as number | undefined;
      if (toolCallId !== undefined && originalLen !== undefined && truncatedLen !== undefined) {
        appendSystemNotice(
          `Tool result truncated (${originalLen} → ${truncatedLen} chars)`
        );
      }
      return;
    }

    // ── Phase 16: Streaming model response events ──────────────────────

    if (type === "model.stream_delta") {
      const payload = event.payload as Record<string, unknown>;
      const delta = payload["delta"] as string | undefined;
      if (delta && delta.length > 0) {
        // First delta: create a streaming message slot
        if (streamingMessageId() === null) {
          setStreamingMessageId(event.id);
        }
        appendStreamingContent(delta);
      }
      return;
    }

    if (type === "model.stream_complete") {
      finalizeStreamingMessage();
      return;
    }

    if (type === "model.stream_error") {
      const payload = event.payload as Record<string, unknown>;
      const message = payload["message"] as string | undefined;
      appendSystemNotice(
        `Stream error: ${message ?? "unknown error"}`
      );
      cancelStreaming();
      return;
    }

    // token_health.updated, run.*, tool.*, etc. are Phase 6+ events.
    // Silently skip unknown types — do not crash on unexpected events.

    // ── Phase 13: Plan events ──────────────────────────────────────────

    if (type === "plan.proposed") {
      const payload = event.payload as Record<string, unknown>;
      const plan = payload["plan"] as Plan | undefined;
      if (plan !== undefined) {
        setCurrentPlan({
          planId: plan.id,
          status: plan.status,
          summary: plan.summary,
          riskLevel: plan.riskLevel,
          steps: plan.steps.map((s) => {
            const step: { order: number; type: string; description: string; targetPath?: string } = {
              order: s.order,
              type: s.type,
              description: s.description,
            };
            if (s.targetPath !== undefined) step.targetPath = s.targetPath;
            return step;
          }),
          targetFiles: plan.targetFiles,
        });
      }
      appendSystemNotice(
        `Plan proposed: ${plan?.summary ?? "mutation plan"} [${plan?.riskLevel ?? "high"}]`
      );
      return;
    }

    if (type === "plan.approved") {
      const payload = event.payload as Record<string, unknown>;
      const planId = payload["planId"] as string | undefined;
      setCurrentPlan((prev) =>
        prev !== null ? { ...prev, status: "approved" } : null
      );
      appendSystemNotice("Plan approved. Proceeding with execution.");
      return;
    }

    if (type === "plan.denied") {
      const payload = event.payload as Record<string, unknown>;
      const reason = payload["reason"] as string | undefined;
      setCurrentPlan((prev) =>
        prev !== null ? { ...prev, status: "denied" } : null
      );
      appendSystemNotice(
        `Plan denied${reason ? `: ${reason}` : ""}.`
      );
      return;
    }

    if (type === "plan.completed") {
      setCurrentPlan(null);
      return;
    }

    if (type === "plan.failed") {
      const payload = event.payload as Record<string, unknown>;
      const reason = payload["reason"] as string | undefined;
      setCurrentPlan(null);
      appendSystemNotice(
        `Plan failed${reason ? `: ${reason}` : ""}.`
      );
      return;
    }
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  onMount(() => {
    const controller = new AbortController();

    // 1. Health check — establishes initial server connection state
    sdk.health
      .check(controller.signal)
      .then(() => {
        setServerStatus("connected");
        setServerError(null);
      })
      .catch((err: unknown) => {
        setServerStatus("error");
        setServerError(err instanceof Error ? err.message : "Server unreachable");
        appendSystemNotice(
          `Could not connect to server at ${
            (sdk as unknown as { http: { baseUrl: string } }).http?.baseUrl ??
            "http://localhost:3000"
          }. ` +
            "Start the server with: cd apps/server && bun run start",
        );
      });

    // 2. Load available agents
    sdk.agents
      .list(controller.signal)
      .then((items: AgentListItem[]) => {
        setAvailableAgents(
          items.map((a: AgentListItem) => ({ id: a.id, name: a.name, mode: a.mode }))
        );
      })
      .catch(() => {
        // Agent endpoint may not be ready yet — silently ignore.
      });

    // 3. Fetch initial token health on mount
    sdk.tokenHealth
      .get(PLACEHOLDER_SESSION_ID, controller.signal)
      .then((data) => {
        setTokenHealth({
          budget: data.budget,
          used: data.used,
          remaining: data.remaining,
          utilizationPercent: data.utilizationPercent,
          level: data.level,
          isEstimate: data.isEstimate,
          compactionSuggested: data.compactionSuggested,
        });
      })
      .catch(() => {
        // Token health endpoint may not be ready yet — silently ignore.
      });

    // 4. Subscribe to all SSE events
    sdk.events.onAny(handleEvent);

    // 5. Start SSE stream (runs until disconnect/abort)
    //    No auto-reconnect in Phase 4 — restart TUI if SSE drops.
    sdk.events
      .connect(controller.signal)
      .then(() => {
        // Stream ended normally (server closed connection)
        setServerStatus("disconnected");
        setServerError("SSE stream closed by server.");
      })
      .catch((err: unknown) => {
        // AbortError from cleanup is expected — ignore it
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Any other SSE error
        const msg = err instanceof Error ? err.message : String(err);
        setServerStatus("error");
        setServerError(`SSE failed: ${msg}`);
      });

    onCleanup(() => {
      controller.abort();
      sdk.events.disconnect();
    });
  });

  return <AppLayout />;
}
