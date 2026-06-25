import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export const toolCalls = sqliteTable(
  "tool_calls",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    runId: text("run_id"),
    messageId: text("message_id"),
    toolName: text("tool_name").notNull(),
    status: text("status").notNull(),
    inputJson: text("input_json").notNull(),
    resultJson: text("result_json"),
    errorJson: text("error_json"),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    metadataJson: text("metadata_json"),
  },
  (table) => [
    index("tool_calls_session_id_idx").on(table.sessionId),
    index("tool_calls_run_id_idx").on(table.runId),
    index("tool_calls_message_id_idx").on(table.messageId),
    index("tool_calls_status_idx").on(table.status),
  ]
);
