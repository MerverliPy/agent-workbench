import type { JSX } from "solid-js";
import { onMount, Show } from "solid-js";
import {
  connectionError,
  connectionStatus,
  currentAgentId,
  pendingApprovalCount,
  setDrawerOpen,
} from "../state/app";

type ThemeState = "auto" | "dark" | "light";

const THEME_KEY = "agent-workbench-theme";

function getStoredTheme(): ThemeState {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "dark" || stored === "light" || stored === "auto")
      return stored;
  } catch {}
  return "auto";
}

function applyTheme(theme: ThemeState): void {
  const root = document.documentElement;
  root.classList.remove("dark", "light");

  if (theme === "dark") {
    root.classList.add("dark");
  } else if (theme === "light") {
    root.classList.add("light");
  }
  // auto: no class — respects prefers-color-scheme via CSS

  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}

  // Dispatch a custom event so SettingsPanel can sync
  window.dispatchEvent(new CustomEvent("theme-changed", { detail: theme }));
}

function cycleTheme(current: ThemeState): ThemeState {
  const next: Record<ThemeState, ThemeState> = {
    auto: "dark",
    dark: "light",
    light: "auto",
  };
  return next[current];
}

function themeIcon(theme: ThemeState): string {
  if (theme === "dark") return "☀";
  if (theme === "light") return "☾";
  return "◐";
}

function themeAriaLabel(theme: ThemeState): string {
  if (theme === "dark") return "Switch to light mode";
  if (theme === "light") return "Use system theme";
  return "Switch to dark mode";
}

export function TopBar(): JSX.Element {
  let theme: ThemeState = getStoredTheme();

  onMount(() => {
    // Ensure theme is applied on mount (handles edge cases where script didn't run)
    applyTheme(theme);
  });

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
    <header
      class="frost flex items-center h-[52px] px-3.5 gap-2.5 border-b shrink-0 z-10"
      style="border-bottom-color: var(--border);"
    >
      {/* Hamburger */}
      <button
        class="flex items-center justify-center w-11 h-11 -ml-1 rounded-lg active:bg-slate-700/30 transition-colors shrink-0"
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

      {/* Workspace name */}
      <span
        class="text-[14px] font-semibold tracking-[-0.005em] truncate flex-1 min-w-0"
      >
        Hermes Audit Workspace
      </span>

      {/* Model chip */}
      <span
        class="inline-flex items-center gap-1 px-[9px] py-[4px] rounded-[999px] text-[11px] font-mono font-medium whitespace-nowrap shrink-0"
        style="background: var(--accent-dim); letter-spacing: 0.02em;"
      >
        {currentAgentId() === "plan" ? "Plan" : "Build"} ▾
      </span>

      {/* Context % chip */}
      <span
        class="inline-flex items-center gap-1 px-[9px] py-[4px] rounded-[999px] text-[11px] font-mono font-medium whitespace-nowrap shrink-0"
        style="background: var(--border-soft); letter-spacing: 0.02em; color: var(--muted);"
      >
        42%
      </span>

      {/* Mode chip */}
      <span
        class="inline-flex items-center gap-1 px-[9px] py-[4px] rounded-[999px] text-[10px] font-semibold uppercase tracking-[0.03em] whitespace-nowrap shrink-0"
        style="border: 1px solid var(--border); color: var(--muted);"
      >
        Safe
      </span>

      {/* Pending approval badge */}
      <Show when={pendingApprovalCount() > 0}>
        <span
          class="inline-flex items-center gap-1 px-[9px] py-[4px] rounded-[999px] text-[11px] font-semibold whitespace-nowrap shrink-0"
          style="background: var(--warn-soft); color: var(--warn);"
        >
          ⚠ {pendingApprovalCount()} pending
        </span>
      </Show>

      {/* Connection dot */}
      <div
        class="flex items-center gap-1.5 shrink-0"
        title={connectionError() ?? ""}
      >
        <span class={`w-2 h-2 rounded-full ${statusColor()}`} />
        <span
          class="text-[12px] font-mono"
          style="color: var(--muted);"
        >
          {statusLabel()}
        </span>
      </div>

      {/* Theme toggle */}
      <button
        class="w-[30px] h-[30px] grid place-items-center rounded-full text-[15px] shrink-0 transition-colors active:bg-white/10"
        style={{ color: "var(--muted)" }}
        id="themeToggle"
        onClick={() => {
          theme = cycleTheme(theme);
          applyTheme(theme);
          // Update icon
          const btn = document.getElementById("themeToggle");
          if (btn) {
            btn.textContent = themeIcon(theme);
            btn.setAttribute("aria-label", themeAriaLabel(theme));
          }
        }}
        aria-label={themeAriaLabel(theme)}
        title="Toggle dark mode"
      >
        {themeIcon(theme)}
      </button>
    </header>
  );
}

function computeErrorLabel(error: string | null): string {
  if (!error) return "Error";
  const msg = error.toLowerCase();
  if (msg.includes("connection refused") || msg.includes("unreachable"))
    return "Server unreachable";
  if (msg.includes("timed out") || msg.includes("cancelled"))
    return "Request timed out";
  if (msg.includes("cors")) return "CORS blocked";
  if (msg.includes("401") || msg.includes("unauthorized")) return "Unauthorized";
  if (msg.includes("403") || msg.includes("forbidden")) return "Forbidden";
  if (msg.includes("404") || msg.includes("not found")) return "Route not found";
  if (msg.includes("500") || msg.includes("internal")) return "Server error";
  if (msg.includes("501") || msg.includes("not implemented")) return "Not implemented";
  if (msg.includes("502") || msg.includes("bad gateway")) return "Bad gateway";
  if (msg.includes("503") || msg.includes("unavailable")) return "Service unavailable";
  const statusMatch = error.match(/\b(\d{3})\b/);
  if (statusMatch) return `HTTP ${statusMatch[1]}`;
  return "Error";
}
