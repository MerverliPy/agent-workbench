import { AuthManager, TlsConfig } from "@agent-workbench/auth";
import { ToolCache } from "@agent-workbench/cache";
import {
  PresenceManager,
  ReviewQueue,
  SharedSessionManager,
  ShareManager,
} from "@agent-workbench/collab";
import {
  applyRetention,
  createAirGappedFetch,
  isAirGapped,
} from "@agent-workbench/compliance";
import {
  AgentRegistry,
  SessionRunner,
  TokenHealthService,
} from "@agent-workbench/core";
import { EventBus } from "@agent-workbench/events";
import {
  CostTracker,
  ProviderHealthMonitor,
  ProviderMarketplace,
  ProviderRegistry,
  SmartRouter,
} from "@agent-workbench/models";
import { PermissionEngine, PermissionGate } from "@agent-workbench/permissions";
import { PluginRegistry } from "@agent-workbench/plugin-sdk";
import { PtyCommandRunner, SimpleCommandRunner } from "@agent-workbench/shell";
import {
  CacheRepository,
  createStorageConnection,
  FileChangeRepository,
  LedgerRepository,
  MessageRepository,
  PermissionRepository,
  PlanRepository,
  runMigrations,
  SessionRepository,
  SummaryRepository,
  ToolCallRepository,
  WorkspaceRepository,
} from "@agent-workbench/storage";
import {
  ErrorReporter,
  MetricsExporter,
  RequestLogger,
  Tracer,
} from "@agent-workbench/telemetry";
import {
  registerMutationTools,
  registerPtyShellTool,
  registerReadOnlyTools,
  registerShellTool,
  ToolRegistry,
} from "@agent-workbench/tools";
import { ulid } from "ulid";
import { createApp } from "./app";
import { getServerConfig } from "./config";
import { loadAllPlugins } from "./plugin-loader";
import { createLogger } from "./utils/logger";
import { detectTailscaleIp } from "./utils/tailscale";

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
const workspaceRepository = new WorkspaceRepository(storage.db);

// ── Reconcile stale permission requests from previous server instance ──────
const staleRequests = permissionRepository.listRequests("pending");
if (staleRequests.length > 0) {
  logger.info(
    `Resolving ${staleRequests.length} stale permission requests (server restart)`,
  );
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

// ── Phase 23: PTY command runner ─────────────────────────────────────────────
const ptyRunner = new PtyCommandRunner();

// ── Tools ────────────────────────────────────────────────────────────────────
// Phase 7: register read, grep, and glob read-only tools.
// Phase 9: register write, edit, apply_patch, diff_preview, revert_last_change.
// Phase 10: register bash shell tool.
// Phase 23: register PTY shell tool.
const toolRegistry = new ToolRegistry();
registerReadOnlyTools(toolRegistry, { cache: toolCache });
registerMutationTools(toolRegistry, { fileChangeRepository, toolCache });
registerShellTool(toolRegistry, { shellRunner });
registerPtyShellTool(toolRegistry, { ptyRunner });

// ── Phase 15: Provider registry ──────────────────────────────────────────────
const airGapped = isAirGapped();
if (airGapped) {
  logger.info("🔒 Air-gapped mode ACTIVE — external network calls are blocked");
  logger.info("  Only local services (localhost) are allowed.");
}

const providerRegistry = new ProviderRegistry(
  airGapped ? { fetchImpl: createAirGappedFetch() } : undefined,
);

// ── Data retention ───────────────────────────────────────────────────────
// Phase 30: apply data retention policy every 24 hours.
// Runs immediately on startup to clean stale entries.
const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
(function scheduleRetention() {
  try {
    const entriesResult = ledgerRepository.listByCategory("audit");
    // biome-ignore lint/suspicious/noExplicitAny: LedgerRow[] → AuditEntry[] cast for retention
    const { result } = applyRetention(entriesResult as any);
    if (result.deletedCount > 0) {
      logger.info(
        `Data retention: removed ${result.deletedCount} entries older than ${result.cutoffDate}`,
      );
    }
  } catch {
    // Best-effort — retention may fail if no audit entries exist yet
  }

  setInterval(() => {
    try {
      const entriesResult = ledgerRepository.listByCategory("audit");
      // biome-ignore lint/suspicious/noExplicitAny: LedgerRow[] → AuditEntry[] cast for retention
      const { result } = applyRetention(entriesResult as any);
      if (result.deletedCount > 0) {
        logger.info(
          `Data retention: removed ${result.deletedCount} entries older than ${result.cutoffDate}`,
        );
      }
    } catch {
      // Best-effort
    }
  }, RETENTION_INTERVAL_MS);

  logger.info("Data retention: scheduled every 24 hours (max 90 days)");
})();

const modelProvider = providerRegistry.getDefaultProvider();

// ── Phase 24: Provider marketplace & smart routing ───────────────────────────
const providerMarketplace = new ProviderMarketplace();
const smartRouter = new SmartRouter(providerMarketplace);
const costTracker = new CostTracker();
const providerHealthMonitor = new ProviderHealthMonitor(providerMarketplace, {
  checkIntervalMs: 60_000, // Check every minute
});
providerHealthMonitor.start();

// ── Phase 11: Agent registry ──────────────────────────────────────────────────
const agentRegistry = new AgentRegistry();

// ── Phase 12: Token health service ──────────────────────────────────────────────
const tokenHealthService = new TokenHealthService(
  messageRepository,
  summaryRepository,
);

// ── Phase 25: Observability ─────────────────────────────────────────────────
const tracer = new Tracer({ maxSpans: 10_000 });
const metricsExporter = new MetricsExporter();
const errorReporter = new ErrorReporter({ maxErrors: 1000 });
const requestLogger = new RequestLogger({ level: "info" });

// ── Phase 26: Plugin system ─────────────────────────────────────────────────
const pluginRegistry = new PluginRegistry();
logger.info(`Plugin directory: ${pluginRegistry.getPluginsDir()}`);

const pluginLoadResult = await loadAllPlugins({
  pluginRegistry,
  toolRegistry,
  providerRegistry,
});
if (pluginLoadResult.loaded > 0 || pluginLoadResult.failed > 0) {
  logger.info(
    `Plugins: ${pluginLoadResult.loaded} loaded, ${pluginLoadResult.failed} failed`,
  );
}

// ── Phase 27: Auth ─────────────────────────────────────────────────────────
const authManager = new AuthManager();
if (authManager.isEnabled) {
  logger.info("Auth is enabled — bearer token required for API access");
  logger.info(
    `  Generate a token: curl -X POST http://${config.host}:${config.port}/auth/token \\`,
  );
  logger.info(`    -H "Content-Type: application/json" \\`);
  logger.info(
    `    -d '{"secret":"<AGENT_WORKBENCH_AUTH_SECRET>","label":"my-device"}'`,
  );
  if (authManager.isTlsEnabled) {
    logger.info("TLS is enabled — server will serve HTTPS");
  }
} else {
  logger.info("Auth is disabled — all API requests are unauthenticated");
  logger.info(
    `  Set AGENT_WORKBENCH_AUTH_SECRET and AGENT_WORKBENCH_AUTH_ENABLED=true to enable`,
  );
}

// ── Phase 27: Collaboration ───────────────────────────────────────────────
const sharedSessionManager = new SharedSessionManager({ eventBus });
logger.info("Collaboration — shared session presence ready");

const shareManager = new ShareManager({
  eventBus,
  baseUrl: `http://${config.host}:${config.port}`,
});
logger.info("Collaboration — session sharing ready");

const presenceManager = new PresenceManager(sharedSessionManager);
logger.info("Collaboration — real-time presence ready");

const reviewQueue = new ReviewQueue({ eventBus });
logger.info("Collaboration — code review queue ready");

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
    workspaceRepository,
    providerMarketplace,
    smartRouter,
    costTracker,
    providerHealthMonitor,
    tracer,
    metricsExporter,
    errorReporter,
    requestLogger,
    toolCallRepository,
    pluginRegistry,
    auth: authManager,
    sharedSessionManager,
    shareManager,
    presenceManager,
    reviewQueue,
  },
});

logger.info(`Binding to http://${config.host}:${config.port}`);

// ── Tailscale auto-detect ────────────────────────────────────────────────────
const tailscaleIp = detectTailscaleIp();
if (tailscaleIp) {
  const tailscaleUrl = `http://${tailscaleIp}:${config.port}`;
  logger.info(`🌐 Tailscale detected — remote access at ${tailscaleUrl}`);
  shareManager.setBaseUrl(tailscaleUrl);
}

if (authManager.isTlsEnabled) {
  logger.info("Phase 27 — TLS enabled, serving HTTPS");
}
logger.info("Phase 10 — Shell Execution active");
logger.info(
  `Registered tools: ${toolRegistry
    .list()
    .map((t) => t.name)
    .join(", ")}`,
);
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
    if (
      typeof (storage as unknown as Record<string, unknown>).close ===
      "function"
    ) {
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

// ── Start server (HTTP or HTTPS) ───────────────────────────────────────────
if (authManager.isTlsEnabled) {
  const tls = new TlsConfig();
  const { key, cert } = await tls.ensureCertificate();

  Bun.serve({
    port: config.port,
    hostname: config.host,
    fetch: app.fetch,
    tls: { key, cert },
    development: process.env.NODE_ENV !== "production",
    idleTimeout: 255,
  });

  logger.info(`🔒 HTTPS server ready at https://${config.host}:${config.port}`);
} else {
  Bun.serve({
    port: config.port,
    hostname: config.host,
    fetch: app.fetch,
    development: process.env.NODE_ENV !== "production",
    idleTimeout: 255,
  });

  logger.info(`🔓 HTTP server ready at http://${config.host}:${config.port}`);
}
