import type { JSX } from "solid-js";
import { For, Show } from "solid-js";
import { activityEntries } from "../../state/app";

export function ActivityLogPanel(): JSX.Element {
  const entries = () => activityEntries();

  return (
    <div class="flex flex-col h-full panel-enter">
      <div class="flex items-center px-3 py-2 border-b border-slate-700 bg-slate-800/50">
        <span class="text-sm font-semibold text-slate-300">
          📊 Activity Log
        </span>
      </div>

      <div class="flex-1 overflow-y-auto">
        <Show when={entries().length === 0}>
          <div class="text-sm text-slate-500 text-center py-8">
            No activity yet. Events will appear here as they happen.
          </div>
        </Show>

        <For each={entries()}>
          {(entry) => (
            <div class="flex items-start gap-2 px-4 py-2 border-b border-slate-800/50">
              <span class="text-sm mt-0.5">{entry.icon}</span>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between">
                  <span class="text-xs text-slate-400">
                    {new Date(entry.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>
                <span class="text-sm text-slate-300 break-words">
                  {entry.summary}
                </span>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
