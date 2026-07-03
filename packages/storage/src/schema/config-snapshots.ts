import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const configSnapshots = sqliteTable(
  "config_snapshots",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    runId: text("run_id"),
    configHash: text("config_hash").notNull(),
    effectiveConfigJson: text("effective_config_json").notNull(),
    redactedConfigJson: text("redacted_config_json"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("config_snapshots_session_id_idx").on(table.sessionId),
    index("config_snapshots_run_id_idx").on(table.runId),
  ],
);
