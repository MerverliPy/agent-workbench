import type { JSX } from "solid-js";
import { Show, For, createSignal, onCleanup } from "solid-js";
import { drawerOpen, setDrawerOpen, activePanel, selectPanel } from "../state/app";
import type { PanelId } from "../state/app";

interface PanelItem {
  id: PanelId;
  icon: string;
  label: string;
}

const PANELS: PanelItem[] = [
  { id: "chat", icon: "💬", label: "Chat" },
  { id: "files", icon: "📁", label: "File Browser" },
  { id: "git", icon: "🌿", label: "Git Tree" },
  { id: "sessions", icon: "📋", label: "Sessions" },
  { id: "activity", icon: "📊", label: "Activity Log" },
  { id: "settings", icon: "⚙️", label: "Settings" },
  { id: "help", icon: "❓", label: "Help" },
];

const SWIPE_THRESHOLD = 80;

export function NavDrawer(): JSX.Element {
  let drawerRef: HTMLDivElement | undefined;
  const [touchStartX, setTouchStartX] = createSignal<number | null>(null);

  // ── Swipe-to-close on the drawer panel ────────────────────────────
  function handleDrawerTouchStart(e: TouchEvent): void {
    if (e.touches.length === 1) {
      setTouchStartX(e.touches[0]!.clientX);
    }
  }

  function handleDrawerTouchMove(e: TouchEvent): void {
    const startX = touchStartX();
    if (startX === null || e.touches.length !== 1) return;

    const currentX = e.touches[0]!.clientX;
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
    if (e.touches.length === 1 && e.touches[0]!.clientX < 30) {
      setTouchStartX(e.touches[0]!.clientX);
    }
  }

  function handleEdgeTouchMove(e: TouchEvent): void {
    const startX = touchStartX();
    if (startX === null || e.touches.length !== 1) return;

    const currentX = e.touches[0]!.clientX;
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
          <span class="text-sm font-semibold text-slate-300">agent-workbench</span>
          <button
            class="w-11 h-11 flex items-center justify-center rounded-lg active:bg-slate-700 text-slate-400"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
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
                  class={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                    isActive()
                      ? "bg-slate-700/50 text-white border-l-2 border-blue-500"
                      : "text-slate-400 hover:bg-slate-700/30 hover:text-slate-200 border-l-2 border-transparent"
                  }`}
                  onClick={() => selectPanel(item.id)}
                  aria-current={isActive() ? "page" : undefined}
                >
                  <span class="text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            }}
          </For>
        </nav>
      </div>
    </>
  );
}
