import { WorkbenchClient } from "@agent-workbench/sdk";

/**
 * Base URL for the local agent-workbench server.
 * Phase 4: hardcoded to localhost default.
 * Later phases: read from config/env.
 */
export const SERVER_BASE_URL = "http://localhost:3000";

/**
 * Singleton SDK client for all TUI → server communication.
 * All server requests must go through this client.
 * No direct fetch calls; no forbidden package imports.
 */
export const sdk = new WorkbenchClient({ baseUrl: SERVER_BASE_URL });
