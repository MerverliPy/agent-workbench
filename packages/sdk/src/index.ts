export { WorkbenchClient } from "./client";
export type { WorkbenchClientOptions } from "./client";

export { HttpTransport } from "./transport/http";
export { SseTransport } from "./transport/sse";
export { SdkError, ApiError } from "./transport/errors";
export type { EventCallback, EventFilter, ErrorCallback } from "./transport/sse";
export type { HttpTransportOptions } from "./transport/http";

export {
  HealthResource,
  EventResource,
  SessionResource,
  MessageResource,
  ConfigResource,
  ProviderResource,
  FileResource,
  PermissionResource,
  ToolResource,
  TuiResource,
  AgentResource,
  TokenHealthResource,
  AuthResource,
} from "./resources";
