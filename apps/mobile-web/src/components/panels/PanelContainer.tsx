import type { JSX } from "solid-js";
import { Switch, Match } from "solid-js";
import { activePanel } from "../../state/app";
import { ChatPanel } from "./ChatPanel";
import { FileBrowserPanel } from "./FileBrowserPanel";
import { GitTreePanel } from "./GitTreePanel";
import { SessionsPanel } from "./SessionsPanel";
import { ActivityLogPanel } from "./ActivityLogPanel";
import { SettingsPanel } from "./SettingsPanel";
import { HelpPanel } from "./HelpPanel";

export function PanelContainer(): JSX.Element {
  return (
    <main class="flex-1 overflow-hidden">
      <Switch>
        <Match when={activePanel() === "chat"}>
          <ChatPanel />
        </Match>
        <Match when={activePanel() === "files"}>
          <FileBrowserPanel />
        </Match>
        <Match when={activePanel() === "git"}>
          <GitTreePanel />
        </Match>
        <Match when={activePanel() === "sessions"}>
          <SessionsPanel />
        </Match>
        <Match when={activePanel() === "activity"}>
          <ActivityLogPanel />
        </Match>
        <Match when={activePanel() === "settings"}>
          <SettingsPanel />
        </Match>
        <Match when={activePanel() === "help"}>
          <HelpPanel />
        </Match>
      </Switch>
    </main>
  );
}
