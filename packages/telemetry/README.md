# @agent-workbench/telemetry

Observability and telemetry for the agent-workbench server. Collects and exposes metrics, traces, and health data for monitoring server performance and agent behavior.

## Usage

```typescript
import { TelemetryService } from "@agent-workbench/telemetry";

const telemetry = new TelemetryService({ eventBus });
telemetry.recordMetric("session.created", { sessionId: "abc" });
const stats = telemetry.getStats();
```

## Scope

- In-memory metric collection
- Event-driven metric recording
- Health check data aggregation
- Stats export for dashboards
- Part of Phase 25 (observability & production readiness)
