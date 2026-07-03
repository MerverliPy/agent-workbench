import type {
  EventEnvelope,
  PermissionRequest,
} from "@agent-workbench/protocol";
import { ApiError } from "@agent-workbench/sdk";
import type { JSX } from "solid-js";
import { onCleanup, onMount, Show } from "solid-js";
import { ConnectionBar } from "./components/ConnectionBar";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { NavDrawer } from "./components/NavDrawer";
import { OfflineBanner } from "./components/OfflineBanner";
import { PermissionPrompt } from "./components/PermissionPrompt";
import { PanelContainer } from "./components/panels/PanelContainer";
import { StatusBar } from "./components/StatusBar";
import { categorizeEvent, getCategoryIcon } from "./lib/events";
import { reconnectClient } from "./lib/sdk";
import { getSettings } from "./lib/settings";
import {
  appendActivity,
  appendMessage,
  appendStreamingDelta,
  appendSystemNotice,
  beginStreaming,
  cancelStreaming,
  finalizeStreaming,
  permissionModalOpen,
  setAvailableAgents,
  setConnectionError,
  setConnectionStatus,
  setCurrentAgentId,
  setPendingPermissionRequest,
  setPermissionModalOpen,
  streamingContent,
} from "./state/app";

export function App(): JSX.Element {
  let unsubscribe: (() => void) | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let sseRetryCount = 0;
  const MAX_SSE_RETRIES = 5;

  async function connect(): Promise<void> {
    setConnectionStatus("connecting");
    const settings = getSettings();
    const client = reconnectClient(settings.serverUrl);

    try {
      const controller = new AbortController();
      const signal = controller.signal;

      await client.health.check(signal);
      setConnectionStatus("connected");
      setConnectionError(null);

      // Reset SSE retry count on successful connection
      sseRetryCount = 0;

      // Load agents
      try {
        const agents = await client.agents.list(signal);
        setAvailableAgents(agents);
      } catch (err) {
        console.warn("Agent list failed (non-fatal):", err);
      }

      // Subscribe to SSE events (wildcard — the server emits "message.created",
      // "model.stream_delta", etc., not a generic "message" type).
      client.events.onAny(handleEvent);
      unsubscribe = () => client.events.off("*", handleEvent);

      // Start the SSE connection (long-lived stream, fire-and-forget).
      // On stream failure, attempt reconnection with backoff.
      const connectSse = () => {
        client.events.connect().catch((err: unknown) => {
          console.warn("SSE connection lost:", err);
          // Attempt reconnect with exponential backoff if we haven't exhausted retries
          if (sseRetryCount < MAX_SSE_RETRIES) {
            sseRetryCount++;
            const delay = Math.min(1000 * 2 ** sseRetryCount, 30000);
            setTimeout(connectSse, delay);
          }
        });
      };
      connectSse();
    } catch (err: unknown) {
      setConnectionStatus("error");

      let errorMsg: string;
      if (err instanceof ApiError) {
        // Server responded with an error (4xx/5xx) — show the exact status.
        errorMsg = `${err.message}`;
      } else if (err instanceof Error) {
        // Network failure, timeout, or SDK validation error.
        errorMsg = err.message;
      } else {
        errorMsg = "Server unreachable";
      }
      setConnectionError(errorMsg);

      appendSystemNotice(
        `Could not connect to ${settings.serverUrl}. Check your connection settings.`,
      );

      if (settings.autoConnect) {
        reconnectTimer = setTimeout(connect, settings.reconnectIntervalMs);
      }
    }
  }

  // ── SSE event routing ─────────────────────────────────────────────────

  function handleEvent(event: EventEnvelope): void {
    const type = event.type;
    const cat = categorizeEvent(type);

    // Log all non-stream events to activity log
    if (cat !== "stream" && cat !== "other") {
      appendActivity({
        id: event.id,
        timestamp: event.timestamp,
        category: cat,
        icon: getCategoryIcon(cat),
        summary: `${type} — ${JSON.stringify(event.payload).slice(0, 100)}`,
      });
    }

    // ── Messages ──
    if (type === "message.created" || type === "message.delta") {
      const payload = event.payload as Record<string, unknown>;
      const role = (payload.role as string | undefined) ?? "assistant";
      const content = (payload.content as string | undefined) ?? "";
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

    // ── Streaming ──
    if (type === "model.stream_delta") {
      const payload = event.payload as Record<string, unknown>;
      const delta = payload.delta as string | undefined;
      if (delta) {
        if (!streamingContent()) beginStreaming(event.id);
        appendStreamingDelta(delta);
      }
      return;
    }

    if (type === "model.stream_complete") {
      finalizeStreaming();
      return;
    }

    if (type === "model.stream_error") {
      const payload = event.payload as Record<string, unknown>;
      appendSystemNotice(
        `Stream error: ${(payload.message as string) ?? "unknown"}`,
      );
      cancelStreaming();
      return;
    }

    // ── Permissions ──
    if (type === "permission.requested") {
      const payload = event.payload as Record<string, unknown>;
      const req = payload.permissionRequest as PermissionRequest | undefined;
      if (req) {
        setPendingPermissionRequest(req);
        setPermissionModalOpen(true);
      }
      return;
    }

    // ── Agent ──
    if (type === "agent.selected") {
      const payload = event.payload as Record<string, unknown>;
      const agentId = payload.agentId as string | undefined;
      if (agentId) setCurrentAgentId(agentId);
      return;
    }

    // ── Shell events ──
    if (type === "shell.command_requested") {
      const payload = event.payload as Record<string, unknown>;
      const preview = payload.preview as Record<string, unknown> | undefined;
      appendSystemNotice(
        `Shell: ${preview?.normalized ?? "unknown"} (risk: ${preview?.riskLevel ?? "?"})`,
      );
      return;
    }

    if (type === "shell.command_completed") {
      const payload = event.payload as Record<string, unknown>;
      appendSystemNotice(`Shell completed (exit: ${payload.exitCode ?? "?"})`);
      return;
    }

    if (type === "shell.command_failed") {
      const payload = event.payload as Record<string, unknown>;
      appendSystemNotice(`Shell failed: ${payload.error ?? "unknown"}`);
      return;
    }

    // ── File events ──
    if (type === "file.change_applied") {
      const payload = event.payload as Record<string, unknown>;
      appendSystemNotice(`File changed: ${payload.path ?? "?"}`);
      return;
    }

    if (type === "file.change_failed" || type === "file.revert_failed") {
      const payload = event.payload as Record<string, unknown>;
      appendSystemNotice(`File error: ${payload.error ?? "unknown"}`);
      return;
    }

    // ── Plan events ──
    if (type === "plan.proposed") {
      const payload = event.payload as Record<string, unknown>;
      const plan = payload.plan as Record<string, unknown> | undefined;
      appendSystemNotice(
        `Plan: ${plan?.summary ?? "proposed"} [${plan?.riskLevel ?? "?"}]`,
      );
      return;
    }

    // ── Compaction ──
    if (type === "compaction.suggested") {
      appendSystemNotice("Compaction suggested — context usage is high");
      return;
    }
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  onMount(() => {
    connect();
  });

  onCleanup(() => {
    unsubscribe?.();
    if (reconnectTimer) clearTimeout(reconnectTimer);
  });

  return (
    <ErrorBoundary>
      <ConnectionBar />
      <OfflineBanner />
      <div class="flex flex-col h-dvh overflow-hidden">
        <StatusBar />
        <Show when={permissionModalOpen()}>
          <PermissionPrompt />
        </Show>
        <NavDrawer />
        <PanelContainer />
      </div>
    </ErrorBoundary>
  );
}
