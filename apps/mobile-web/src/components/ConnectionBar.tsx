import type { JSX } from "solid-js";
import { connectionStatus } from "../state/app";

/**
 * Thin animated connection status bar.
 * Green pulse when connected, yellow when reconnecting, red when offline/error.
 */
export function ConnectionBar(): JSX.Element {
  const barColor = () => {
    switch (connectionStatus()) {
      case "connected":
        return "bg-green-500";
      case "connecting":
        return "bg-yellow-500 animate-pulse";
      case "error":
        return "bg-red-500";
      default:
        return "bg-slate-600";
    }
  };

  return (
    <div
      class={`h-0.5 transition-all duration-500 ${barColor()}`}
      role="status"
      aria-label={`Connection: ${connectionStatus()}`}
    />
  );
}
