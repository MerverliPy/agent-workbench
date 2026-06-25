import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export const runLedger = sqliteTable(
  "run_ledger",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    runId: text("run_id"),
    eventType: text("event_type").notNull(),
    eventCategory: text("event_category").notNull(),
    actor: text("actor").notNull(),
    summary: text("summary").notNull(),
    payloadJson: text("payload_json"),
    redactionStatus: text("redaction_status").notNull().default("none"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("run_ledger_session_id_idx").on(table.sessionId),
    index("run_ledger_run_id_idx").on(table.runId),
    index("run_ledger_event_category_idx").on(table.eventCategory),
    index("run_ledger_event_type_idx").on(table.eventType),
    index("run_ledger_created_at_idx").on(table.createdAt),
  ]
);
