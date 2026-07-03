import type { JSX } from "@opentui/solid";
import { Show } from "solid-js";
import {
  commandPaletteOpen,
  comparisonOpen,
  diffViewerOpen,
  ledgerPanelOpen,
  permissionModalOpen,
  playgroundOpen,
  tokenHealthOpen,
} from "../../state/app";
import { MessageTimeline } from "../messages/MessageTimeline";
import { CommandPalette } from "../palette/CommandPalette";
import { ComparisonPanel } from "../panels/ComparisonPanel";
import { DiffViewer } from "../panels/DiffViewer";
import { LedgerPanel } from "../panels/LedgerPanel";
import { PermissionModal } from "../panels/PermissionModal";
import { PlaygroundPanel } from "../panels/PlaygroundPanel";
import { TokenHealthPanel } from "../panels/TokenHealthPanel";
import { PromptEditor } from "../prompt/PromptEditor";
import { SessionSidebar } from "../session/SessionSidebar";
import { StatusBar } from "../status/StatusBar";
import { Header } from "./Header";

/**
 * Root chat-first layout.
 *
 * ┌──────────────────────────────────────────┐  ← Header (height 1)
 * ├──────────────┬───────────────────────────┤
 * │ Sessions     │ Message timeline          │  ← Main (flexGrow 1)
 * │  (width 22)  │                           │
 * ├──────────────┴───────────────────────────┤
 * │ Prompt editor           (height 5)       │
 * ├──────────────────────────────────────────┤
 * │ Status bar              (height 1)       │
 * └──────────────────────────────────────────┘
 *
 * Overlays (command palette, modals) render on top via Portal / absolute box.
 */
export function AppLayout(): JSX.Element {
  return (
    <box flexDirection="column" width="100%" height="100%">
      <Header />

      {/* Main area: sidebar + timeline */}
      <box flexDirection="row" flexGrow={1} overflow="hidden">
        <SessionSidebar />
        <MessageTimeline />
      </box>

      <PromptEditor />
      <StatusBar />

      {/* Overlays rendered last so they paint above layout siblings */}
      <Show when={commandPaletteOpen()}>
        <CommandPalette />
      </Show>
      <Show when={permissionModalOpen()}>
        <PermissionModal />
      </Show>
      <Show when={diffViewerOpen()}>
        <DiffViewer />
      </Show>
      <Show when={ledgerPanelOpen()}>
        <LedgerPanel />
      </Show>
      <Show when={tokenHealthOpen()}>
        <TokenHealthPanel />
      </Show>
      <Show when={playgroundOpen()}>
        <PlaygroundPanel />
      </Show>
      <Show when={comparisonOpen()}>
        <ComparisonPanel />
      </Show>
    </box>
  );
}
