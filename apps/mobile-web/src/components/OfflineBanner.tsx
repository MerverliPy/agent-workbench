import type { JSX } from "solid-js";
import { Show } from "solid-js";
import { useOnline } from "../lib/offline";

/**
 * Offline banner shown at the top of the app when network connectivity drops.
 * Uses the existing offline.ts reactive signal.
 */
export function OfflineBanner(): JSX.Element {
  const isOnline = useOnline();

  return (
    <Show when={!isOnline()}>
      <div
        class="flex items-center justify-center gap-2 px-3 py-1.5 bg-yellow-600/90 text-yellow-100 text-xs font-medium animate-pulse"
        role="alert"
      >
        <span>⚠️</span>
        <span>You are offline — reconnecting...</span>
      </div>
    </Show>
  );
}
