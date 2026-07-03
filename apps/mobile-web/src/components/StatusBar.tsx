import type { JSX } from "solid-js";
import {
  connectionError,
  connectionStatus,
  currentAgentId,
  setDrawerOpen,
} from "../state/app";

export function StatusBar(): JSX.Element {
  const statusColor = () => {
    switch (connectionStatus()) {
      case "connected":
        return "bg-green-500";
      case "connecting":
        return "bg-yellow-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-slate-600";
    }
  };

  const statusLabel = () => {
    switch (connectionStatus()) {
      case "connected":
        return "Connected";
      case "connecting":
        return "Connecting...";
      case "error":
        return computeErrorLabel(connectionError());
      default:
        return "Offline";
    }
  };

  return (
    <header class="flex items-center justify-between h-11 px-3 bg-slate-800 border-b border-slate-700 safe-top shrink-0">
      <button
        class="flex items-center justify-center w-11 h-11 -ml-1 rounded-lg active:bg-slate-700 transition-colors"
        onClick={() => setDrawerOpen(true)}
        aria-label="Open menu"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
      </button>

      <div class="flex items-center gap-2" title={connectionError() ?? ""}>
        <span class={`w-2 h-2 rounded-full ${statusColor()}`} />
        <span class="text-xs text-slate-400">{statusLabel()}</span>
      </div>

      <span class="text-xs font-medium bg-slate-700 text-slate-300 px-2 py-0.5 rounded-md">
        {currentAgentId()}
      </span>
    </header>
  );
}

/** Classify the raw error string into a concise, user-facing label. */
function computeErrorLabel(error: string | null): string {
  if (!error) return "Error";
  const msg = error.toLowerCase();
  if (msg.includes("connection refused") || msg.includes("unreachable"))
    return "Server unreachable";
  if (msg.includes("timed out") || msg.includes("cancelled"))
    return "Request timed out";
  if (msg.includes("cors")) return "CORS blocked";
  if (msg.includes("401") || msg.includes("unauthorized"))
    return "Unauthorized";
  if (msg.includes("403") || msg.includes("forbidden")) return "Forbidden";
  if (msg.includes("404") || msg.includes("not found"))
    return "Route not found";
  if (msg.includes("500") || msg.includes("internal")) return "Server error";
  if (msg.includes("501") || msg.includes("not implemented"))
    return "Not implemented";
  if (msg.includes("502") || msg.includes("bad gateway")) return "Bad gateway";
  if (msg.includes("503") || msg.includes("unavailable"))
    return "Service unavailable";
  // Catch any HTTP status in the message
  const statusMatch = error.match(/\b(\d{3})\b/);
  if (statusMatch) return `HTTP ${statusMatch[1]}`;
  return "Error";
}
