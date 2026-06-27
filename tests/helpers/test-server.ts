import { createApp } from "@agent-workbench/server/public";
import type { ServerConfig, ServerServices, ServerAppBindings } from "@agent-workbench/server/public";
import type { Hono } from "hono";
import { SessionRunner, AgentRegistry, TokenHealthService } from "@agent-workbench/core";
import { EventBus } from "@agent-workbench/events";
import { MockModelProvider } from "./mock-model";
import type { MockModelTurn } from "./mock-model";
import { ProviderRegistry } from "@agent-workbench/models";
import { PermissionEngine, PermissionGate } from "@agent-workbench/permissions";
import type { PermissionPolicy } from "@agent-workbench/permissions";
import { ToolRegistry, registerReadOnlyTools, registerMutationTools, registerShellTool } from "@agent-workbench/tools";
import { ToolCache } from "@agent-workbench/cache";
import { SimpleCommandRunner } from "@agent-workbench/shell";
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
  modelProvider: MockModelProvider;
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
