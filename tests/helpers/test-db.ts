import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createStorageConnection,
  runMigrations,
} from "@agent-workbench/storage";
import type { StorageConnection } from "@agent-workbench/storage";

export interface TestDb {
  connection: StorageConnection;
  dbPath: string;
  cleanup: () => void;
}

export function createTestDb(): TestDb {
  const dir = mkdtempSync(join(tmpdir(), "agent-workbench-test-"));
  const dbPath = join(dir, "workbench.db");
  mkdirSync(dir, { recursive: true });

  const connection = createStorageConnection({ dbPath });
  runMigrations(connection.db);

  return {
    connection,
    dbPath,
    cleanup: () => {
      connection.close();
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    },
  };
}
