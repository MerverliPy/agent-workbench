import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export const fileChanges = sqliteTable(
  "file_changes",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    runId: text("run_id"),
    toolCallId: text("tool_call_id"),
    path: text("path").notNull(),
    changeType: text("change_type").notNull(),
    beforeHash: text("before_hash"),
    afterHash: text("after_hash"),
    patch: text("patch"),
    dryRunId: text("dry_run_id"),
    approvedByPermissionDecisionId: text("approved_by_permission_decision_id"),
    createdAt: text("created_at").notNull(),
    metadataJson: text("metadata_json"),
  },
  (table) => [
    index("file_changes_session_id_idx").on(table.sessionId),
    index("file_changes_run_id_idx").on(table.runId),
    index("file_changes_path_idx").on(table.path),
    index("file_changes_change_type_idx").on(table.changeType),
  ]
);
