import { createSignal } from "solid-js";
import type { JSX } from "solid-js";

interface HeaderProps {
  serverUrl: string;
  onServerChange: (url: string) => void;
  onRefresh: () => void;
  autoRefresh: boolean;
  onAutoRefreshChange: (enabled: boolean) => void;
}

export function Header(props: HeaderProps): JSX.Element {
  const [localUrl, setLocalUrl] = createSignal(props.serverUrl);

  function handleBlur() {
    props.onServerChange(localUrl());
  }

  function handleKeyPress(e: KeyboardEvent) {
    if (e.key === "Enter") {
      props.onServerChange(localUrl());
    }
  }

  return (
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
              value={localUrl()}
              onInput={(e) => setLocalUrl(e.currentTarget.value)}
              onBlur={handleBlur}
              onKeyPress={handleKeyPress}
              class="bg-slate-700 border border-slate-600 rounded px-3 py-1 text-sm text-slate-200 w-64 focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            onClick={props.onRefresh}
            class="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-500 rounded transition-colors"
          >
            Refresh
          </button>
          <label class="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={props.autoRefresh}
              onChange={(e) => props.onAutoRefreshChange(e.currentTarget.checked)}
              class="accent-blue-500"
            />
            Auto
          </label>
        </div>
      </div>
    </header>
  );
}
