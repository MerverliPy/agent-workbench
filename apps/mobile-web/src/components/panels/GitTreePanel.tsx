import type { JSX } from "solid-js";
import { createSignal, onMount, For, Show } from "solid-js";
import { getSettings } from "../../lib/settings";
import { LoadingSkeleton } from "../LoadingSkeleton";

interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  date: string;
}

interface GitStatusData {
  branch: string;
  ahead: number;
  behind: number;
  dirtyFiles: number;
  stagedFiles: number;
  untrackedFiles: number;
  statusOutput: string;
  recentCommits: CommitInfo[];
}

function shortenHash(hash: string): string {
  return hash.slice(0, 7);
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return dateStr;
  }
}

export function GitTreePanel(): JSX.Element {
  const [data, setData] = createSignal<GitStatusData | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  async function loadGitInfo(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const settings = getSettings();
      const response = await fetch(`${settings.serverUrl}/git/status`);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }
      const json: GitStatusData = await response.json();
      setData(json);
    } catch (err) {
      if (err instanceof Error && err.message.includes("not a git repository")) {
        setError("Not a git repository. Run the server from a git project directory.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to load git info");
      }
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
          class="text-xs bg-slate-700 text-slate-300 px-3 py-2 rounded-lg active:bg-slate-600 min-h-[44px] flex items-center"
          onClick={loadGitInfo}
        >
          Refresh
        </button>
      </div>

      <Show when={loading()}>
        <LoadingSkeleton />
      </Show>

      <Show when={error()}>
        <div class="px-4 py-3">
          <div class="text-sm text-red-400 bg-slate-800/50 rounded-lg px-3 py-2">{error()}</div>
        </div>
      </Show>

      <Show when={!loading() && !error() && data()}>
        <div class="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* Branch info */}
          <div class="bg-slate-800/50 rounded-lg p-3">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-lg">🌿</span>
              <span class="text-base font-medium text-slate-200">{data()!.branch}</span>
              <Show when={data()!.ahead > 0}>
                <span class="text-xs bg-blue-600/30 text-blue-300 px-1.5 py-0.5 rounded">
                  ↑{data()!.ahead}
                </span>
              </Show>
              <Show when={data()!.behind > 0}>
                <span class="text-xs bg-yellow-600/30 text-yellow-300 px-1.5 py-0.5 rounded">
                  ↓{data()!.behind}
                </span>
              </Show>
            </div>
            <div class="flex gap-4 text-xs text-slate-400">
              <span>
                <span class="text-yellow-400">{data()!.dirtyFiles}</span> modified
              </span>
              <span>
                <span class="text-green-400">{data()!.stagedFiles}</span> staged
              </span>
              <Show when={data()!.untrackedFiles > 0}>
                <span>
                  <span class="text-red-400">{data()!.untrackedFiles}</span> untracked
                </span>
              </Show>
            </div>
          </div>

          {/* File status */}
          <Show when={data()!.statusOutput}>
            <div>
              <span class="text-xs text-slate-500 block mb-2">Changed Files</span>
              <pre class="text-xs text-slate-300 font-mono bg-slate-800/50 rounded-lg p-2 overflow-x-auto whitespace-pre">
                {data()!.statusOutput || "(clean working tree)"}
              </pre>
            </div>
          </Show>

          {/* Recent commits */}
          <div>
            <span class="text-xs text-slate-500 block mb-2">Recent Commits</span>
            <div class="space-y-1">
              <For each={data()!.recentCommits}>
                {(commit) => (
                  <div class="flex items-start gap-2 px-2 py-1.5 hover:bg-slate-800/30 rounded text-sm">
                    <span class="text-xs text-blue-400 font-mono shrink-0 mt-0.5">
                      {shortenHash(commit.hash)}
                    </span>
                    <span class="flex-1 text-slate-300 truncate">{commit.message}</span>
                    <span class="text-xs text-slate-500 shrink-0">{formatDate(commit.date)}</span>
                  </div>
                )}
              </For>
            </div>
            <Show when={data()!.recentCommits.length === 0}>
              <div class="text-xs text-slate-500 px-2 py-3 text-center">No commits yet</div>
            </Show>
          </div>
        </div>
      </Show>

      <Show when={!loading() && !error() && !data()}>
        <div class="flex-1 flex items-center justify-center">
          <div class="text-sm text-slate-500">No git data available</div>
        </div>
      </Show>
    </div>
  );
}
