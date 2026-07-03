import { resolve } from "node:path";
import { migrate as drizzleMigrate } from "drizzle-orm/bun-sqlite/migrator";
import type { DrizzleBunSqliteDatabase } from "../types";

/**
 * Run all pending Drizzle migrations.
 *
 * The migrations folder is resolved relative to this module's location so that
 * the function works regardless of the caller's working directory.
 *
 * When compiled, this file lives at:
 *   packages/storage/dist/db/migrate.js
 * and the migrations folder is at:
 *   packages/storage/drizzle/
 *
 * @param db                 The Drizzle database instance to migrate.
 * @param migrationsFolder   Optional override. Defaults to the sibling
 *                           `drizzle/` folder inside the storage package.
 */
export function runMigrations(
  db: DrizzleBunSqliteDatabase,
  migrationsFolder?: string,
): void {
  const folder =
    migrationsFolder ?? resolve(import.meta.dirname, "../../drizzle");
  drizzleMigrate(db, { migrationsFolder: folder });
}
