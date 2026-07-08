import type { JSX } from "solid-js";
import { For, Show } from "solid-js";
import { formatCost } from "../utils/format";

interface CostTrendsProps {
  daily: Array<{ date: string; cost: number }>;
}

export function CostTrends(props: CostTrendsProps): JSX.Element {
  return (
    <section class="bg-slate-800/50 border border-slate-700 rounded-lg p-5">
      <h2 class="text-lg font-semibold mb-4">Cost Trends</h2>
      <Show
        when={props.daily.length > 0}
        fallback={<p class="text-slate-500 text-sm">No cost data recorded yet.</p>}
      >
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-slate-700 text-left text-slate-400">
                <th class="pb-2 pr-4 font-medium">Date</th>
                <th class="pb-2 pr-4 font-medium">Cost (USD)</th>
              </tr>
            </thead>
            <tbody>
              <For each={props.daily}>
                {(entry) => (
                  <tr class="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td class="py-2 pr-4 text-slate-200">{entry.date}</td>
                    <td class="py-2 pr-4">
                      <span
                        class={
                          entry.cost > 1
                            ? "text-amber-300"
                            : entry.cost > 0.1
                              ? "text-yellow-300"
                              : "text-emerald-300"
                        }
                      >
                        {formatCost(entry.cost)}
                      </span>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
    </section>
  );
}
