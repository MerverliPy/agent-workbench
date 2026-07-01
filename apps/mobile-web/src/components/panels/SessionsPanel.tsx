import type { JSX } from "solid-js";
import { createSignal, onMount, For, Show } from "solid-js";
import { getClient } from "../../lib/sdk";
import { selectPanel } from "../../state/app";

interface SessionInfo {
  id: string;
  title: string;
  messageCount: number;
  isActive: boolean;
}

export function SessionsPanel(): JSX.Element {
  const [sessions, setSessions] = createSignal<SessionInfo[]>([]);
  const [loading, setLoading] = createSignal(false);

  async function loadSessions(): Promise<void> {
    setLoading(true);
    try {
      const client = getClient();
      const result = await client.sessions.list();
      const items = result.items ?? [];
      const infos: SessionInfo[] = items.map((s, i) => ({
        id: s.id,
        title: s.title ?? `Session ${i + 1}`,
        messageCount: 0,
        isActive: i === 0,
      }));
      setSessions(infos);
    } catch {
      // Server may not have sessions endpoint ready
    } finally {
      setLoading(false);
    }
  }

  async function createSession(): Promise<void> {
    try {
      const client = getClient();
      await client.sessions.create({
        projectPath: "/",
        title: `Session ${Date.now()}`,
      });
      loadSessions();
    } catch {
      // Silently fail
    }
  }

  onMount(() => {
    loadSessions();
  });

  return (
    <div class="flex flex-col h-full panel-enter">
      <div class="flex items-center justify-between px-3 py-2 border-b border-slate-700 bg-slate-800/50">
        <span class="text-sm font-semibold text-slate-300">📋 Sessions</span>
        <button
          class="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg active:bg-blue-700"
          onClick={createSession}
        >
          + New
        </button>
      </div>

      <div class="flex-1 overflow-y-auto">
        <Show when={loading()}>
          <div class="text-sm text-slate-500 text-center py-4">Loading...</div>
        </Show>

        <Show when={!loading() && sessions().length === 0}>
          <div class="text-sm text-slate-500 text-center py-8">
            No sessions yet. Tap "+ New" to create one.
          </div>
        </Show>

        <For each={sessions()}>
          {(session) => (
            <button
              class="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/50 active:bg-slate-700/50 border-b border-slate-800 transition-colors"
              onClick={() => selectPanel("chat")}
            >
              <span class={`w-2 h-2 rounded-full ${session.isActive ? "bg-green-500" : "bg-slate-600"}`} />
              <div class="flex-1 text-left">
                <span class="text-sm text-slate-200 block">{session.title}</span>
                <span class="text-xs text-slate-500">{session.messageCount} messages</span>
              </div>
            </button>
          )}
        </For>
      </div>
    </div>
  );
}
