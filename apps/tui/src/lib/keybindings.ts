/**
 * Centralized keyboard shortcut registry for the TUI.
 *
 * All shortcuts are documented here so the Ctrl+/ reference and
 * the /help palette command stay in sync. Future: load from
 * ~/.agent-workbench/keybindings.json for user remapping.
 */

export interface Keybinding {
  /** Human-readable key combo (e.g. "Ctrl+K") */
  readonly combo: string;
  /** What it does */
  readonly description: string;
  /** Category for grouping */
  readonly category: "global" | "prompt" | "navigation" | "panels";
}

export const KEYBINDINGS: readonly Keybinding[] = [
  // ── Global ──
  {
    combo: "Ctrl+K / Ctrl+P",
    description: "Open command palette",
    category: "global",
  },
  { combo: "Escape", description: "Close active overlay", category: "global" },
  {
    combo: "Ctrl+/",
    description: "Show keyboard shortcuts",
    category: "global",
  },
  { combo: "Ctrl+C", description: "Exit TUI", category: "global" },

  // ── Navigation ──
  {
    combo: "Ctrl+1",
    description: "Switch to Build agent",
    category: "navigation",
  },
  {
    combo: "Ctrl+2",
    description: "Switch to Plan agent",
    category: "navigation",
  },
  {
    combo: "↑ / ↓",
    description: "Navigate command palette / scroll",
    category: "navigation",
  },

  // ── Prompt ──
  { combo: "Ctrl+Enter", description: "Submit prompt", category: "prompt" },
  {
    combo: "Enter",
    description: "Newline in prompt editor",
    category: "prompt",
  },
  {
    combo: "Shift+Enter",
    description: "Newline (same as Enter)",
    category: "prompt",
  },

  // ── Panels ──
  { combo: "Ctrl+D", description: "Toggle diff viewer", category: "panels" },
  {
    combo: "Ctrl+T",
    description: "Toggle token health panel",
    category: "panels",
  },
  {
    combo: "Ctrl+P",
    description: "Toggle model playground",
    category: "panels",
  },
  {
    combo: "Ctrl+M",
    description: "Toggle model comparison",
    category: "panels",
  },
  {
    combo: "Ctrl+L",
    description: "Clear message timeline",
    category: "panels",
  },
];

/**
 * Format all keybindings as a compact reference string.
 */
export function formatKeybindings(): string {
  return KEYBINDINGS.map((k) => `${k.combo}: ${k.description}`).join("  |  ");
}
