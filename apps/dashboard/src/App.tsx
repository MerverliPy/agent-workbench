import type { JSX } from "solid-js";
import { createResource, createSignal, onMount, Show } from "solid-js";
import type { DashboardResponse } from "./client";
import { DashboardClient } from "./client";

import { Header } from "./components/Header";
import { SummaryCards } from "./components/SummaryCards";
import { StatusBreakdown } from "./components/StatusBreakdown";
import { LatencyHeatmap } from "./components/LatencyHeatmap";
import { CostTrends } from "./components/CostTrends";

const DEFAULT_SERVER = "http://localhost:3000";

function getServerUrl(): string {
  return localStorage.getItem("dashboard-server-url") ?? DEFAULT_SERVER;
}

let dashboardClient = new DashboardClient(getServerUrl());

async function fetchDashboard() {
  return dashboardClient.fetchDashboard();
}

export function App(): JSX.Element {
  const [serverUrl, setServerUrl] = createSignal(getServerUrl());
  const [dashboard, { refetch }] =
    createResource<DashboardResponse>(fetchDashboard);
  const [autoRefresh, setAutoRefresh] = createSignal(true);

  onMount(() => {
    const interval = setInterval(() => {
      if (autoRefresh()) refetch();
    }, 10000);
    return () => clearInterval(interval);
  });

  function handleServerChange(url: string) {
    const cleanUrl = url.replace(/\/$/, "");
    setServerUrl(cleanUrl);
    localStorage.setItem("dashboard-server-url", cleanUrl);
    dashboardClient = new DashboardClient(cleanUrl);
    refetch();
  }

  return (
    <div class="min-h-screen bg-slate-900 text-slate-100">
      <Header
        serverUrl={serverUrl()}
        onServerChange={handleServerChange}
        onRefresh={refetch}
        autoRefresh={autoRefresh()}
        onAutoRefreshChange={setAutoRefresh}
      />

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
              <SummaryCards
                sessions={d().sessions.total}
                spans={d().spans.total}
                cost={d().costs.todayTotal}
                errors={d().errors.total}
              />
              <StatusBreakdown byStatus={d().sessions.byStatus} />
              <LatencyHeatmap latencyByOperation={d().spans.latencyByOperation} />
              <CostTrends daily={d().costs.daily} />
            </div>
          )}
        </Show>
      </main>
    </div>
  );
}
