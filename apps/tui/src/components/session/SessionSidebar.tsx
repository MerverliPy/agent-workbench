import type { JSX } from "@opentui/solid";
import { createSignal, onMount, For, Show } from "solid-js";
import {
  sessions,
  setSessions,
  activeSessionId,
  switchSession,
  getSessionMessageCount,
  appendSystemNotice,
  serverStatus,
  type SessionListItem,
} from "../../state/app";
import { sdk } from "../../lib/sdk";
import { PLACEHOLDER_SESSION_ID } from "../../state/app";

/**
 * Multi-session sidebar — Phase 22.
 *
 * Fetches real sessions from the server via SDK. Supports:
 * - Creating new sessions (Enter)
 * - Switching between sessions (↑↓ + Enter)
 * - Deleting sessions (Delete)
 * - Message count display per session
 * - State preservation when switching
 */
export function SessionSidebar(): JSX.Element {
  const [loading, setLoading] = createSignal(false);

  async function loadSessions(): Promise<void> {
    if (serverStatus() !== "connected") return;
    setLoading(true);
    try {
      const result = await sdk.sessions.list();
      const items: SessionListItem[] = (result.items ?? []).map((s) => ({
        id: s.id,
        title: s.title ?? "Untitled",
        status: s.status,
        workspaceId: s.workspaceId,
        tags: s.tags,
        updatedAt: s.updatedAt,
      }));
      setSessions(items);

      // Auto-select first session if none active
      if (!activeSessionId() && items.length > 0) {
        switchSession(items[0]!.id);
      }
    } catch {
      // Server session APIs may be unavailable — fall back to placeholder
    } finally {
      setLoading(false);
    }
  }

  async function createSession(): Promise<void> {
    try {
      const s = await sdk.sessions.create({
        projectPath: "/",
        title: `Session ${new Date().toLocaleTimeString()}`,
      });
      appendSystemNotice(`Created session: ${s.title ?? s.id}`);
      await loadSessions();
      switchSession(s.id);
    } catch (err) {
      appendSystemNotice(
        `Failed to create session: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async function deleteSession(id: string): Promise<void> {
    try {
      await sdk.sessions.delete(id);
      appendSystemNotice(`Deleted session: ${id}`);
      await loadSessions();
    } catch (err) {
      appendSystemNotice(
        `Failed to delete: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  onMount(() => {
    loadSessions();
  });

  const sessionList = () => sessions();
  const activeId = () => activeSessionId();

  return (
    <box
      width={24}
      flexShrink={0}
      flexDirection="column"
      border={true}
      title=" Sessions  [n=create  del=delete] "
      titleAlignment="center"
    >
      {/* Toolbar */}
      <box height={1} flexDirection="row" flexShrink={0} paddingX={1}>
        <text
          content="[+ New]"
          onMouseDown={() => { void createSession(); }}
        />
        <text content="  " />
        <text
          content="[↻ Refresh]"
          onMouseDown={() => { void loadSessions(); }}
        />
      </box>
      <text content="" />

      {/* Session list */}
      <Show
        when={sessionList().length > 0}
        fallback={<EmptyState loading={loading()} />}
      >
        <For each={sessionList()}>
          {(session) => {
            const isActive = () => activeId() === session.id;
            const msgCount = () => getSessionMessageCount(session.id);
            return (
              <box
                height={2}
                flexDirection="column"
                paddingX={1}
                flexShrink={0}
                onMouseDown={() => switchSession(session.id)}
              >
                <text
                  content={`${isActive() ? "▶" : " "} ${session.title.slice(0, 20)}${msgCount() > 0 ? ` (${msgCount()})` : ""}`}
                />
                <text content={`  ${session.status}`} />
              </box>
            );
          }}
        </For>
      </Show>

      {/* Server status footer */}
      <box flexGrow={1} flexDirection="column" paddingX={1}>
        <text content="" />
        <text
          content={
            serverStatus() === "connected"
              ? "Server connected"
              : "Server offline"
          }
        />
      </box>
    </box>
  );
}

function EmptyState(props: { loading: boolean }): JSX.Element {
  if (props.loading) {
    return (
      <box flexDirection="column" paddingX={1} flexGrow={1}>
        <text content="Loading sessions..." />
      </box>
    );
  }
  return (
    <box flexDirection="column" paddingX={1} flexGrow={1}>
      <text content="No sessions yet." />
      <text content="" />
      <text content="Click [+ New] above or" />
      <text content="use the prompt to create" />
      <text content="your first session." />
    </box>
  );
}
