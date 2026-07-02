import type { JSX } from "solid-js";
import { Show } from "solid-js";
import { pendingPermissionRequest, permissionModalOpen, setPermissionModalOpen, setPendingPermissionRequest } from "../state/app";
import { getClient } from "../lib/sdk";

export function PermissionPrompt(): JSX.Element {
  const req = () => pendingPermissionRequest();

  async function respond(allowed: boolean): Promise<void> {
    const r = req();
    if (!r) return;
    try {
      await getClient().permissions.decide(r.id, { decision: allowed ? "allow" : "deny" });
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
          class="w-full max-w-md bg-slate-800 rounded-t-2xl px-5 pt-6 pb-8 safe-bottom shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="flex items-center gap-2 mb-3">
            <span class="text-lg">🛡️</span>
            <h2 id="permission-title" class="text-base font-semibold text-white">Permission Required</h2>
          </div>

          <div class="mb-4 space-y-2">
            <div class="bg-slate-700/50 rounded-lg px-3 py-2">
              <span class="text-xs text-slate-400 block mb-0.5">Tool</span>
              <span class="text-sm font-medium text-white">{req()!.toolName}</span>
            </div>
            <Show when={req()!.targetPaths?.length}>
              <div class="bg-slate-700/50 rounded-lg px-3 py-2">
                <span class="text-xs text-slate-400 block mb-0.5">Target</span>
                <span class="text-sm font-mono text-slate-200 break-all">{req()!.targetPaths?.join(", ")}</span>
              </div>
            </Show>
            <div class="bg-slate-700/50 rounded-lg px-3 py-2">
              <span class="text-xs text-slate-400 block mb-0.5">Risk</span>
              <span class={`text-sm font-medium ${
                req()!.riskLevel === "high" ? "text-red-400" :
                req()!.riskLevel === "medium" ? "text-yellow-400" : "text-green-400"
              }`}>{req()!.riskLevel ?? "unknown"}</span>
            </div>
          </div>

          <div class="flex gap-3">
            <button
              class="flex-1 h-14 rounded-xl bg-red-600 active:bg-red-700 text-white font-semibold text-base transition-colors"
              onClick={() => respond(false)}
            >
              ✕ Deny
            </button>
            <button
              class="flex-1 h-14 rounded-xl bg-green-600 active:bg-green-700 text-white font-semibold text-base transition-colors"
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
