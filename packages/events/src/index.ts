// Re-export protocol EventEnvelope so consumers can import it from this package
export type { EventEnvelope } from "@agent-workbench/protocol";
export { EventBus, type EventHandler } from "./bus";
export { EventName, type EventNameValue } from "./names";
