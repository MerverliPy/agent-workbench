import type { JSX } from "solid-js";
import { lazy, Match, Switch } from "solid-js";
import { activePanel } from "../../state/app";

const ChatPanel = lazy(() =>
  import("./ChatPanel").then((m) => ({ default: m.ChatPanel })),
);
const FileBrowserPanel = lazy(() =>
  import("./FileBrowserPanel").then((m) => ({ default: m.FileBrowserPanel })),
);
const GitTreePanel = lazy(() =>
  import("./GitTreePanel").then((m) => ({ default: m.GitTreePanel })),
);
const SessionsPanel = lazy(() =>
  import("./SessionsPanel").then((m) => ({ default: m.SessionsPanel })),
);
const ActivityLogPanel = lazy(() =>
  import("./ActivityLogPanel").then((m) => ({ default: m.ActivityLogPanel })),
);
const SettingsPanel = lazy(() =>
  import("./SettingsPanel").then((m) => ({ default: m.SettingsPanel })),
);
const HelpPanel = lazy(() =>
  import("./HelpPanel").then((m) => ({ default: m.HelpPanel })),
);

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
