/**
 * Lifecycle hook plugin extension interface.
 *
 * Plugins can register hooks that fire at specific points in the
 * agent-workbench lifecycle. Hooks receive a context object and can
 * perform side effects, modify data, or block operations.
 */

/** Context passed to lifecycle hooks. */
export interface HookContext {
  /** Current session ID if available. */
  readonly sessionId?: string;
  /** Current run ID if available. */
  readonly runId?: string;
  /** Project path for the current session. */
  readonly projectPath?: string;
  /** Timestamp when the hook was triggered. */
  readonly timestamp: string;
  /** Arbitrary data passed by the hook trigger. */
  readonly data?: Record<string, unknown>;
}

/** Result returned by a hook handler. */
export interface HookResult {
  /** Whether the operation should proceed. */
  readonly allow: boolean;
  /** Reason for blocking (if allow is false). */
  readonly reason?: string;
  /** Modified data to pass to the next hook or caller. */
  readonly data?: Record<string, unknown>;
}

/** A single hook registration. */
export interface PluginHook {
  /** Unique hook ID (e.g. "github.on_push"). */
  readonly id: string;
  /** Lifecycle event this hook listens for. */
  readonly event: HookEvent;
  /** Hook handler function. */
  handler(context: HookContext): Promise<HookResult>;
}

/** Supported lifecycle events. */
export type HookEvent =
  | "onSessionStart"
  | "onSessionEnd"
  | "onMessageReceived"
  | "onMessageSent"
  | "onToolCallStart"
  | "onToolCallComplete"
  | "onPermissionRequest"
  | "onError";

/** Interface that hook plugins must export as their default export. */
export interface HookPlugin {
  /** Plugin metadata. */
  readonly name: string;
  readonly version: string;
  /** Hooks provided by this plugin. */
  readonly hooks: PluginHook[];
}
