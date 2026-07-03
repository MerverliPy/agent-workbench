import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const workspaces = sqliteTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    rootPath: text("root_path").notNull(),
    description: text("description"),
    archived: integer("archived", { mode: "boolean" }).default(false),
    tagsJson: text("tags_json"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("workspaces_archived_idx").on(table.archived),
    index("workspaces_name_idx").on(table.name),
  ],
);
