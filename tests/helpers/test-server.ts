import { createApp } from "@agent-workbench/server/public";
import type { ServerConfig, ServerServices, ServerAppBindings } from "@agent-workbench/server/public";
import type { Hono } from "hono";
import { SessionRunner, AgentRegistry, TokenHealthService } from "@agent-workbench/core";
import { EventBus } from "@agent-workbench/events";
import { MockModelProvider } from "./mock-model";
import type { MockModelTurn } from "./mock-model";
import { ProviderRegistry, ProviderMarketplace, SmartRouter, CostTracker, ProviderHealthMonitor } from "@agent-workbench/models";
import { Tracer, MetricsExporter, ErrorReporter, RequestLogger } from "@agent-workbench/telemetry";
import { PluginRegistry } from "@agent-workbench/plugin-sdk";
import { PermissionEngine, PermissionGate } from "@agent-workbench/permissions";
import type { PermissionPolicy } from "@agent-workbench/permissions";
import { ToolRegistry, registerReadOnlyTools, registerMutationTools, registerShellTool } from "@agent-workbench/tools";
import { ToolCache } from "@agent-workbench/cache";
import { SimpleCommandRunner } from "@agent-workbench/shell";
import type { AuthManager } from "@agent-workbench/auth";
import type { SharedSessionManager } from "@agent-workbench/collab";
import type { PresenceManager } from "@agent-workbench/collab";
import type { ShareManager } from "@agent-workbench/collab";
import {
  SessionRepository,
  MessageRepository,
  ToolCallRepository,
  LedgerRepository,
  CacheRepository,
  FileChangeRepository,
  PermissionRepository,
  SummaryRepository,
  PlanRepository,
  WorkspaceRepository,
} from "@agent-workbench/storage";
import type { StorageConnection } from "@agent-workbench/storage";

export interface TestServerOptions {
  storage: StorageConnection;
  modelTurns?: MockModelTurn[];
  port?: number;
  /** Override the default PermissionEngine policy (useful for plan-gate/integration tests). */
  permissionPolicy?: import("@agent-workbench/permissions").PermissionPolicy;
  /** Inject a custom model provider (useful for fault-injection tests). */
  modelProvider?: import("@agent-workbench/models").ModelProvider;
}

export interface TestServer {
  app: Hono<ServerAppBindings>;
  services: ServerServices;
  config: ServerConfig;
  storage: StorageConnection;
  modelProvider: import("@agent-workbench/models").ModelProvider;
  eventBus: EventBus;
  sessionRunner: SessionRunner;
  permissionEngine: PermissionEngine;
  permissionGate: PermissionGate;
  tokenHealthService: TokenHealthService;
  agentRegistry: AgentRegistry;
  toolRegistry: ToolRegistry;
  toolCallRepository: ToolCallRepository;
  fileChangeRepository: FileChangeRepository;
  shellRunner: SimpleCommandRunner;
  providerRegistry: ProviderRegistry;
}

export function createTestServer(options: TestServerOptions): TestServer {
  const db = options.storage.db;

  const sessionRepository = new SessionRepository(db);
  const messageRepository = new MessageRepository(db);
  const toolCallRepository = new ToolCallRepository(db);
  const ledgerRepository = new LedgerRepository(db);
  const cacheRepository = new CacheRepository(db);
  const fileChangeRepository = new FileChangeRepository(db);
  const permissionRepository = new PermissionRepository(db);
  const summaryRepository = new SummaryRepository(db);
  const planRepository = new PlanRepository(db);

  const eventBus = new EventBus();
  const permissionEngine = new PermissionEngine(options.permissionPolicy);
  const permissionGate = new PermissionGate();
  const toolCache = new ToolCache(cacheRepository);
  const shellRunner = new SimpleCommandRunner();

  const toolRegistry = new ToolRegistry();
  registerReadOnlyTools(toolRegistry, { cache: toolCache });
  registerMutationTools(toolRegistry, { fileChangeRepository, toolCache });
  registerShellTool(toolRegistry, { shellRunner });

  const modelProvider = options.modelProvider ?? new MockModelProvider(options.modelTurns ?? []);
  const agentRegistry = new AgentRegistry();
  const tokenHealthService = new TokenHealthService(messageRepository, summaryRepository);

  const providerRegistry = new ProviderRegistry({ defaultProvider: modelProvider });

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

  const config: ServerConfig = {
    host: "127.0.0.1",
    port: options.port ?? 0,
    version: "0.0.0-test",
    name: "@agent-workbench/server-test",
    description: "Test server instance",
  };

  const providerMarketplace = new ProviderMarketplace();
  const workspaceRepository = new WorkspaceRepository(db);

  const services: ServerServices = {
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
    smartRouter: new SmartRouter(providerMarketplace),
    costTracker: new CostTracker(),
    providerHealthMonitor: new ProviderHealthMonitor(providerMarketplace),
    tracer: new Tracer(),
    metricsExporter: new MetricsExporter(),
    errorReporter: new ErrorReporter(),
    requestLogger: new RequestLogger({ level: "error" }), // quiet in tests
    pluginRegistry: new PluginRegistry(),
    // Phase 27: auth disabled in tests by default
    auth: {
      isEnabled: false,
      isTlsEnabled: false,
      secret: null,
      getSharedSecret: () => null,
      generateToken: () => null,
      validateToken: () => null,
      revokeToken: () => false,
      listTokens: () => [],
      health: () => ({ enabled: false, activeTokens: 0, tlsEnabled: false, hint: "Auth disabled in tests" }),
    } as unknown as AuthManager,
    // Phase 27: shared session presence disabled in tests
    sharedSessionManager: {
      join: () => undefined,
      leave: () => false,
      updateActivity: () => false,
      getUsers: () => [],
      getUserCount: () => 0,
      isUserInSession: () => false,
      removeSession: () => undefined,
      getActiveSessionIds: () => [],
      getSnapshot: () => ({}),
      get totalActiveSessions() { return 0; },
      get totalActiveUsers() { return 0; },
      startCleanup: () => undefined,
      stopCleanup: () => undefined,
    } as unknown as SharedSessionManager,
    // Phase 27: presence disabled in tests
    presenceManager: {
      enterSession: () => ({ userId: "test", label: "test", role: "viewer" as const, joinedAt: new Date().toISOString(), lastActivityAt: new Date().toISOString() }),
      leaveSession: () => false,
      heartbeat: () => false,
      leaveAllSessions: () => 0,
      getPresence: () => ({ sessionId: "", activeUsers: [], totalUsers: 0 }),
      getUsers: () => [],
      getUserCount: () => 0,
      isUserPresent: () => false,
      getUserSessions: () => [],
      getAllPresence: () => ({}),
      get totalActiveSessions() { return 0; },
      get totalActiveUsers() { return 0; },
      get totalUniqueUsers() { return 0; },
    } as unknown as PresenceManager,
    // Phase 27: session sharing disabled in tests
    shareManager: {
      create: () => ({ token: "shr_test", sessionId: "test", url: "http://localhost/share/shr_test", expiresAt: new Date(Date.now() + 86400000).toISOString(), label: "test" }),
      validate: () => null,
      revoke: () => false,
      revokeAllForSession: () => 0,
      listBySession: () => [],
      get: () => undefined,
      listAll: () => [],
      get totalActiveShares() { return 0; },
      getBaseUrl: () => "http://localhost",
      setBaseUrl: () => undefined,
      startCleanup: () => undefined,
      stopCleanup: () => undefined,
    } as unknown as ShareManager,
  };

  const app = createApp({ config, services });

  return {
    app,
    services,
    config,
    storage: options.storage,
    modelProvider,
    eventBus,
    sessionRunner,
    permissionEngine,
    permissionGate,
    tokenHealthService,
    agentRegistry,
    toolRegistry,
    toolCallRepository,
    fileChangeRepository,
    shellRunner,
    providerRegistry,
  };
}
