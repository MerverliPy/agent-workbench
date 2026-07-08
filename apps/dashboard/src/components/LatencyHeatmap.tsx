import type { JSX } from "solid-js";
import { For, Show } from "solid-js";
import { formatMs } from "../utils/format";

interface LatencyHeatmapProps {
  latencyByOperation: Record<
    string,
    { count: number; p50: number; p95: number; p99: number }
  >;
}

export function LatencyHeatmap(props: LatencyHeatmapProps): JSX.Element {
  return (
    <section class="bg-slate-800/50 border border-slate-700 rounded-lg p-5">
      <h2 class="text-lg font-semibold mb-4">Latency by Operation</h2>
      <Show
        when={Object.keys(props.latencyByOperation).length > 0}
        fallback={<p class="text-slate-500 text-sm">No span data available yet.</p>}
      >
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-slate-700 text-left text-slate-400">
                <th class="pb-2 pr-4 font-medium">Operation</th>
                <th class="pb-2 pr-4 font-medium">Count</th>
                <th class="pb-2 pr-4 font-medium">p50</th>
                <th class="pb-2 pr-4 font-medium">p95</th>
                <th class="pb-2 pr-4 font-medium">p99</th>
              </tr>
            </thead>
            <tbody>
              <For each={Object.entries(props.latencyByOperation)}>
                {([name, stats]) => (
                  <tr class="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td class="py-2 pr-4 text-slate-200 font-mono text-xs">{name}</td>
                    <td class="py-2 pr-4 text-slate-400">{stats.count}</td>
                    <td class="py-2 pr-4"><LatencyBadge ms={stats.p50} /></td>
                    <td class="py-2 pr-4"><LatencyBadge ms={stats.p95} /></td>
                    <td class="py-2 pr-4"><LatencyBadge ms={stats.p99} /></td>
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

function LatencyBadge(props: { ms: number }): JSX.Element {
  const ms = props.ms;
  const color =
    ms < 10
      ? "text-emerald-400"
      : ms < 100
        ? "text-green-400"
        : ms < 500
          ? "text-yellow-400"
          : ms < 2000
            ? "text-amber-400"
            : "text-red-400";

  return <span class={`font-mono text-xs ${color}`}>{formatMs(ms)}</span>;
}
