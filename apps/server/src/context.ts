import type { SessionRunner } from "@agent-workbench/core";
import type { EventBus } from "@agent-workbench/events";
import type {
  SessionRepository,
  MessageRepository,
  LedgerRepository,
  PermissionRepository,
} from "@agent-workbench/storage";
import type { PermissionEngine, PermissionGate } from "@agent-workbench/permissions";

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
}

export type ServerAppBindings = {
  Variables: RequestContextVariables;
  /**
   * Hono does not provide a built-in "services" slot, so we thread services
   * through app options and close over them in each route-registration
   * function. This type exists for documentation purposes only.
   */
};
