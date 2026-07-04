import { index, sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * Append-only audit log with cryptographic hash chaining.
 * Each entry includes the SHA-256 hash of the previous entry,
 * forming an immutable chain that can be integrity-verified.
 */
export const auditEntries = sqliteTable(
  "audit_entries",
  {
    id: text("id").primaryKey(),
    sequence: integer("sequence").notNull(), // Monotonically increasing sequence number
    action: text("action").notNull(), // e.g. "session.create", "session.delete", "config.change"
    actor: text("actor").notNull(), // Who performed the action (user ID, "system", "plugin:X")
    resource: text("resource").notNull(), // What was acted upon (session ID, config path, etc.)
    detail: text("detail"), // Human-readable description or structured JSON
    previousHash: text("previous_hash").notNull(), // SHA-256 of the previous entry (all-zeros for genesis)
    hash: text("hash").notNull(), // SHA-256 of this entry's contents
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("audit_entries_action_idx").on(table.action),
    index("audit_entries_actor_idx").on(table.actor),
    index("audit_entries_resource_idx").on(table.resource),
    index("audit_entries_sequence_idx").on(table.sequence),
    index("audit_entries_created_at_idx").on(table.createdAt),
  ],
);
