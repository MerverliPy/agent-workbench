import type { JSX } from "solid-js";
import { createSignal, onMount, For, Show } from "solid-js";
import { getClient } from "../../lib/sdk";
import { ApiError } from "@agent-workbench/sdk";
import { LoadingSkeleton } from "../LoadingSkeleton";

interface FileEntry {
  name: string;
  isDir: boolean;
  size: number;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function parentPath(path: string): string {
  if (path === "/") return "/";
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return "/" + parts.join("/");
}

function joinPath(base: string, name: string): string {
  if (base === "/") return `/${name}`;
  return `${base}/${name}`;
}

/** Provide user-friendly error messages, especially for placeholder (501) routes. */
function formatFileError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 501) {
      return "File browsing is not yet available (server route not implemented).";
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return "Failed to access filesystem";
}

export function FileBrowserPanel(): JSX.Element {
  const [currentPath, setCurrentPath] = createSignal<string>("/");
  const [entries, setEntries] = createSignal<FileEntry[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [previewFile, setPreviewFile] = createSignal<string | null>(null);
  const [previewContent, setPreviewContent] = createSignal<string>("");
  const [error, setError] = createSignal<string | null>(null);

  async function loadDirectory(path: string): Promise<void> {
    setLoading(true);
    setError(null);
    setPreviewFile(null);

    try {
      const client = getClient();
      const result = await client.files.list({ path });
      const fileEntries: FileEntry[] = (result.items ?? []).map((item) => ({
        name: item.path.split("/").pop() ?? item.path,
        isDir: item.type === "directory",
        size: item.size ?? 0,
      }));

      fileEntries.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      setEntries(fileEntries);
    } catch (err) {
      setError(formatFileError(err));
    } finally {
      setLoading(false);
    }
  }

  async function openFile(filePath: string): Promise<void> {
    try {
      const client = getClient();
      const result = await client.files.read({ path: filePath, limit: 200 });
      setPreviewFile(filePath);
      setPreviewContent(typeof result === "string" ? result : JSON.stringify(result));
    } catch (err) {
      setError(formatFileError(err));
    }
  }

  function navigateUp(): void {
    const parent = parentPath(currentPath());
    setCurrentPath(parent);
    loadDirectory(parent);
  }

  function navigateTo(name: string): void {
    const newPath = joinPath(currentPath(), name);
    setCurrentPath(newPath);
    loadDirectory(newPath);
  }

  onMount(() => {
    loadDirectory(currentPath());
  });

  return (
    <div class="flex flex-col h-full panel-enter">
      <div class="flex items-center gap-2 px-3 py-2 border-b border-slate-700 bg-slate-800/50">
        <button
          class="w-11 h-11 flex items-center justify-center rounded-lg active:bg-slate-700 text-slate-400"
          onClick={navigateUp}
          aria-label="Go up"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span class="text-sm font-mono text-slate-300 truncate">
          📁 {currentPath()}
        </span>
      </div>

      <Show when={loading()}>
        <LoadingSkeleton />
      </Show>

      <Show when={error()}>
        <div class="px-4 py-3 text-sm text-red-400">{error()}</div>
      </Show>

      <Show when={!loading() && !error()}>
        <div class="flex-1 overflow-y-auto">
          <For each={entries()}>
            {(entry) => (
              <button
                class="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/50 active:bg-slate-700/50 border-b border-slate-800 transition-colors min-h-[44px]"
                onClick={() => entry.isDir ? navigateTo(entry.name) : openFile(joinPath(currentPath(), entry.name))}
              >
                <span class="text-base">{entry.isDir ? "📁" : "📄"}</span>
                <span class="flex-1 text-sm text-left text-slate-200 truncate">{entry.name}</span>
                {!entry.isDir && entry.size > 0 && <span class="text-xs text-slate-500">{formatSize(entry.size)}</span>}
              </button>
            )}
          </For>
          {entries().length === 0 && (
            <div class="px-4 py-8 text-center text-sm text-slate-500">Empty directory</div>
          )}
        </div>
      </Show>

      <Show when={previewFile()}>
        <div class="border-t border-slate-700 bg-slate-900">
          <div class="flex items-center justify-between px-3 py-1.5 bg-slate-800">
            <span class="text-xs font-mono text-slate-400 truncate">{previewFile()}</span>
            <button
              class="text-xs text-slate-500 active:text-slate-300"
              onClick={() => { setPreviewFile(null); setPreviewContent(""); }}
            >
              Close
            </button>
          </div>
          <pre class="max-h-48 overflow-y-auto px-3 py-2 text-xs text-slate-300 font-mono whitespace-pre-wrap">
            {previewContent()}
          </pre>
        </div>
      </Show>
    </div>
  );
}
