import type { JSX } from "solid-js";
import { createEffect, onCleanup, Show } from "solid-js";
import { getClient } from "../lib/sdk";
import {
  pendingPermissionRequest,
  permissionModalOpen,
  setPendingPermissionRequest,
  setPermissionModalOpen,
} from "../state/app";

/**
 * Request notification permission once on mount (if supported and not
 * already granted). Returns true if notifications can be shown.
 */
function requestNotificationPermission(): boolean {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  // "default" — ask the user
  Notification.requestPermission();
  return false; // won't be ready until next prompt
}

export function PermissionPrompt(): JSX.Element {
  const req = () => pendingPermissionRequest();
  let notifiedForRequestId: string | undefined;

  // Request notification permission on mount
  requestNotificationPermission();

  // Show browser notification when a new permission request arrives
  // and the tab is not visible
  createEffect(() => {
    const r = req();
    if (!r || !permissionModalOpen()) return;
    if (r.id === notifiedForRequestId) return; // already notified

    notifiedForRequestId = r.id;

    if (
      "Notification" in window &&
      Notification.permission === "granted" &&
      document.visibilityState !== "visible"
    ) {
      try {
        const notification = new Notification("Permission Required", {
          body: `Tool: ${r.toolName} | Risk: ${r.riskLevel ?? "unknown"}`,
          icon: "/icons/icon-192.png",
          tag: "agent-workbench-permission",
          requireInteraction: true,
        });
        // Auto-close after 30s
        setTimeout(() => notification.close(), 30000);
      } catch {
        // Notification API can fail silently on some browsers
      }
    }
  });

  // Clean up notification on unmount
  onCleanup(() => {
    notifiedForRequestId = undefined;
  });

  // ── Focus Trap Logic ────────────────────────────────────────────────
  let modalRef: HTMLDivElement | undefined;
  let denyBtnRef: HTMLButtonElement | undefined;

  createEffect(() => {
    if (permissionModalOpen() && req() && modalRef) {
      // Focus the modal or the first button when it opens
      requestAnimationFrame(() => {
        denyBtnRef?.focus();
      });

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          respond(false);
          return;
        }

        if (e.key === "Tab") {
          const focusableElements = modalRef?.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          ) as NodeListOf<HTMLElement>;

          if (!focusableElements || focusableElements.length === 0) return;

          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              lastElement?.focus();
              e.preventDefault();
            }
          } else {
            if (document.activeElement === lastElement) {
              firstElement?.focus();
              e.preventDefault();
            }
          }
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      onCleanup(() => document.removeEventListener("keydown", handleKeyDown));
    }
  });

  async function respond(allowed: boolean): Promise<void> {
    const r = req();
    if (!r) return;
    try {
      await getClient().permissions.decide(r.id, {
        decision: allowed ? "allow" : "deny",
      });
    } catch (err) {
      console.error("Permission response failed:", err);
    }
    setPermissionModalOpen(false);
    setPendingPermissionRequest(null);
  }

  return (
    <Show when={permissionModalOpen() && req()}>
      <div
        class="fixed inset-0 bg-black/60 z-50 flex items-end justify-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="permission-title"
      >
        <div
          ref={modalRef}
          class="w-full max-w-md bg-slate-800 rounded-t-2xl px-5 pt-6 pb-8 safe-bottom shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="flex items-center gap-2 mb-3">
            <span class="text-lg">🛡️</span>
            <h2
              id="permission-title"
              class="text-base font-semibold text-white"
            >
              Permission Required
            </h2>
          </div>

          <div class="mb-4 space-y-2">
            <div class="bg-slate-700/50 rounded-lg px-3 py-2">
              <span class="text-xs text-slate-400 block mb-0.5">Tool</span>
              <span class="text-sm font-medium text-white">
                {req()?.toolName}
              </span>
            </div>
            <Show when={req()?.targetPaths?.length}>
              <div class="bg-slate-700/50 rounded-lg px-3 py-2">
                <span class="text-xs text-slate-400 block mb-0.5">Target</span>
                <span class="text-sm font-mono text-slate-200 break-all">
                  {req()?.targetPaths?.join(", ")}
                </span>
              </div>
            </Show>
            <div class="bg-slate-700/50 rounded-lg px-3 py-2">
              <span class="text-xs text-slate-400 block mb-0.5">Risk</span>
              <span
                class={`text-sm font-medium ${
                  req()?.riskLevel === "high"
                    ? "text-red-400"
                    : req()?.riskLevel === "medium"
                      ? "text-yellow-400"
                      : "text-green-400"
                }`}
              >
                {req()?.riskLevel ?? "unknown"}
              </span>
            </div>
          </div>

          <div class="flex gap-3">
            <button
              ref={denyBtnRef}
              class="flex-1 h-14 rounded-xl bg-red-600 active:bg-red-700 text-white font-semibold text-base transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-800"
              onClick={() => respond(false)}
            >
              ✕ Deny
            </button>
            <button
              class="flex-1 h-14 rounded-xl bg-green-600 active:bg-green-700 text-white font-semibold text-base transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-800"
              onClick={() => respond(true)}
            >
              ✓ Approve
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
