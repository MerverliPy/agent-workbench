import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const cacheEntries = sqliteTable(
  "cache_entries",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    projectPath: text("project_path").notNull(),
    cacheType: text("cache_type").notNull(),
    cacheKey: text("cache_key").notNull(),
    valueJson: text("value_json").notNull(),
    sourceHash: text("source_hash"),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at"),
    invalidatedAt: text("invalidated_at"),
    metadataJson: text("metadata_json"),
  },
  (table) => [
    index("cache_entries_session_id_idx").on(table.sessionId),
    index("cache_entries_cache_type_idx").on(table.cacheType),
    index("cache_entries_cache_key_idx").on(table.cacheKey),
    index("cache_entries_expires_at_idx").on(table.expiresAt),
  ],
);
