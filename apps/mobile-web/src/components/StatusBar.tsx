import type { JSX } from "solid-js";
import { connectionStatus, currentAgentId, setDrawerOpen } from "../state/app";

export function StatusBar(): JSX.Element {
  const statusColor = () => {
    switch (connectionStatus()) {
      case "connected": return "bg-green-500";
      case "connecting": return "bg-yellow-500";
      case "error": return "bg-red-500";
      default: return "bg-slate-600";
    }
  };

  const statusLabel = () => {
    switch (connectionStatus()) {
      case "connected": return "Connected";
      case "connecting": return "Connecting...";
      case "error": return "Error";
      default: return "Offline";
    }
  };

  return (
    <header class="flex items-center justify-between h-11 px-3 bg-slate-800 border-b border-slate-700 safe-top shrink-0">
      <button
        class="flex items-center justify-center w-9 h-9 -ml-1 rounded-lg active:bg-slate-700 transition-colors"
        onClick={() => setDrawerOpen(true)}
        aria-label="Open menu"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
      </button>

      <div class="flex items-center gap-2">
        <span class={`w-2 h-2 rounded-full ${statusColor()}`} />
        <span class="text-xs text-slate-400">{statusLabel()}</span>
      </div>

      <span class="text-xs font-medium bg-slate-700 text-slate-300 px-2 py-0.5 rounded-md">
        {currentAgentId()}
      </span>
    </header>
  );
}
