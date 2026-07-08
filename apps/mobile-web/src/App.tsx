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
import { TabBar } from "./components/TabBar";
import { TopBar } from "./components/TopBar";
import { handleEvent } from "./lib/event-dispatcher";
import { reconnectClient } from "./lib/sdk";
import { getSettings } from "./lib/settings";
import {
  appendSystemNotice,
  fallbackMode,
  permissionModalOpen,
  setAvailableAgents,
  setConnectionError,
  setConnectionStatus,
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
      <div
        class="flex flex-col h-dvh mx-auto relative w-full sm:max-w-md md:max-w-2xl lg:max-w-4xl"
        style="border-left: 1px solid var(--border-soft); border-right: 1px solid var(--border-soft);"
      >
        <TopBar />
        <Show when={permissionModalOpen() && fallbackMode()}>
          <PermissionPrompt />
        </Show>
        <NavDrawer />
        <PanelContainer />
        <TabBar />
      </div>
    </ErrorBoundary>
  );
}
