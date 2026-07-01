import { createSignal } from "solid-js";
import type { PermissionRequest, AgentListItem } from "@agent-workbench/protocol";

// ── Connection state ──────────────────────────────────────────────────────

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export const [connectionStatus, setConnectionStatus] = createSignal<ConnectionStatus>("disconnected");
export const [connectionError, setConnectionError] = createSignal<string | null>(null);

// ── Message state ──────────────────────────────────────────────────────────

export interface DisplayMessage {
  readonly id: string;
  readonly role: "user" | "assistant" | "system";
  readonly content: string;
  readonly createdAt: string;
}

export const [messages, setMessages] = createSignal<DisplayMessage[]>([]);

export function appendMessage(msg: DisplayMessage): void {
  setMessages((prev) => [...prev, msg]);
}

export function appendSystemNotice(text: string): void {
  appendMessage({
    id: `system-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role: "system",
    content: text,
    createdAt: new Date().toISOString(),
  });
}

// ── Streaming state ────────────────────────────────────────────────────────

export const [streamingContent, setStreamingContent] = createSignal<string>("");
export const [streamingMessageId, setStreamingMessageId] = createSignal<string | null>(null);
export const [isStreaming, setIsStreaming] = createSignal<boolean>(false);

export function beginStreaming(id: string): void {
  setStreamingMessageId(id);
  setStreamingContent("");
  setIsStreaming(true);
}

export function appendStreamingDelta(delta: string): void {
  setStreamingContent((prev) => prev + delta);
}

export function finalizeStreaming(): void {
  const content = streamingContent();
  const id = streamingMessageId();
  if (content && id) {
    appendMessage({
      id,
      role: "assistant",
      content,
      createdAt: new Date().toISOString(),
    });
  }
  setStreamingContent("");
  setStreamingMessageId(null);
  setIsStreaming(false);
}

export function cancelStreaming(): void {
  setStreamingContent("");
  setStreamingMessageId(null);
  setIsStreaming(false);
}

// ── Permission state ───────────────────────────────────────────────────────

export const [pendingPermissionRequest, setPendingPermissionRequest] = createSignal<PermissionRequest | null>(null);
export const [permissionModalOpen, setPermissionModalOpen] = createSignal(false);

// ── Agent state ────────────────────────────────────────────────────────────

export const [currentAgentId, setCurrentAgentId] = createSignal<string>("build");
export const [availableAgents, setAvailableAgents] = createSignal<AgentListItem[]>([]);

// ── Panel state ────────────────────────────────────────────────────────────

export type PanelId = "chat" | "files" | "git" | "sessions" | "activity" | "settings" | "help";

export const [activePanel, setActivePanel] = createSignal<PanelId>("chat");

// ── Drawer state ───────────────────────────────────────────────────────────

export const [drawerOpen, setDrawerOpen] = createSignal(false);

export function toggleDrawer(): void {
  setDrawerOpen((open) => !open);
}

export function selectPanel(panel: PanelId): void {
  setActivePanel(panel);
  setDrawerOpen(false);
}

// ── Activity log ───────────────────────────────────────────────────────────

export interface ActivityEntry {
  readonly id: string;
  readonly timestamp: string;
  readonly category: string;
  readonly icon: string;
  readonly summary: string;
}

export const [activityEntries, setActivityEntries] = createSignal<ActivityEntry[]>([]);

export function appendActivity(entry: ActivityEntry): void {
  setActivityEntries((prev) => {
    const next = [entry, ...prev];
    return next.slice(0, 50); // keep last 50
  });
}

// ── File browser state ─────────────────────────────────────────────────────

export const [browserPath, setBrowserPath] = createSignal<string>("/");
export const [browserEntries, setBrowserEntries] = createSignal<Array<{ name: string; isDir: boolean; size: number }>>([]);

// ── Git state ──────────────────────────────────────────────────────────────

export const [gitBranch, setGitBranch] = createSignal<string>("");
export const [gitStatus, setGitStatus] = createSignal<string>("");
export const [gitCommits, setGitCommits] = createSignal<string>("");

// ── Session list ───────────────────────────────────────────────────────────

export const [sessionList, setSessionList] = createSignal<Array<{ id: string; name: string; messageCount: number; active: boolean }>>([]);
