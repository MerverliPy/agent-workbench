import type { JSX } from "solid-js";
import { createSignal, onMount, Show } from "solid-js";
import { getClient } from "../../lib/sdk";
import { appendMessage } from "../../state/app";

export function GitTreePanel(): JSX.Element {
  const [branch, setBranch] = createSignal<string>("");
  const [status, setStatus] = createSignal<string>("");
  const [commits, setCommits] = createSignal<string>("");
  const [loading, setLoading] = createSignal(false);

  async function loadGitInfo(): Promise<void> {
    setLoading(true);
    try {
      // Git info is fetched by submitting a message to the agent with bash tool
      // For direct git info, we check if the session can run git commands
      const client = getClient();

      // Try getting session and sending git status as a prompt
      const sessions = await client.sessions.list();
      const sessionId = sessions.items[0]?.id;

      if (sessionId) {
        // Ask the agent for git status — this goes through the permission-gated path
        await client.messages.submit(sessionId, {
          content: "Run: git status --short --branch, then git log --oneline -10. Just show the raw output, no commentary.",
          role: "user",
        });
        appendMessage({
          id: `system-git-${Date.now()}`,
          role: "system",
          content: "Git info requested — check the Chat panel for results",
          createdAt: new Date().toISOString(),
        });
        setBranch("Requested in chat...");
      } else {
        setBranch("(no active session)");
      }
    } catch {
      setBranch("(connection error)");
    } finally {
      setLoading(false);
    }
  }

  onMount(() => {
    loadGitInfo();
  });

  return (
    <div class="flex flex-col h-full panel-enter">
      <div class="flex items-center justify-between px-3 py-2 border-b border-slate-700 bg-slate-800/50">
        <span class="text-sm font-semibold text-slate-300">🌿 Git Tree</span>
        <button
          class="text-xs bg-slate-700 text-slate-300 px-3 py-1 rounded-lg active:bg-slate-600"
          onClick={loadGitInfo}
        >
          Refresh
        </button>
      </div>

      <div class="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        <Show when={branch() || loading()}>
          <div>
            <span class="text-xs text-slate-500 block mb-1">Status</span>
            <span class="text-sm text-slate-300 bg-slate-800 rounded px-2 py-1 inline-block">
              {branch() || "Loading..."}
            </span>
          </div>
        </Show>

        <Show when={!loading()}>
          <div class="text-sm text-slate-400 space-y-2">
            <p>Git operations are performed through the permission-gated agent.</p>
            <p>📋 <strong>How to use:</strong> Ask the agent in the Chat panel for git status, commits, or diffs. The agent will request permission before running any git commands.</p>
            <p>Example prompts:</p>
            <ul class="list-disc list-inside space-y-1 text-xs text-slate-500">
              <li>"Show git status and recent commits"</li>
              <li>"View the diff for src/index.ts"</li>
              <li>"Commit all changes with a message"</li>
            </ul>
          </div>
        </Show>

        <Show when={loading()}>
          <div class="text-sm text-slate-500 text-center py-4">Loading git info...</div>
        </Show>
      </div>
    </div>
  );
}
