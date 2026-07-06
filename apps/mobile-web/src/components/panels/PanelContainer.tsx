import type { JSX } from "solid-js";
import { lazy, Match, Switch } from "solid-js";
import { activePanel } from "../../state/app";

const ChatView = lazy(() =>
  import("../ChatView").then((m) => ({ default: m.ChatView })),
);
const PromptInput = lazy(() =>
  import("../PromptInput").then((m) => ({ default: m.PromptInput })),
);
const WorkspacesView = lazy(() =>
  import("../WorkspacesView").then((m) => ({ default: m.WorkspacesView })),
);
const FileBrowserPanel = lazy(() =>
  import("./FileBrowserPanel").then((m) => ({ default: m.FileBrowserPanel })),
);
const ActivityLogPanel = lazy(() =>
  import("./ActivityLogPanel").then((m) => ({ default: m.ActivityLogPanel })),
);
const SettingsPanel = lazy(() =>
  import("./SettingsPanel").then((m) => ({ default: m.SettingsPanel })),
);

export function PanelContainer(): JSX.Element {
  return (
    <main class="flex-1 overflow-hidden">
      <Switch>
        <Match when={activePanel() === "chat"}>
          <div class="flex flex-col h-full">
            <ChatView />
            <PromptInput />
          </div>
        </Match>
        <Match when={activePanel() === "workspaces"}>
          <WorkspacesView />
        </Match>
        <Match when={activePanel() === "files"}>
          <FileBrowserPanel />
        </Match>
        <Match when={activePanel() === "activity"}>
          <ActivityLogPanel />
        </Match>
        <Match when={activePanel() === "settings"}>
          <SettingsPanel />
        </Match>
        <Match when={activePanel() === "help"}>
          <div class="flex flex-col h-full panel-enter items-center justify-center" style="color: var(--muted); font-size: 14px;">
            Help — accessible via the hamburger menu
          </div>
        </Match>
      </Switch>
    </main>
  );
}
