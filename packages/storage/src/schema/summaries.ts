import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export const summaries = sqliteTable(
  "summaries",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    runId: text("run_id"),
    summaryType: text("summary_type").notNull(),
    sourceRangeJson: text("source_range_json"),
    content: text("content").notNull(),
    qualityStatus: text("quality_status").notNull().default("unchecked"),
    createdAt: text("created_at").notNull(),
    metadataJson: text("metadata_json"),
  },
  (table) => [
    index("summaries_session_id_idx").on(table.sessionId),
    index("summaries_run_id_idx").on(table.runId),
    index("summaries_summary_type_idx").on(table.summaryType),
  ]
);
