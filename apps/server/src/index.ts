import { SessionRunner } from "@agent-workbench/core";
import { EventBus } from "@agent-workbench/events";
import { StubModelProvider } from "@agent-workbench/models";
import { PermissionEngine, PermissionGate } from "@agent-workbench/permissions";
import { ToolRegistry, registerReadOnlyTools } from "@agent-workbench/tools";
import {
  createStorageConnection,
  runMigrations,
  SessionRepository,
  MessageRepository,
  ToolCallRepository,
  LedgerRepository,
  CacheRepository,
  PermissionRepository,
} from "@agent-workbench/storage";
import { ToolCache } from "@agent-workbench/cache";
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
const cacheRepository = new CacheRepository(storage.db);
const permissionRepository = new PermissionRepository(storage.db);

// ── Events ───────────────────────────────────────────────────────────────────
const eventBus = new EventBus();

// ── Phase 8: Permission engine ───────────────────────────────────────────────
// Uses default policy (docs/05_PERMISSION_MODEL.md §3).
// The same permissionEngine and permissionGate instances are shared between
// SessionRunner (which waits on the gate) and the server routes (which resolve it).
const permissionEngine = new PermissionEngine();
const permissionGate = new PermissionGate();

// ── Cache ────────────────────────────────────────────────────────────────────
// Phase 7: session-scoped tool result cache backed by the cache_entries table.
const toolCache = new ToolCache(cacheRepository);

// ── Tools ────────────────────────────────────────────────────────────────────
// Phase 7: register read, grep, and glob read-only tools.
const toolRegistry = new ToolRegistry();
registerReadOnlyTools(toolRegistry, { cache: toolCache });

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
  permissionRepository,
  eventBus,
  toolRegistry,
  modelProvider,
  permissionEngine,
  permissionGate,
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
    permissionRepository,
    permissionEngine,
    permissionGate,
  },
});

console.log(`[server] Binding to http://${config.host}:${config.port}`);
console.log("[server] Phase 8 — Permission Engine active");
console.log(`[server] Registered tools: ${toolRegistry.list().map((t) => t.name).join(", ")}`);
console.log("[server] Using StubModelProvider (real providers are a future phase)");

export default {
  port: config.port,
  hostname: config.host,
  fetch: app.fetch,
};
