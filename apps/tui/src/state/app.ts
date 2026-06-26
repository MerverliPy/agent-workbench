import { createSignal } from "solid-js";
import type { PermissionRequest, DiffPreview, AgentListItem } from "@agent-workbench/protocol";
import type { Plan } from "@agent-workbench/protocol";

/**
 * Placeholder session ID used while server session APIs return 501.
 * Phase 4: a single display-only session allows prompt submission to be exercised.
 * Phase 5+: replaced by real server-managed sessions.
 */
export const PLACEHOLDER_SESSION_ID = "placeholder-session-phase4";

/** Display session used in the sidebar while server session APIs are 501. */
export interface PlaceholderSession {
  readonly id: string;
  readonly title: string;
  readonly status: "active";
}

export const PLACEHOLDER_SESSION: PlaceholderSession = {
  id: PLACEHOLDER_SESSION_ID,
  title: "Phase 4 Session",
  status: "active",
};

export type ServerStatus = "connecting" | "connected" | "disconnected" | "error";

export type RunStatus = "idle" | "submitting" | "error";

/** A message displayed in the message timeline. */
export interface DisplayMessage {
  readonly id: string;
  readonly role: "user" | "assistant" | "system";
  readonly content: string;
  readonly createdAt: string;
}

// ── Server connection state ────────────────────────────────────────────────

export const [serverStatus, setServerStatus] = createSignal<ServerStatus>("connecting");

/** Last server error message, or null when clear. */
export const [serverError, setServerError] = createSignal<string | null>(null);

// ── Run / session state ───────────────────────────────────────────────────

export const [runStatus, setRunStatus] = createSignal<RunStatus>("idle");

/**
 * Phase 8: pending permission requests received via SSE.
 * The modal displays the first item in this list.
 * TUI renders data from this signal; it never computes allow/ask/deny.
 */
export const [pendingPermissionRequests, setPendingPermissionRequests] =
  createSignal<PermissionRequest[]>([]);

/** Derived count for backward compatibility with any existing readers. */
export function pendingPermissions(): number {
  return pendingPermissionRequests().length;
}

/**
 * Add a permission request received from SSE to the pending queue.
 * Called by App.tsx when a permission.requested event arrives.
 */
export function addPendingPermissionRequest(req: PermissionRequest): void {
  setPendingPermissionRequests((prev) => {
    // Avoid duplicates (re-delivery guard).
    if (prev.some((r) => r.id === req.id)) return prev;
    return [...prev, req];
  });
}

/**
 * Remove a permission request from the queue after it is decided.
 * Called by App.tsx when a permission.decided event arrives.
 */
export function removePendingPermissionRequest(requestId: string): void {
  setPendingPermissionRequests((prev) => prev.filter((r) => r.id !== requestId));
}

// ── Message timeline ──────────────────────────────────────────────────────

export const [messages, setMessages] = createSignal<DisplayMessage[]>([]);

/** Append a display message to the timeline. */
export function appendMessage(msg: DisplayMessage): void {
  setMessages((prev) => [...prev, msg]);
}

/** Append a system notice to the timeline (used for 501 feedback etc.). */
export function appendSystemNotice(content: string): void {
  appendMessage({
    id: `notice-${Date.now()}`,
    role: "system",
    content,
    createdAt: new Date().toISOString(),
  });
}

// ── Panel / overlay visibility ────────────────────────────────────────────

export const [commandPaletteOpen, setCommandPaletteOpen] = createSignal(false);

export const [permissionModalOpen, setPermissionModalOpen] = createSignal(false);

export const [ledgerPanelOpen, setLedgerPanelOpen] = createSignal(false);

export const [diffViewerOpen, setDiffViewerOpen] = createSignal(false);

export const [tokenHealthOpen, setTokenHealthOpen] = createSignal(false);

// ── Phase 9: Diff preview / mutation status ───────────────────────────────

/**
 * The most recent diff preview received via SSE diff.preview_created event.
 * Cleared after a mutation applies (file.change_applied) or fails.
 * TUI renders this — it does not generate it.
 */
export const [currentDiffPreview, setCurrentDiffPreview] =
  createSignal<DiffPreview | null>(null);

/**
 * High-level mutation status string for the status bar.
 * Set by App.tsx SSE routing; cleared on next idle state.
 */
export const [mutationStatus, setMutationStatus] = createSignal<
  "idle" | "proposed" | "applied" | "failed" | "reverting" | "reverted"
>("idle");

// ── Phase 10: Shell execution state ──────────────────────────────────────

export type ShellStatus = "idle" | "running" | "completed" | "failed" | "aborted";

export const [shellStatus, setShellStatus] = createSignal<ShellStatus>("idle");

export interface ShellOutputChunk {
  stream: "stdout" | "stderr";
  chunk: string;
}

export const [shellOutputChunks, setShellOutputChunks] = createSignal<ShellOutputChunk[]>([]);

export function appendShellOutputChunk(chunk: ShellOutputChunk): void {
  setShellOutputChunks((prev) => [...prev, chunk]);
}

export function clearShellOutput(): void {
  setShellOutputChunks([]);
  setShellStatus("idle");
}

// ── Phase 11: Agent mode state ─────────────────────────────────────────

export const [currentAgentId, setCurrentAgentId] = createSignal<string | null>(null);

export interface AgentInfo {
  id: string;
  name: string;
  mode: string;
}

export const [availableAgents, setAvailableAgents] = createSignal<AgentInfo[]>([]);

export function selectAgent(agentId: string): void {
  setCurrentAgentId(agentId);
}

// ── Phase 12: Token health state ─────────────────────────────────────────

export interface TokenHealthState {
  budget: number;
  used: number;
  remaining: number;
  utilizationPercent: number;
  level: string;
  isEstimate: boolean;
  compactionSuggested: boolean;
}

export const [tokenHealth, setTokenHealth] = createSignal<TokenHealthState | null>(null);

export const [compactionSuggestion, setCompactionSuggestion] = createSignal<{
  currentTokens: number;
  estimatedCompactedTokens?: number | undefined;
  reason?: string | undefined;
} | null>(null);

// ── Phase 13: Planner state ──────────────────────────────────────────────

export interface PlanState {
  planId: string;
  status: string;
  summary: string;
  riskLevel: string;
  steps: Array<{ order: number; type: string; description: string; targetPath?: string }>;
  targetFiles: string[];
}

export const [currentPlan, setCurrentPlan] = createSignal<PlanState | null>(null);
