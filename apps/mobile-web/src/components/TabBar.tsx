import type { JSX } from "solid-js";
import { For } from "solid-js";
import {
  activePanel,
  type PanelId,
  setActivePanel,
  setDrawerOpen,
} from "../state/app";
import { ActivityIcon, ChatIcon, FileIcon, SettingsIcon, WorkspaceIcon } from "./icons";

interface TabItem {
  id: PanelId;
  label: string;
  icon: JSX.Element;
}

const TABS: TabItem[] = [
  {
    id: "chat",
    label: "Chats",
    icon: <ChatIcon />,
  },
  {
    id: "workspaces",
    label: "Workspaces",
    icon: <WorkspaceIcon />,
  },
  {
    id: "files",
    label: "Files",
    icon: <FileIcon />,
  },
  {
    id: "activity",
    label: "Activity",
    icon: <ActivityIcon />,
  },
  {
    id: "settings",
    label: "Settings",
    icon: <SettingsIcon />,
  },
];

export function TabBar(): JSX.Element {
  return (
    <nav
      class="frost flex justify-around items-center h-[50px] shrink-0 border-t"
      aria-label="Main navigation"
      role="tablist"
      style="border-top-color: var(--border); padding-bottom: var(--safe-bottom);"
    >
      <For each={TABS}>
        {(tab) => {
          const isActive = () => activePanel() === tab.id;
          return (
            <button
              class="flex flex-col items-center gap-0.5 px-2.5 py-1 text-[10px] font-medium transition-colors"
              role="tab"
              aria-selected={isActive()}
              aria-controls={`panel-${tab.id}`}
              style={
                "color: " +
                (isActive() ? "var(--fg)" : "var(--muted)") +
                "; font-weight: " +
                (isActive() ? 600 : 500) +
                "; letter-spacing: 0.02em; -webkit-tap-highlight-color: transparent;"
              }
              onClick={() => {
                setActivePanel(tab.id);
                setDrawerOpen(false);
              }}
            >
              <span class="text-[20px] leading-none" aria-hidden="true">
                {tab.icon}
              </span>
              {tab.label}
            </button>
          );
        }}
      </For>
    </nav>
  );
}
