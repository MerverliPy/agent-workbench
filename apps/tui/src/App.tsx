import type { JSX } from "@opentui/solid";
import { onMount, onCleanup } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import type { EventEnvelope, PermissionRequest, DiffPreview } from "@agent-workbench/protocol";
import { sdk } from "./lib/sdk";
import {
  setServerStatus,
  setServerError,
  addPendingPermissionRequest,
  removePendingPermissionRequest,
  appendMessage,
  appendSystemNotice,
  commandPaletteOpen,
  setCommandPaletteOpen,
  setPermissionModalOpen,
  setCurrentDiffPreview,
  setDiffViewerOpen,
  setMutationStatus,
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

    // token_health.updated, run.*, tool.*, etc. are Phase 6+ events.
    // Silently skip unknown types — do not crash on unexpected events.
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

    // 2. Subscribe to all SSE events
    sdk.events.onAny(handleEvent);

    // 3. Start SSE stream (runs until disconnect/abort)
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
