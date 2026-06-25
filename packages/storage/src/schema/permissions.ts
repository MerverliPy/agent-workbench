import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export const permissionRequests = sqliteTable(
  "permission_requests",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id"),
    runId: text("run_id"),
    toolCallId: text("tool_call_id"),
    agentId: text("agent_id"),
    toolName: text("tool_name").notNull(),
    riskLevel: text("risk_level").notNull(),
    reason: text("reason"),
    targetPathsJson: text("target_paths_json"),
    command: text("command"),
    diffSummaryJson: text("diff_summary_json"),
    dryRunSummaryJson: text("dry_run_summary_json"),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at"),
    metadataJson: text("metadata_json"),
  },
  (table) => [
    index("permission_requests_session_id_idx").on(table.sessionId),
    index("permission_requests_run_id_idx").on(table.runId),
    index("permission_requests_tool_call_id_idx").on(table.toolCallId),
    index("permission_requests_status_idx").on(table.status),
  ]
);

export const permissionDecisions = sqliteTable(
  "permission_decisions",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id").notNull(),
    decision: text("decision").notNull(),
    decidedBy: text("decided_by"),
    scope: text("scope"),
    reason: text("reason"),
    createdAt: text("created_at").notNull(),
    metadataJson: text("metadata_json"),
  },
  (table) => [index("permission_decisions_request_id_idx").on(table.requestId)]
);
