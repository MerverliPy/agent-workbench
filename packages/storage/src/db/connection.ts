import { statSync, mkdirSync } from "node:fs";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "../schema";

export interface StorageConnection {
  db: ReturnType<typeof drizzle<typeof schema>>;
  sqlite: Database;
  close: () => void;
}

export interface StorageConnectionOptions {
  dbPath?: string;
}

export function defaultDbPath(): string {
  const xdgDataHome = process.env["XDG_DATA_HOME"];
  const home = process.env["HOME"];

  if (!home) {
    throw new Error(
      "Cannot determine default database path: HOME environment variable is not set"
    );
  }

  const base = xdgDataHome ?? `${home}/.local/share`;
  return `${base}/agent-workbench/workbench.db`;
}

function ensureParentDir(filePath: string): void {
  const lastSep = filePath.lastIndexOf("/");
  if (lastSep <= 0) return;

  const dir = filePath.substring(0, lastSep);
  try {
    const st = statSync(dir);
    if (!st.isDirectory()) {
      throw new Error(
        `Database parent path exists but is not a directory: ${dir}`
      );
    }
  } catch (err: unknown) {
    const fsErr = err as NodeJS.ErrnoException;
    if (fsErr.code === "ENOENT") {
      mkdirSync(dir, { recursive: true });
    } else {
      throw err;
    }
  }
}

export function createStorageConnection(
  options: StorageConnectionOptions = {}
): StorageConnection {
  const dbPath = options.dbPath ?? defaultDbPath();
  ensureParentDir(dbPath);

  const sqlite = new Database(dbPath);
  sqlite.run("PRAGMA journal_mode=WAL");
  sqlite.run("PRAGMA foreign_keys=ON");

  const db = drizzle(sqlite, { schema });

  return {
    db,
    sqlite,
    close: () => sqlite.close(),
  };
}
