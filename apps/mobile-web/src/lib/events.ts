import type { EventEnvelope } from "@agent-workbench/protocol";

// Event handler type — mirrors patterns from apps/tui/src/App.tsx
export type EventRouter = (event: EventEnvelope) => void;

// Category mapping for Activity Log
export type EventCategory =
  | "tool"
  | "permission"
  | "file"
  | "shell"
  | "error"
  | "agent"
  | "stream"
  | "session"
  | "plan"
  | "other";

const CATEGORY_MAP: Record<string, EventCategory> = {
  "message.created": "stream",
  "message.delta": "stream",
  "permission.requested": "permission",
  "permission.decided": "permission",
  "model.stream_delta": "stream",
  "model.stream_complete": "stream",
  "model.stream_error": "error",
  "file.change_applied": "file",
  "file.change_failed": "error",
  "file.revert_attempted": "file",
  "file.revert_completed": "file",
  "file.revert_failed": "error",
  "shell.command_requested": "shell",
  "shell.command_started": "shell",
  "shell.output_chunk": "shell",
  "shell.command_completed": "shell",
  "shell.command_failed": "error",
  "shell.command_aborted": "shell",
  "agent.selected": "agent",
  "diff.preview_created": "file",
  "plan.proposed": "plan",
  "plan.approved": "plan",
  "plan.denied": "plan",
  "plan.completed": "plan",
  "plan.failed": "error",
  "token_health.updated": "other",
  "token_health.warning": "other",
  "compaction.suggested": "other",
  "compaction.started": "other",
  "compaction.completed": "other",
  "compaction.rejected": "other",
  "tool_result.truncated": "tool",
  "session.created": "session",
  "session.deleted": "session",
};

export function categorizeEvent(type: string): EventCategory {
  return CATEGORY_MAP[type] ?? "other";
}

export function getCategoryIcon(cat: EventCategory): string {
  const icons: Record<EventCategory, string> = {
    tool: "🔧",
    permission: "🛡️",
    file: "📝",
    shell: "🐚",
    error: "⚠️",
    agent: "🤖",
    stream: "💬",
    session: "📋",
    plan: "📋",
    other: "📌",
  };
  return icons[cat];
}
