import { createSignal } from "solid-js";

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

/** Count of unresolved permission requests received via SSE. */
export const [pendingPermissions, setPendingPermissions] = createSignal(0);

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
