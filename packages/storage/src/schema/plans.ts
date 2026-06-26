import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export const plans = sqliteTable(
  "plans",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    runId: text("run_id"),
    status: text("status").notNull().default("draft"),
    summary: text("summary").notNull(),
    riskLevel: text("risk_level").notNull().default("high"),
    stepsJson: text("steps_json").notNull(),
    targetFilesJson: text("target_files_json").notNull(),
    permissionRequestId: text("permission_request_id"),
    approvalPolicy: text("approval_policy"),
    createdAt: text("created_at").notNull(),
    approvedAt: text("approved_at"),
    completedAt: text("completed_at"),
  },
  (table) => [
    index("plans_session_id_idx").on(table.sessionId),
    index("plans_run_id_idx").on(table.runId),
    index("plans_status_idx").on(table.status),
    index("plans_created_at_idx").on(table.createdAt),
  ]
);
