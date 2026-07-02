import type { SessionRunner, AgentRegistry, TokenHealthService } from "@agent-workbench/core";
import type { ProviderRegistry, ProviderMarketplace, SmartRouter, CostTracker, ProviderHealthMonitor } from "@agent-workbench/models";
import type { EventBus } from "@agent-workbench/events";
import type { Tracer, MetricsExporter, ErrorReporter, RequestLogger } from "@agent-workbench/telemetry";
import type { PluginRegistry } from "@agent-workbench/plugin-sdk";
import type { AuthManager } from "@agent-workbench/auth";
import type { SharedSessionManager } from "@agent-workbench/collab";
import {
  SessionRepository,
  MessageRepository,
  ToolCallRepository,
  LedgerRepository,
  PermissionRepository,
  SummaryRepository,
  PlanRepository,
} from "@agent-workbench/storage";
import type { PermissionEngine, PermissionGate } from "@agent-workbench/permissions";
import type { WorkspaceRepository } from "@agent-workbench/storage";

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
}

export type ServerAppBindings = {
  Variables: RequestContextVariables;
};
