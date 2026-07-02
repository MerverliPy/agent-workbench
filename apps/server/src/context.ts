import type { SessionRunner, AgentRegistry, TokenHealthService } from "@agent-workbench/core";
import type { ProviderRegistry } from "@agent-workbench/models";
import type { EventBus } from "@agent-workbench/events";
import type {
  SessionRepository,
  MessageRepository,
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
}

export type ServerAppBindings = {
  Variables: RequestContextVariables;
  /**
   * Hono does not provide a built-in "services" slot, so we thread services
   * through app options and close over them in each route-registration
   * function. This type exists for documentation purposes only.
   */
};
