import type { AuthManager } from "@agent-workbench/auth";
import type {
  PresenceManager,
  ReviewQueue,
  SharedSessionManager,
  ShareManager,
} from "@agent-workbench/collab";
import type {
  AgentRegistry,
  SessionRunner,
  TokenHealthService,
} from "@agent-workbench/core";
import type { EventBus } from "@agent-workbench/events";
import type {
  CostTracker,
  ProviderHealthMonitor,
  ProviderMarketplace,
  ProviderRegistry,
  SmartRouter,
} from "@agent-workbench/models";
import type {
  PermissionEngine,
  PermissionGate,
} from "@agent-workbench/permissions";
import type { PluginRegistry } from "@agent-workbench/plugin-sdk";
import type {
  LedgerRepository,
  MessageRepository,
  PermissionRepository,
  PlanRepository,
  SessionRepository,
  SummaryRepository,
  ToolCallRepository,
  WorkspaceRepository,
} from "@agent-workbench/storage";
import type {
  ErrorReporter,
  MetricsExporter,
  RequestLogger,
  Tracer,
} from "@agent-workbench/telemetry";

/** Per-request variables set by middleware. */
export interface RequestContextVariables {
  readonly requestId: string;
  readonly auth?: import("@agent-workbench/auth").AuthContext;
}

/** Services injected at app-creation time and available to all route handlers. */
export interface ServerServices {
  readonly sessionRunner: SessionRunner;
  readonly eventBus: EventBus;
  readonly sessionRepository: SessionRepository;
  readonly messageRepository: MessageRepository;
  readonly ledgerRepository: LedgerRepository;
  // Phase 8: permission engine services
  readonly permissionRepository: PermissionRepository;
  readonly permissionEngine: PermissionEngine;
  readonly permissionGate: PermissionGate;
  // Phase 9: tool call repository
  readonly toolCallRepository: ToolCallRepository;
  // Phase 11: agent registry
  readonly agentRegistry: AgentRegistry;
  // Phase 12: token health
  readonly tokenHealthService: TokenHealthService;
  readonly summaryRepository: SummaryRepository;
  // Phase 13: plan repository
  readonly planRepository: PlanRepository;
  // Phase 15: provider registry
  readonly providerRegistry: ProviderRegistry;
  // Phase 22: workspace repository
  readonly workspaceRepository: WorkspaceRepository;
  // Phase 24: provider marketplace & smart routing
  readonly providerMarketplace: ProviderMarketplace;
  readonly smartRouter: SmartRouter;
  readonly costTracker: CostTracker;
  readonly providerHealthMonitor: ProviderHealthMonitor;
  // Phase 25: observability
  readonly tracer: Tracer;
  readonly metricsExporter: MetricsExporter;
  readonly errorReporter: ErrorReporter;
  readonly requestLogger: RequestLogger;
  // Phase 26: plugin system
  readonly pluginRegistry: PluginRegistry;
  // Phase 27: authentication
  readonly auth: AuthManager;
  // Phase 27: shared session state (multi-user presence)
  readonly sharedSessionManager: SharedSessionManager;
  // Phase 27: session sharing (view-only links)
  readonly shareManager: ShareManager;
  // Phase 27: real-time user presence
  readonly presenceManager: PresenceManager;
  // Phase 27: collaborative code review
  readonly reviewQueue: ReviewQueue;
}

export type ServerAppBindings = {
  Variables: RequestContextVariables;
};
