import type {
  AgentListItem,
  PermissionRequest,
} from "@agent-workbench/protocol";
import { createSignal } from "solid-js";

// ── Connection state ──────────────────────────────────────────────────────

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export const [connectionStatus, setConnectionStatus] =
  createSignal<ConnectionStatus>("disconnected");
export const [connectionError, setConnectionError] = createSignal<
  string | null
>(null);

// ── Message state ──────────────────────────────────────────────────────────

export type CardStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "aborted"
  | "approved"
  | "denied"
  | "expired";

export interface PlanCardData {
  planId: string;
  steps: Array<{
    number: number;
    description: string;
    status: CardStatus;
  }>;
  status: CardStatus;
}

export interface ToolActivityCardData {
  toolCallId: string;
  toolName: string;
  status: CardStatus;
  result?: string;
  error?: string;
}

export interface DiffCardData {
  files: Array<{
    path: string;
    type: "modified" | "added" | "removed";
    diff?: string;
  }>;
  status: CardStatus;
  error?: string;
}

export interface TerminalCardData {
  sessionId: string;
  command: string;
  riskLevel?: string;
  output: string;
  exitCode?: number;
  status: CardStatus;
  error?: string;
}

export interface ApprovalCardData {
  requestId: string;
  toolName: string;
  targetPaths?: string[];
  riskLevel: "low" | "medium" | "high";
  status: CardStatus;
  sequenceNumber: number;
  totalCount: number;
}

export interface SummaryCardData {
  content: string;
  items?: string[];
}

export type CardDataType =
  | PlanCardData
  | ToolActivityCardData
  | DiffCardData
  | TerminalCardData
  | ApprovalCardData
  | SummaryCardData;

export type CardType =
  | "plan"
  | "tool"
  | "diff"
  | "terminal"
  | "approval"
  | "summary";

export type CorrelationType =
  | "toolCallId"
  | "requestId"
  | "sessionId"
  | "planId"
  | null;

export interface DisplayMessage {
  readonly id: string;
  readonly role: "user" | "assistant" | "system";
  readonly content: string;
  readonly createdAt: string;
  readonly cardType?: CardType;
  readonly cardId?: string;
  readonly correlationType?: CorrelationType;
  readonly cardData?: CardDataType;
}

export const [messages, setMessages] = createSignal<DisplayMessage[]>([]);

export function appendMessage(msg: DisplayMessage): void {
  setMessages((prev) => {
    if (prev.some((m) => m.id === msg.id)) return prev;
    return [...prev, msg];
  });
}

export function appendCard(
  cardType: CardType,
  cardId: string,
  correlationType: CorrelationType,
  cardData: CardDataType,
): void {
  appendMessage({
    id: `card-${cardType}-${cardId}-${Date.now()}`,
    role: "assistant" as const,
    content: "",
    createdAt: new Date().toISOString(),
    cardType,
    cardId,
    correlationType,
    cardData,
  });
}

/** Update a card's cardData in-place by matching cardId. */
export function updateCardData(
  cardId: string,
  updater: (data: CardDataType) => void,
): void {
  setMessages((prev) => {
    const m = prev.find((x) => x.cardId === cardId);
    if (!m?.cardData) return prev;
    const clone = JSON.parse(JSON.stringify(m.cardData)) as CardDataType;
    updater(clone);
    return prev.map((x) =>
      x.cardId === cardId
        ? ({ ...x, content: "", cardData: clone } as DisplayMessage)
        : x,
    );
  });
}

export function appendSystemNotice(text: string): void {
  appendMessage({
    id: `system-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role: "system" as const,
    content: text,
    createdAt: new Date().toISOString(),
  });
}

// ── Streaming state ────────────────────────────────────────────────────────

export const [streamingContent, setStreamingContent] = createSignal<string>("");
export const [streamingMessageId, setStreamingMessageId] = createSignal<
  string | null
>(null);
export const [isStreaming, setIsStreaming] = createSignal<boolean>(false);

// Thinking indicator (run.started / run.completed toggle)
export const [thinkingIndicator, setThinkingIndicator] =
  createSignal<boolean>(false);

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
      role: "assistant" as const,
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

export const [pendingPermissionRequest, setPendingPermissionRequest] =
  createSignal<PermissionRequest | null>(null);
export const [permissionModalOpen, setPermissionModalOpen] =
  createSignal(false);

// Pending approval count (for topbar badge)
export const [pendingApprovalCount, setPendingApprovalCount] = createSignal(0);
export const [fallbackMode, setFallbackMode] = createSignal(false);

// Increment/decrement helpers for stacking
export function incrementPendingApprovals(): void {
  setPendingApprovalCount((c) => c + 1);
}
export function decrementPendingApprovals(): void {
  setPendingApprovalCount((c) => Math.max(0, c - 1));
}

// ── Agent state ────────────────────────────────────────────────────────────

export const [currentAgentId, setCurrentAgentId] =
  createSignal<string>("build");
export const [availableAgents, setAvailableAgents] = createSignal<
  AgentListItem[]
>([]);

// ── Panel state ────────────────────────────────────────────────────────────

export type PanelId =
  | "chat"
  | "workspaces"
  | "files"
  | "activity"
  | "settings"
  | "help";

export type WorkspaceSubTab = "files" | "git" | "sessions";

export const [activePanel, setActivePanel] = createSignal<PanelId>("chat");
export const [workspaceSubTab, setWorkspaceSubTab] =
  createSignal<WorkspaceSubTab>("files");

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

export const [activityEntries, setActivityEntries] = createSignal<
  ActivityEntry[]
>([]);

export function appendActivity(entry: ActivityEntry): void {
  setActivityEntries((prev) => {
    const next = [entry, ...prev];
    return next.slice(0, 50);
  });
}

// ── File browser state ─────────────────────────────────────────────────────

export const [browserPath, setBrowserPath] = createSignal<string>("/");
export const [browserEntries, setBrowserEntries] = createSignal<
  Array<{ name: string; isDir: boolean; size: number }>
>([]);

// ── Git state ──────────────────────────────────────────────────────────────

export const [gitBranch, setGitBranch] = createSignal<string>("");
export const [gitStatus, setGitStatus] = createSignal<string>("");
export const [gitCommits, setGitCommits] = createSignal<string>("");

// ── Input text (shared so ChatView suggestions can set it) ─────────────────

export const [inputText, setInputText] = createSignal<string>("");

// ── Session list ───────────────────────────────────────────────────────────

export const [sessionList, setSessionList] = createSignal<
  Array<{ id: string; name: string; messageCount: number; active: boolean }>
>([]);
export const [selectedSessionId, setSelectedSessionId] = createSignal<
  string | null
>(null);
