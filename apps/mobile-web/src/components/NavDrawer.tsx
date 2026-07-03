import type { JSX } from "solid-js";
import { createSignal, For, Show } from "solid-js";
import type { PanelId } from "../state/app";
import {
  activePanel,
  drawerOpen,
  selectPanel,
  setDrawerOpen,
} from "../state/app";

interface PanelItem {
  id: PanelId;
  label: string;
}

/* Lucide-style SVG icons — no emoji, consistent sizing */
const SVG_ICONS: Record<PanelId, JSX.Element> = {
  chat: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  files: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
  git: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <circle cx="18" cy="6" r="3" />
      <path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9" />
      <path d="M12 12v3" />
    </svg>
  ),
  sessions: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  ),
  activity: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  settings: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  help: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
};

const PANELS: PanelItem[] = [
  { id: "chat", label: "Chat" },
  { id: "files", label: "File Browser" },
  { id: "git", label: "Git Tree" },
  { id: "sessions", label: "Sessions" },
  { id: "activity", label: "Activity Log" },
  { id: "settings", label: "Settings" },
  { id: "help", label: "Help" },
];

const SWIPE_THRESHOLD = 80;

export function NavDrawer(): JSX.Element {
  let drawerRef: HTMLDivElement | undefined;
  const [touchStartX, setTouchStartX] = createSignal<number | null>(null);

  // ── Swipe-to-close on the drawer panel ────────────────────────────
  function handleDrawerTouchStart(e: TouchEvent): void {
    if (e.touches.length === 1) {
      setTouchStartX(e.touches[0]?.clientX);
    }
  }

  function handleDrawerTouchMove(e: TouchEvent): void {
    const startX = touchStartX();
    if (startX === null || e.touches.length !== 1) return;

    const currentX = e.touches[0]?.clientX;
    const deltaX = currentX - startX;

    // Swipe left on the drawer → close
    if (deltaX < -SWIPE_THRESHOLD) {
      setDrawerOpen(false);
      setTouchStartX(null);
    }
  }

  function handleDrawerTouchEnd(): void {
    setTouchStartX(null);
  }

  // ── Swipe-to-open from left edge ──────────────────────────────────

  function handleEdgeTouchStart(e: TouchEvent): void {
    if (e.touches.length === 1 && e.touches[0]?.clientX < 30) {
      setTouchStartX(e.touches[0]?.clientX);
    }
  }

  function handleEdgeTouchMove(e: TouchEvent): void {
    const startX = touchStartX();
    if (startX === null || e.touches.length !== 1) return;

    const currentX = e.touches[0]?.clientX;
    const deltaX = currentX - startX;

    // Swipe right from left edge → open
    if (deltaX > SWIPE_THRESHOLD) {
      setDrawerOpen(true);
      setTouchStartX(null);
    }
  }

  function handleEdgeTouchEnd(): void {
    setTouchStartX(null);
  }

  return (
    <>
      {/* Swipe-from-left-edge zone (only visible as touch target) */}
      <Show when={!drawerOpen()}>
        <div
          class="fixed left-0 top-0 w-6 h-dvh z-30"
          onTouchStart={handleEdgeTouchStart}
          onTouchMove={handleEdgeTouchMove}
          onTouchEnd={handleEdgeTouchEnd}
          aria-hidden="true"
        />
      </Show>

      {/* Backdrop */}
      <Show when={drawerOpen()}>
        <div
          class="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={() => setDrawerOpen(false)}
        />
      </Show>

      {/* Drawer */}
      <div
        ref={drawerRef}
        class={`fixed top-0 left-0 h-dvh w-72 bg-slate-800 border-r border-slate-700 z-50 transform transition-transform duration-250 shadow-xl ${
          drawerOpen() ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        onTouchStart={handleDrawerTouchStart}
        onTouchMove={handleDrawerTouchMove}
        onTouchEnd={handleDrawerTouchEnd}
      >
        <div class="flex items-center justify-between px-4 h-11 border-b border-slate-700 safe-top">
          <span class="text-sm font-semibold text-slate-300">
            agent-workbench
          </span>
          <button
            class="w-11 h-11 flex items-center justify-center rounded-lg active:bg-slate-700 text-slate-400"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <nav class="py-2">
          <For each={PANELS}>
            {(item) => {
              const isActive = () => activePanel() === item.id;
              return (
                <button
                  class={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors relative ${
                    isActive()
                      ? "bg-slate-700/50 text-white border-l-2 border-blue-500"
                      : "text-slate-400 hover:bg-slate-700/30 hover:text-slate-200 border-l-2 border-transparent"
                  }`}
                  onClick={() => selectPanel(item.id)}
                  aria-current={isActive() ? "page" : undefined}
                >
                  <span class="text-slate-400">{SVG_ICONS[item.id]}</span>
                  <span>{item.label}</span>
                  {isActive() && (
                    <span class="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-500 rounded-full animate-pulse" />
                  )}
                </button>
              );
            }}
          </For>
        </nav>
      </div>
    </>
  );
}
