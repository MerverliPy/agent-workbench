import { createStorageConnection } from "./db/connection";
import { runMigrations } from "./db/migrate";

const connection = createStorageConnection();
try {
  runMigrations(connection.db);
  console.log("Migrations complete");
} finally {
  connection.close();
}
