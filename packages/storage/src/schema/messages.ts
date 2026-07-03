import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    runId: text("run_id"),
    role: text("role").notNull(),
    content: text("content").notNull(),
    contentFormat: text("content_format").notNull().default("text"),
    parentMessageId: text("parent_message_id"),
    createdAt: text("created_at").notNull(),
    metadataJson: text("metadata_json"),
    tokenCount: integer("token_count"),
  },
  (table) => [
    index("messages_session_id_idx").on(table.sessionId),
    index("messages_run_id_idx").on(table.runId),
    index("messages_role_idx").on(table.role),
  ],
);
