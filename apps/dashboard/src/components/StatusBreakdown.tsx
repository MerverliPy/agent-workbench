import type { JSX } from "solid-js";
import { For } from "solid-js";

interface StatusBreakdownProps {
  byStatus: Record<string, number>;
}

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-300",
  completed: "bg-blue-500/20 text-blue-300",
  aborted: "bg-amber-500/20 text-amber-300",
  deleted: "bg-red-500/20 text-red-300",
  archived: "bg-slate-500/20 text-slate-400",
  unknown: "bg-slate-500/20 text-slate-400",
};

export function StatusBreakdown(props: StatusBreakdownProps): JSX.Element {
  return (
    <section class="bg-slate-800/50 border border-slate-700 rounded-lg p-5">
      <h2 class="text-lg font-semibold mb-4">Sessions by Status</h2>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <For each={Object.entries(props.byStatus)}>
          {([status, count]) => (
            <div
              class={`rounded-lg px-4 py-3 text-center ${statusColors[status] ?? "bg-slate-500/20 text-slate-400"}`}
            >
              <div class="text-2xl font-bold">{count}</div>
              <div class="text-xs uppercase tracking-wide mt-1">{status}</div>
            </div>
          )}
        </For>
      </div>
    </section>
  );
}
