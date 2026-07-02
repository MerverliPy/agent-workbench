import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    projectPath: text("project_path").notNull(),
    title: text("title"),
    activeAgent: text("active_agent"),
    status: text("status").notNull().default("active"),
    workspaceId: text("workspace_id"),
    tagsJson: text("tags_json"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    lastRunAt: text("last_run_at"),
    metadataJson: text("metadata_json"),
  },
  (table) => [
    index("sessions_status_idx").on(table.status),
    index("sessions_workspace_idx").on(table.workspaceId),
  ],
);
