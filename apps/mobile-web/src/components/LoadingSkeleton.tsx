import type { JSX } from "solid-js";
import { For } from "solid-js";

/**
 * Skeleton placeholder for loading panels.
 * Shows as animated pulse bars matching the typical list-item layout.
 */
export function LoadingSkeleton(): JSX.Element {
  return (
    <div class="flex flex-col gap-2 p-4 animate-pulse">
      <div class="h-5 bg-slate-700 rounded w-3/4" />
      <div class="h-4 bg-slate-700 rounded w-1/2" />
      <div class="h-4 bg-slate-700 rounded w-5/6" />
      <div class="h-4 bg-slate-700 rounded w-2/3" />
      <div class="h-4 bg-slate-700 rounded w-1/2" />
      <div class="h-4 bg-slate-700 rounded w-3/4" />
      <div class="h-4 bg-slate-700 rounded w-1/3" />
    </div>
  );
}

/**
 * List-item skeleton for session/entry lists.
 */
export function ListSkeleton({ count = 5 }: { count?: number }): JSX.Element {
  const items: number[] = Array.from({ length: count }, (_, i) => i);
  return (
    <div class="flex flex-col animate-pulse">
      <For each={items}>
        {() => (
          <div class="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
            <div class="w-2 h-2 rounded-full bg-slate-600" />
            <div class="flex-1">
              <div class="h-4 bg-slate-700 rounded w-3/4 mb-1" />
              <div class="h-3 bg-slate-700 rounded w-1/3" />
            </div>
          </div>
        )}
      </For>
    </div>
  );
}

/**
 * Full-screen skeleton for initial app load.
 */
export function AppLoadingSkeleton(): JSX.Element {
  return (
    <div class="flex flex-col h-dvh bg-slate-950">
      <div class="h-12 bg-slate-800 animate-pulse" />
      <div class="flex-1 flex flex-col items-center justify-center gap-6 p-8">
        <div class="w-16 h-16 rounded-2xl bg-slate-700 animate-pulse" />
        <div class="h-5 bg-slate-700 rounded w-48 animate-pulse" />
        <div class="h-4 bg-slate-700 rounded w-32 animate-pulse" />
      </div>
    </div>
  );
}
