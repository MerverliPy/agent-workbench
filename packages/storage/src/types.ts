import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "./schema";

export type DrizzleBunSqliteDatabase = BunSQLiteDatabase<typeof schema>;
