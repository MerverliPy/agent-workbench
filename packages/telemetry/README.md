# @agent-workbench/telemetry

Observability and telemetry for the agent-workbench server. Collects and exposes metrics, traces, and health data for monitoring server performance and agent behavior.

## Usage

```typescript
import { TelemetryService, MetricsExporter, RequestLogger } from "@agent-workbench/telemetry";

const telemetry = new TelemetryService({ eventBus });
telemetry.recordMetric("session.created", { sessionId: "abc" });
telemetry.recordMetric("model.call", { model: "claude-sonnet-4", durationMs: 2345 });

// Export metrics for dashboards
const stats = telemetry.getStats();
console.log(stats.totalSessions, stats.totalModelCalls);
```

## API

| Module | Description |
|--------|-------------|
| `TelemetryService` | Central metrics collection and event recording |
| `MetricsExporter` | Export metrics in structured format |
| `RequestLogger` | Log and track API requests |
| `ErrorReporter` | Capture and report runtime errors |
| `Tracer` | Distributed tracing spans |

## Scope

- In-memory metric collection
- Event-driven metric recording
- Health check data aggregation
- Stats export for dashboards
- Request logging and error reporting

Part of **Phase 25** (observability & production readiness).
