import type { JSX } from "solid-js";
import { connectionStatus } from "../state/app";

/**
 * Thin animated connection status bar per DESIGN.md spec:
 * 3px, success bg, 2s pulse animation (opacity 0.6→1→0.6)
 */
export function ConnectionBar(): JSX.Element {
  const barColor = () => {
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

  const pulseClass = () => {
    return connectionStatus() === "connected" ? "animate-connection-pulse" : "";
  };

  return (
    <div
      class={`h-[3px] transition-all duration-500 ${barColor()} ${pulseClass()}`}
      role="status"
      aria-label={`Connection: ${connectionStatus()}`}
    />
  );
}
