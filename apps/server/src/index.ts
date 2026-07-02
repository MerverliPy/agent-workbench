import { SessionRunner, AgentRegistry, TokenHealthService } from "@agent-workbench/core";
import { EventBus } from "@agent-workbench/events";
import { ProviderRegistry } from "@agent-workbench/models";
import { PermissionEngine, PermissionGate } from "@agent-workbench/permissions";
import { ToolRegistry, registerReadOnlyTools, registerMutationTools, registerShellTool } from "@agent-workbench/tools";
import {
  createStorageConnection,
  runMigrations,
  SessionRepository,
  MessageRepository,
  ToolCallRepository,
  LedgerRepository,
  CacheRepository,
  FileChangeRepository,
  PermissionRepository,
  SummaryRepository,
  PlanRepository,
} from "@agent-workbench/storage";
import { ToolCache } from "@agent-workbench/cache";
import { SimpleCommandRunner } from "@agent-workbench/shell";
import { ulid } from "ulid";
import { createApp } from "./app";
import { getServerConfig } from "./config";
import { createLogger } from "./utils/logger";

const config = getServerConfig();
const logger = createLogger("server");

// ── Storage ─────────────────────────────────────────────────────────────────
const storage = createStorageConnection();
await runMigrations(storage.db);

const sessionRepository = new SessionRepository(storage.db);
const messageRepository = new MessageRepository(storage.db);
const toolCallRepository = new ToolCallRepository(storage.db);
const ledgerRepository = new LedgerRepository(storage.db);
const cacheRepository = new CacheRepository(storage.db);
const fileChangeRepository = new FileChangeRepository(storage.db);
const permissionRepository = new PermissionRepository(storage.db);
const summaryRepository = new SummaryRepository(storage.db);
const planRepository = new PlanRepository(storage.db);

// ── Reconcile stale permission requests from previous server instance ──────
const staleRequests = permissionRepository.listRequests("pending");
if (staleRequests.length > 0) {
  logger.info(`Resolving ${staleRequests.length} stale permission requests (server restart)`);
  for (const req of staleRequests) {
    const decisionId = ulid();
    permissionRepository.createDecision({
      id: decisionId,
      requestId: req.id,
      decision: "deny",
      decidedBy: "system",
      scope: null,
      reason: "Server restarted — pending request auto-denied.",
      createdAt: new Date().toISOString(),
      metadataJson: null,
    });
    permissionRepository.updateRequest(req.id, { status: "denied" });
  }
}

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

// ── Phase 10: Shell command runner ────────────────────────────────────────────
const shellRunner = new SimpleCommandRunner();

// ── Tools ────────────────────────────────────────────────────────────────────
// Phase 7: register read, grep, and glob read-only tools.
// Phase 9: register write, edit, apply_patch, diff_preview, revert_last_change.
// Phase 10: register bash shell tool.
const toolRegistry = new ToolRegistry();
registerReadOnlyTools(toolRegistry, { cache: toolCache });
registerMutationTools(toolRegistry, { fileChangeRepository, toolCache });
registerShellTool(toolRegistry, { shellRunner });

// ── Phase 15: Provider registry ──────────────────────────────────────────────
const providerRegistry = new ProviderRegistry();
const modelProvider = providerRegistry.getDefaultProvider();

// ── Phase 11: Agent registry ──────────────────────────────────────────────────
const agentRegistry = new AgentRegistry();

// ── Phase 12: Token health service ──────────────────────────────────────────────
const tokenHealthService = new TokenHealthService(messageRepository, summaryRepository);

// ── Core runtime ──────────────────────────────────────────────────────────────
const sessionRunner = new SessionRunner({
  sessionRepository,
  messageRepository,
  toolCallRepository,
  ledgerRepository,
  permissionRepository,
  summaryRepository,
  planRepository,
  fileChangeRepository,
  eventBus,
  toolRegistry,
  modelProvider,
  permissionEngine,
  permissionGate,
  shellRunner,
  agentRegistry,
  tokenHealthService,
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
    agentRegistry,
    tokenHealthService,
    summaryRepository,
    planRepository,
    providerRegistry,
  },
});

logger.info(`Binding to http://${config.host}:${config.port}`);
logger.info("Phase 10 — Shell Execution active");
logger.info(`Registered tools: ${toolRegistry.list().map((t) => t.name).join(", ")}`);
logger.info("Phase 15 — Provider integration active");

// ── Graceful shutdown ──────────────────────────────────────────────────────
let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal} — shutting down gracefully...`);

  // Abort all active runs so permission prompts are released.
  const sessions = sessionRepository.list();
  for (const s of sessions) {
    sessionRunner.abort(s.id);
  }

  // Close storage connection.
  try {
    if (typeof (storage as unknown as Record<string, unknown>).close === "function") {
      ((storage as unknown as Record<string, unknown>).close as () => void)();
    }
  } catch {
    // Best-effort — connection may already be closed.
  }

  logger.info("Shutdown complete.");
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export default {
  port: config.port,
  hostname: config.host,
  fetch: app.fetch,
};
