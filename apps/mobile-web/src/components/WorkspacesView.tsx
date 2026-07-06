import type { JSX } from "solid-js";
import { For, lazy, Match, Switch } from "solid-js";
import { setWorkspaceSubTab, workspaceSubTab } from "../state/app";

const FileBrowserPanel = lazy(() =>
  import("./panels/FileBrowserPanel").then((m) => ({
    default: m.FileBrowserPanel,
  })),
);
const GitTreePanel = lazy(() =>
  import("./panels/GitTreePanel").then((m) => ({ default: m.GitTreePanel })),
);
const SessionsPanel = lazy(() =>
  import("./panels/SessionsPanel").then((m) => ({ default: m.SessionsPanel })),
);

const SUB_TABS = [
  { id: "files" as const, label: "Files" },
  { id: "git" as const, label: "Git" },
  { id: "sessions" as const, label: "Sessions" },
];

export function WorkspacesView(): JSX.Element {
  return (
    <div class="flex flex-col h-full panel-enter">
      {/* Segmented control */}
      <div
        class="flex gap-1 px-3 py-2 border-b shrink-0"
        style="border-bottom-color: var(--border); background: var(--surface);"
        role="tablist"
        aria-label="Workspace sections"
      >
        <For each={SUB_TABS}>
          {(sub) => {
            const isActive = () => workspaceSubTab() === sub.id;
            return (
              <button
                class="flex-1 py-2 rounded-lg text-sm font-medium transition-colors min-h-[36px]"
                role="tab"
                aria-selected={isActive()}
                style={{
                  background: isActive() ? "var(--accent-dim)" : "transparent",
                  color: isActive() ? "var(--fg)" : "var(--muted)",
                }}
                onClick={() => setWorkspaceSubTab(sub.id)}
              >
                {sub.label}
              </button>
            );
          }}
        </For>
      </div>

      {/* Sub-panel content */}
      <div class="flex-1 overflow-hidden">
        <Switch>
          <Match when={workspaceSubTab() === "files"}>
            <FileBrowserPanel />
          </Match>
          <Match when={workspaceSubTab() === "git"}>
            <GitTreePanel />
          </Match>
          <Match when={workspaceSubTab() === "sessions"}>
            <SessionsPanel />
          </Match>
        </Switch>
      </div>
    </div>
  );
}
