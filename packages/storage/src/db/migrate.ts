import type { DrizzleBunSqliteDatabase } from "../types";
import { migrate as drizzleMigrate } from "drizzle-orm/bun-sqlite/migrator";

export function runMigrations(db: DrizzleBunSqliteDatabase): void {
  drizzleMigrate(db, { migrationsFolder: "./drizzle" });
}
