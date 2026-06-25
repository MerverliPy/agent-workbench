import { SessionRunner } from "@agent-workbench/core";
import { EventBus } from "@agent-workbench/events";
import { StubModelProvider } from "@agent-workbench/models";
import { ToolRegistry } from "@agent-workbench/tools";
import {
  createStorageConnection,
  runMigrations,
  SessionRepository,
  MessageRepository,
  ToolCallRepository,
  LedgerRepository,
} from "@agent-workbench/storage";
import { createApp } from "./app";
import { getServerConfig } from "./config";

const config = getServerConfig();

// ── Storage ─────────────────────────────────────────────────────────────────
const storage = createStorageConnection();
await runMigrations(storage.db);

const sessionRepository = new SessionRepository(storage.db);
const messageRepository = new MessageRepository(storage.db);
const toolCallRepository = new ToolCallRepository(storage.db);
const ledgerRepository = new LedgerRepository(storage.db);

// ── Events ───────────────────────────────────────────────────────────────────
const eventBus = new EventBus();

// ── Tools ────────────────────────────────────────────────────────────────────
// Phase 6: registry is empty. Phase 7 will register read/grep/glob here.
const toolRegistry = new ToolRegistry();

// ── Model provider ───────────────────────────────────────────────────────────
// Phase 6: stub provider. Real adapters will be added in a future phase.
const modelProvider = new StubModelProvider({
  textResponse: "Hello! I am the agent-workbench stub assistant. Real model providers will be added in a future phase.",
});

// ── Core runtime ──────────────────────────────────────────────────────────────
const sessionRunner = new SessionRunner({
  sessionRepository,
  messageRepository,
  toolCallRepository,
  ledgerRepository,
  eventBus,
  toolRegistry,
  modelProvider,
});

// ── Server ───────────────────────────────────────────────────────────────────
const app = createApp({
  config,
  services: {
    sessionRunner,
    eventBus,
    sessionRepository,
    messageRepository,
    ledgerRepository,
  },
});

console.log(`[server] Binding to http://${config.host}:${config.port}`);
console.log("[server] Phase 6 — Core Runtime active");
console.log("[server] Using StubModelProvider (real providers are a future phase)");

export default {
  port: config.port,
  hostname: config.host,
  fetch: app.fetch,
};
