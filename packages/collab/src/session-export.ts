/**
 * Session export/import — dump a session to JSON and replay it.
 *
 * Export format is a portable JSON document containing:
 *   - Session metadata (id, projectPath, title, tags, timestamps)
 *   - All messages in order
 *   - Tool call records
 *   - Permission decisions (anonymized)
 *   - Ledger entries (run records, summaries)
 *
 * This is designed to be interchangeable between agent-workbench instances,
 * usable in bug reports, and parseable by external tools.
 */

import type {
  LedgerRepository,
  MessageRepository,
  PermissionRepository,
  SessionRepository,
  SummaryRepository,
  ToolCallRepository,
} from "@agent-workbench/storage";

// ── Export schema (pure types for portability) ─────────────────────────────

export interface ExportedMessage {
  readonly role: string;
  readonly content: string;
  readonly createdAt: string;
  readonly tokenCount: number | undefined;
}

export interface ExportedToolCall {
  readonly toolName: string;
  readonly input: Record<string, unknown>;
  readonly output: string | undefined;
  readonly error: string | undefined;
  readonly success: boolean;
  readonly durationMs: number | undefined;
  readonly createdAt: string;
}

export interface ExportedPermission {
  readonly action: string;
  readonly toolName: string;
  readonly riskLevel: string;
  readonly decision: string;
  readonly createdAt: string;
}

export interface ExportedLedgerEntry {
  readonly eventType: string;
  readonly eventCategory: string;
  readonly summary: string;
  readonly actor: string;
  readonly createdAt: string;
}

export interface SessionExport {
  readonly formatVersion: 1;
  readonly exportedAt: string;
  readonly exportedBy: string;
  readonly session: {
    readonly id: string;
    readonly projectPath: string;
    readonly title: string | undefined;
    readonly status: string;
    readonly tags: readonly string[] | undefined;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly workspaceId: string | undefined;
  };
  readonly messages: readonly ExportedMessage[];
  readonly toolCalls: readonly ExportedToolCall[];
  readonly permissions: readonly ExportedPermission[];
  readonly ledger: readonly ExportedLedgerEntry[];
}

// ── Exporter ────────────────────────────────────────────────────────────────

export interface ExportOptions {
  readonly includeToolOutputs?: boolean;
  readonly maxToolOutputLength?: number;
  readonly includePermissions?: boolean;
}

export interface Repositories {
  sessionRepository: SessionRepository;
  messageRepository: MessageRepository;
  toolCallRepository: ToolCallRepository;
  permissionRepository: PermissionRepository;
  ledgerRepository: LedgerRepository;
  summaryRepository: SummaryRepository;
}

/**
 * Export a full session to a portable JSON document.
 */
export async function exportSession(
  sessionId: string,
  repos: Repositories,
  options?: ExportOptions,
): Promise<SessionExport> {
  const includeToolOutputs = options?.includeToolOutputs ?? true;
  const maxLen = options?.maxToolOutputLength ?? 5000;
  const includePermissions = options?.includePermissions ?? true;

  // Fetch session
  const session = repos.sessionRepository.findById(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }
  const tags: string[] | undefined = session.tagsJson
    ? (JSON.parse(session.tagsJson) as string[])
    : undefined;

  // Fetch messages
  const rawMessages = repos.messageRepository.listBySession(sessionId);
  const messages: ExportedMessage[] = rawMessages
    .filter((m) => m.role !== "summary")
    .map((m) => ({
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
      tokenCount: m.tokenCount ?? undefined,
    }));

  // Fetch tool calls
  const rawToolCalls = repos.toolCallRepository.listBySession(sessionId);
  const toolCalls: ExportedToolCall[] = rawToolCalls.map((tc) => {
    const started = tc.startedAt ? new Date(tc.startedAt).getTime() : null;
    const completed = tc.completedAt
      ? new Date(tc.completedAt).getTime()
      : null;
    const durationMs = started && completed ? completed - started : undefined;
    const success = tc.status === "completed" || tc.status === "success";

    return {
      toolName: tc.toolName,
      input: JSON.parse(tc.inputJson) as Record<string, unknown>,
      output:
        includeToolOutputs && tc.resultJson
          ? truncate(tc.resultJson, maxLen)
          : undefined,
      error: tc.errorJson ?? undefined,
      success,
      durationMs,
      createdAt: tc.startedAt ?? tc.completedAt ?? session.createdAt,
    };
  });

  // Fetch permission requests
  let permissions: ExportedPermission[] = [];
  if (includePermissions) {
    const rawPerms =
      repos.permissionRepository.listRequestsBySession(sessionId);
    permissions = rawPerms.map((p) => ({
      action: p.toolName,
      toolName: p.toolName,
      riskLevel: p.riskLevel,
      decision:
        p.status === "approved"
          ? "allow"
          : p.status === "denied"
            ? "deny"
            : p.status,
      createdAt: p.createdAt,
    }));
  }

  // Fetch ledger entries
  const rawLedger = repos.ledgerRepository.listBySession(sessionId);
  const ledger: ExportedLedgerEntry[] = rawLedger.map((l) => ({
    eventType: l.eventType,
    eventCategory: l.eventCategory,
    summary: l.summary.slice(0, 200),
    actor: l.actor,
    createdAt: l.createdAt,
  }));

  return {
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    exportedBy: "agent-workbench",

    session: {
      id: session.id,
      projectPath: session.projectPath,
      title: session.title ?? undefined,
      status: session.status,
      tags: tags?.length ? tags : undefined,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      workspaceId: session.workspaceId ?? undefined,
    },

    messages,
    toolCalls,
    permissions,
    ledger,
  };
}

/**
 * Import a previously exported session into the database.
 * Creates a new session with a fresh ID and replays the messages.
 */
export async function importSession(
  exportData: SessionExport,
  repos: Repositories,
): Promise<string> {
  const { ulid } = await import("ulid");
  const newId = ulid();
  const now = new Date().toISOString();

  // Create the session record
  repos.sessionRepository.create({
    id: newId,
    projectPath: exportData.session.projectPath,
    title: exportData.session.title ?? exportData.session.id,
    activeAgent: "build",
    status: "active",
    workspaceId: exportData.session.workspaceId ?? null,
    tagsJson: exportData.session.tags
      ? JSON.stringify(exportData.session.tags)
      : null,
    createdAt: now,
    updatedAt: now,
    lastRunAt: null,
    metadataJson: JSON.stringify({
      importedFrom: exportData.session.id,
      importedAt: now,
    }),
  });

  // Replay messages
  for (const msg of exportData.messages) {
    repos.messageRepository.create({
      id: ulid(),
      sessionId: newId,
      runId: null,
      role: msg.role,
      content: msg.content,
      contentFormat: "text",
      parentMessageId: null,
      createdAt: msg.createdAt,
      metadataJson: null,
      tokenCount: msg.tokenCount ?? null,
    });
  }

  return newId;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function truncate(
  text: string | null | undefined,
  maxLen: number,
): string | undefined {
  if (!text) return undefined;
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}\n... [truncated, ${text.length - maxLen} more chars]`;
}
