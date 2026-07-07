import type { JSX } from "solid-js";
import { createResource, createSignal, For, onMount, Show } from "solid-js";
import { DashboardClient } from "./client";
import type { DashboardResponse } from "./client";

const DEFAULT_SERVER = "http://localhost:3000";

function getServerUrl(): string {
  return localStorage.getItem("dashboard-server-url") ?? DEFAULT_SERVER;
}

let dashboardClient = new DashboardClient(getServerUrl());

async function fetchDashboard() {
  return dashboardClient.fetchDashboard();
}

function formatMs(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatCost(cost: number): string {
  if (cost === 0) return "$0.00";
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

export function App(): JSX.Element {
  const [serverUrl, setServerUrl] = createSignal(getServerUrl());
  const [dashboard, { refetch }] = createResource<DashboardResponse>(fetchDashboard);
  const [autoRefresh, setAutoRefresh] = createSignal(true);

  // Auto-refresh every 10 seconds
  const autoRefreshEnabled = autoRefresh();
  onMount(() => {
    if (!autoRefreshEnabled) return;
    const interval = setInterval(() => {
      if (autoRefresh()) refetch();
    }, 10000);
    return () => clearInterval(interval);
  });

  function handleServerChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const url = input.value.replace(/\/$/, "");
    setServerUrl(url);
    localStorage.setItem("dashboard-server-url", url);
    dashboardClient = new DashboardClient(url);
    refetch();
  }

  const statusColors: Record<string, string> = {
    active: "bg-emerald-500/20 text-emerald-300",
    completed: "bg-blue-500/20 text-blue-300",
    aborted: "bg-amber-500/20 text-amber-300",
    deleted: "bg-red-500/20 text-red-300",
    archived: "bg-slate-500/20 text-slate-400",
    unknown: "bg-slate-500/20 text-slate-400",
  };

  return (
    <div class="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <header class="border-b border-slate-700 bg-slate-800/50 px-6 py-4">
        <div class="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <h1 class="text-xl font-bold tracking-tight">agent-workbench</h1>
            <p class="text-sm text-slate-400">Observability Dashboard</p>
          </div>
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2">
              <label class="text-xs text-slate-400">Server:</label>
              <input
                type="text"
                value={serverUrl()}
                onBlur={handleServerChange}
                onKeyPress={(e) => e.key === "Enter" && handleServerChange(e)}
                class="bg-slate-700 border border-slate-600 rounded px-3 py-1 text-sm text-slate-200 w-64 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={() => refetch()}
              class="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-500 rounded transition-colors"
            >
              Refresh
            </button>
            <label class="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh()}
                onChange={(e) =>
                  setAutoRefresh((e.target as HTMLInputElement).checked)
                }
                class="accent-blue-500"
              />
              Auto
            </label>
          </div>
        </div>
      </header>

      <main class="max-w-7xl mx-auto p-6">
        <Show when={dashboard.error}>
          <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6 text-red-300">
            <strong>Connection Error:</strong>{" "}
            {dashboard.error?.message ?? "Unknown error"}
            <p class="text-sm mt-1 text-red-400">
              Make sure the agent-workbench server is running and {serverUrl()}{" "}
              is correct.
            </p>
          </div>
        </Show>

        <Show when={dashboard.loading && !dashboard()}>
          <div class="text-slate-400 text-center py-12">
            Loading dashboard data...
          </div>
        </Show>

        <Show when={dashboard()}>
          {(d) => (
            <div class="space-y-6">
              {/* Summary Cards */}
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard
                  label="Total Sessions"
                  value={d().sessions.total}
                  color="blue"
                />
                <SummaryCard
                  label="Total Spans"
                  value={d().spans.total}
                  color="emerald"
                />
                <SummaryCard
                  label="Today's Cost"
                  value={formatCost(d().costs.todayTotal)}
                  color="amber"
                />
                <SummaryCard
                  label="Errors"
                  value={d().errors.total}
                  color={d().errors.total > 0 ? "red" : "emerald"}
                />
              </div>

              {/* Session Status Breakdown */}
              <section class="bg-slate-800/50 border border-slate-700 rounded-lg p-5">
                <h2 class="text-lg font-semibold mb-4">Sessions by Status</h2>
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  <For each={Object.entries(d().sessions.byStatus)}>
                    {([status, count]) => (
                      <div
                        class={`rounded-lg px-4 py-3 text-center ${statusColors[status] ?? "bg-slate-500/20 text-slate-400"}`}
                      >
                        <div class="text-2xl font-bold">{count}</div>
                        <div class="text-xs uppercase tracking-wide mt-1">
                          {status}
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </section>

              {/* Latency Heatmap */}
              <section class="bg-slate-800/50 border border-slate-700 rounded-lg p-5">
                <h2 class="text-lg font-semibold mb-4">Latency by Operation</h2>
                <Show
                  when={Object.keys(d().spans.latencyByOperation).length > 0}
                  fallback={
                    <p class="text-slate-500 text-sm">
                      No span data available yet.
                    </p>
                  }
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
                        <For
                          each={Object.entries(d().spans.latencyByOperation)}
                        >
                          {([name, stats]) => (
                            <tr class="border-b border-slate-700/50 hover:bg-slate-700/30">
                              <td class="py-2 pr-4 text-slate-200 font-mono text-xs">
                                {name}
                              </td>
                              <td class="py-2 pr-4 text-slate-400">
                                {stats.count}
                              </td>
                              <td class="py-2 pr-4">
                                <LatencyBadge ms={stats.p50} />
                              </td>
                              <td class="py-2 pr-4">
                                <LatencyBadge ms={stats.p95} />
                              </td>
                              <td class="py-2 pr-4">
                                <LatencyBadge ms={stats.p99} />
                              </td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </div>
                </Show>
              </section>

              {/* Cost Trends */}
              <section class="bg-slate-800/50 border border-slate-700 rounded-lg p-5">
                <h2 class="text-lg font-semibold mb-4">Cost Trends</h2>
                <Show
                  when={d().costs.daily.length > 0}
                  fallback={
                    <p class="text-slate-500 text-sm">
                      No cost data recorded yet.
                    </p>
                  }
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
                        <For each={d().costs.daily}>
                          {(entry) => (
                            <tr class="border-b border-slate-700/50 hover:bg-slate-700/30">
                              <td class="py-2 pr-4 text-slate-200">
                                {entry.date}
                              </td>
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
            </div>
          )}
        </Show>
      </main>
    </div>
  );
}

function SummaryCard(props: {
  label: string;
  value: string | number;
  color: string;
}): JSX.Element {
  const colorClasses: Record<string, string> = {
    blue: "border-l-blue-500 bg-blue-500/5",
    emerald: "border-l-emerald-500 bg-emerald-500/5",
    amber: "border-l-amber-500 bg-amber-500/5",
    red: "border-l-red-500 bg-red-500/5",
  };

  return (
    <div
      class={`border-l-4 rounded-r-lg px-4 py-3 ${colorClasses[props.color] ?? "border-l-slate-500 bg-slate-500/5"}`}
    >
      <div class="text-xs text-slate-400 uppercase tracking-wide">
        {props.label}
      </div>
      <div class="text-2xl font-bold mt-1">{props.value}</div>
    </div>
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
