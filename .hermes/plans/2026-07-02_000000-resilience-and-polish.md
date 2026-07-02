# agent-workbench: Resilience & Polish Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Harden agent-workbench with session persistence across restarts, scalable pagination, structured logging, Docker Compose one-command startup, and observability — all remaining improvements from the critical analysis.

**Architecture:** Incremental patches to existing packages — no new packages, no new architectural decisions. Each task touches 1-3 files max and includes a verification step.

**Tech Stack:** Bun + TypeScript 6, Hono, SQLite/Drizzle, SolidJS, Docker

---

## Task 1: Session List Pagination — DB-Level Filtering

**Objective:** Replace in-memory session filtering in `GET /session` with SQL-level queries that accept `status`, `projectPath`, `limit`, and `cursor` params.

**Files:**
- Modify: `packages/storage/src/repositories/session-repository.ts`
- Modify: `packages/protocol/src/routes/session.ts`
- Modify: `apps/server/src/routes/session-routes.ts`
- Test: `tests/unit/session-list.test.ts` (create if needed)

**Step 1: Add paginated query to SessionRepository**

The `list()` method currently returns all rows. Add `listPaginated()`:

```typescript
// packages/storage/src/repositories/session-repository.ts

listPaginated(params?: {
  status?: string;
  projectPath?: string;
  limit?: number;
  cursor?: string; // after this id (keyset pagination)
}): SessionRow[] {
  let query = "SELECT * FROM sessions WHERE 1=1";
  const bindings: unknown[] = [];

  if (params?.status) {
    query += " AND status = ?";
    bindings.push(params.status);
  }
  if (params?.projectPath) {
    query += " AND project_path = ?";
    bindings.push(params.projectPath);
  }
  if (params?.cursor) {
    query += " AND id > ?";
    bindings.push(params.cursor);
  }

  query += " ORDER BY created_at DESC LIMIT ?";
  bindings.push(params?.limit ?? 50);

  return this.db.query(query).all(...bindings);
}
```

**Step 2: Update protocol route contract**

Add `cursor` and `limit` to `SessionListParams`:

```typescript
// packages/protocol/src/routes/session.ts
export const SessionListParams = Pagination.extend({
  status: z.string().optional(),
  projectPath: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional().default(50),
});
```

**Step 3: Update server route handler**

Replace in-memory filter with `listPaginated()`:

```typescript
// apps/server/src/routes/session-routes.ts (GET /session handler)
const rows = sessionRepository.listPaginated({
  status: query.status,
  projectPath: query.projectPath,
  cursor: query.cursor,
  limit: query.limit,
});
const nextCursor = rows.length === query.limit ? rows[rows.length - 1]?.id : undefined;
return { items: rows.map(rowToProtocol), nextCursor };
```

**Step 4: Verify**

```bash
cd ~/workspace/agent-workbench
# Typecheck all layers
(cd packages/storage && bun run typecheck)
(cd packages/protocol && bun run typecheck)
(cd apps/server && bun run typecheck)
# Run tests
bun test
```

**Expected:** All typechecks pass, tests pass.

---

## Task 2: Permission Decision Persistence Across Restarts

**Objective:** When the server restarts, all pending permission requests stored in `permission_requests` table should be resolved as `"denied"` with reason `"server_restarted"`. This prevents orphaned hung states.

**Files:**
- Modify: `apps/server/src/index.ts`

**Step 1: Add startup reconciliation**

After storage initialization, resolve all `"pending"` permission requests:

```typescript
// apps/server/src/index.ts — after `await runMigrations(storage.db);`
// Add:

// ── Reconcile stale permission requests from previous server instance ──────
const staleRequests = permissionRepository.listRequests("pending");
if (staleRequests.length > 0) {
  console.log(
    `[server] Resolving ${staleRequests.length} stale permission requests (server restart)`
  );
  for (const req of staleRequests) {
    const decisionId = ulid();
    permissionRepository.createDecision({
      id: decisionId,
      requestId: req.id,
      decision: "deny",
      decidedBy: "system",
      scope: null,
      reason: "Server restarted — pending request auto-denied.",
      createdAt: new Date().toISOString(),
      metadataJson: null,
    });
    permissionRepository.updateRequest(req.id, { status: "denied" });
    // No need to call permissionGate.resolve() — the old gate instance is gone.
  }
}
```

**Step 2: Verify**

```bash
cd ~/workspace/agent-workbench
(cd apps/server && bun run typecheck)
bun test
```

**Expected:** Typecheck passes, tests pass. Logging shows resolved count on startup.

---

## Task 3: Message Pagination in Context Builder

**Objective:** Cap the context built by `ContextBuilder` to the most recent ~200 messages to prevent unbounded growth on long sessions. Use the existing `tokenCount` field and a simple truncation heuristic.

**Files:**
- Modify: `packages/core/src/context-builder.ts`

**Step 1: Read current context builder**

Locate `packages/core/src/context-builder.ts` and identify the `build()` method.

**Step 2: Add message window cap**

Add a `MAX_CONTEXT_MESSAGES = 200` constant and slice the message list:

```typescript
// packages/core/src/context-builder.ts

const MAX_CONTEXT_MESSAGES = 200;

async build(params: {
  sessionId: string;
  systemPrompt?: string;
  agentSystemPrompt?: string;
}): Promise<ContextMessage[]> {
  const messages = this.messageRepository.listBySession(params.sessionId);

  // Cap to most recent messages to prevent context blowout
  const recentMessages = messages.length > MAX_CONTEXT_MESSAGES
    ? messages.slice(-MAX_CONTEXT_MESSAGES)
    : messages;

  // If messages were truncated, prepend a synthetic system note
  const notice = messages.length > MAX_CONTEXT_MESSAGES
    ? `[Earlier messages truncated: ${messages.length - MAX_CONTEXT_MESSAGES} messages omitted]`
    : undefined;

  const context: ContextMessage[] = [];
  // ... existing system prompt logic ...
  if (notice) {
    context.push({ role: "system", content: notice });
  }
  // ... existing message mapping for recentMessages ...
  return context;
}
```

**Step 3: Verify**

```bash
(cd packages/core && bun run typecheck)
bun test
```

**Expected:** Typecheck passes, tests pass.

---

## Task 4: FileBrowser Path Traversal Re-Validation

**Objective:** Server-side `files.list()` and `files.read()` routes re-validate the resolved path against `session.projectPath` to prevent path traversal attacks.

**Files:**
- Modify: `packages/tools/src/tools/file-tools.ts` (or wherever file read/list executors live)
- Modify: `apps/server/src/routes/` (file-related routes)

**Step 1: Identify file tool executors**

Search for `files.list` and `files.read` executor implementations in packages/tools.

**Step 2: Re-validate against project root**

Add containment check to file tool executors:

```typescript
// Inside the file-list or file-read executor
import { assertSafePath } from "@agent-workbench/tools"; // or equivalent

// In the execute() method:
const safePath = assertSafePath(input.path, context.projectRoot);
// safePath is now guaranteed within projectRoot
```

If `assertSafePath` throws, catch and return a structured error:

```typescript
try {
  const safePath = assertSafePath(input.path, context.projectRoot);
} catch (err) {
  return {
    error: `Path not allowed: ${err instanceof Error ? err.message : String(err)}`,
  };
}
```

**Step 3: Add server-side guard in the file routes**

If the file route handlers build paths independently, add:

```typescript
// apps/server/src/routes/ (file browsers or tools routes)
const session = sessionRepository.findById(sessionId);
const safePath = assertSafePath(requestedPath, session.projectPath);
```

**Step 4: Verify**

```bash
(cd packages/tools && bun run typecheck)
(cd apps/server && bun run typecheck)
bun test
# Also run e2e tests
bun run test:e2e
```

**Expected:** Typechecks pass, tests + e2e pass.

---

## Task 5: Structured Logging

**Objective:** Prefix all `console.log`/`console.warn`/`console.error` calls in the server with `[timestamp][level][session?]` format for grep-ability and session correlation.

**Files:**
- Create: `apps/server/src/utils/logger.ts`
- Modify: `apps/server/src/index.ts`

**Step 1: Create structured logger**

```typescript
// apps/server/src/utils/logger.ts

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  sessionId?: string;
  component?: string;
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatLine(level: LogLevel, message: string, ctx?: LogContext): string {
  const parts: string[] = [
    `[${formatTimestamp()}]`,
    `[${level.toUpperCase()}]`,
  ];
  if (ctx?.sessionId) parts.push(`[session:${ctx.sessionId}]`);
  if (ctx?.component) parts.push(`[${ctx.component}]`);
  parts.push(message);
  return parts.join(" ");
}

export function createLogger(component: string) {
  return {
    info: (message: string, ctx?: LogContext) =>
      console.log(formatLine("info", message, { ...ctx, component })),
    warn: (message: string, ctx?: LogContext) =>
      console.warn(formatLine("warn", message, { ...ctx, component })),
    error: (message: string, ctx?: LogContext) =>
      console.error(formatLine("error", message, { ...ctx, component })),
    debug: (message: string, ctx?: LogContext) =>
      console.debug(formatLine("debug", message, { ...ctx, component })),
  };
}
```

**Step 2: Replace top-level console calls in server**

```typescript
// apps/server/src/index.ts
import { createLogger } from "./utils/logger";

const logger = createLogger("server");
// Replace:
// console.log(`[server] Binding to http://...`) → logger.info(`Binding to http://...`)
// console.warn in PermissionGate → use logger.warn(...)
```

**Step 3: Verify**

```bash
(cd apps/server && bun run typecheck)
```

**Expected:** Typecheck passes. Log output looks like: `[2026-07-01T23:00:00.000Z][INFO][server] Binding to http://127.0.0.1:4096`

---

## Task 6: Docker Compose One-Command Startup

**Objective:** Add a `docker-compose.yml` that starts the server with a data volume, so a new contributor runs `docker compose up`.

**Files:**
- Create: `docker-compose.yml`

**Step 1: Create docker-compose.yml**

```yaml
# docker-compose.yml
version: "3.9"

services:
  server:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "4096:4096"
    environment:
      - AGENT_WORKBENCH_HOST=0.0.0.0
      - AGENT_WORKBENCH_PORT=4096
    volumes:
      - agent-workbench-data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "bun", "-e", "fetch('http://localhost:4096/health').then(r=>r.ok?process.exit(0):process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3

volumes:
  agent-workbench-data:
```

**Step 2: Verify**

```bash
docker compose config  # validates YAML
```

**Expected:** `docker compose config` outputs parsed compose file without errors.

---

## Task 7: Session Max Duration / Timeout

**Objective:** Auto-abort sessions running longer than a configurable duration (default 10 minutes). Prevents runaway sessions from consuming resources indefinitely.

**Files:**
- Modify: `packages/core/src/session-runner.ts`

**Step 1: Add timeout to executeLoop**

```typescript
// In session-runner.ts, inside run() method:
const SESSION_MAX_DURATION_MS = Number(
  process.env["AGENT_WORKBENCH_SESSION_TIMEOUT_MS"] || 600_000
);

// After creating abortController:
const timeoutId = setTimeout(() => {
  if (!signal.aborted) {
    abortController.abort();
    ledger.recordRunAborted("max_duration_exceeded");
  }
}, SESSION_MAX_DURATION_MS);

// In the finally block, clear the timeout:
clearTimeout(timeoutId);
```

**Step 2: Add to RunOptions**

```typescript
// packages/core/src/types.ts — RunOptions
export interface RunOptions {
  // ... existing ...
  /** Maximum run duration in milliseconds before auto-abort. Default 10 min. */
  maxDurationMs?: number;
}
```

**Step 3: Verify**

```bash
(cd packages/core && bun run typecheck)
bun test
```

**Expected:** Typecheck passes, tests pass.

---

## Task 8: Prometheus-Compatible Metrics Endpoint

**Objective:** Expose a `GET /metrics` endpoint returning Prometheus-format counters for request rate, active sessions, tool calls, errors.

**Files:**
- Create: `apps/server/src/utils/metrics.ts`
- Create: `apps/server/src/middleware/metrics-middleware.ts`
- Modify: `apps/server/src/app.ts` (register route)
- Modify: `apps/server/src/routes/global.ts` (add GET /metrics)

**Step 1: Create metrics collector**

```typescript
// apps/server/src/utils/metrics.ts

interface Metric {
  name: string;
  help: string;
  type: "counter" | "gauge";
  value: number;
  labels?: Record<string, string>;
}

class MetricsRegistry {
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private counterLabels = new Map<string, Map<string, number>>(); // name -> labels -> value

  inc(name: string, labels?: Record<string, string>): void {
    if (labels) {
      const labelKey = JSON.stringify(labels);
      const byLabels = this.counterLabels.get(name) || new Map();
      byLabels.set(labelKey, (byLabels.get(labelKey) || 0) + 1);
      this.counterLabels.set(name, byLabels);
    } else {
      this.counters.set(name, (this.counters.get(name) || 0) + 1);
    }
  }

  set(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  toPrometheus(): string {
    const lines: string[] = [];
    for (const [name, value] of this.counters) {
      lines.push(`# HELP ${name} Counter`);
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${name} ${value}`);
    }
    for (const [name, byLabels] of this.counterLabels) {
      lines.push(`# HELP ${name} Counter (with labels)`);
      lines.push(`# TYPE ${name} counter`);
      for (const [labelJson, value] of byLabels) {
        const labels = JSON.parse(labelJson) as Record<string, string>;
        const labelStr = Object.entries(labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(",");
        lines.push(`${name}{${labelStr}} ${value}`);
      }
    }
    for (const [name, value] of this.gauges) {
      lines.push(`# HELP ${name} Gauge`);
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name} ${value}`);
    }
    return lines.join("\n") + "\n";
  }
}

export const metrics = new MetricsRegistry();
```

**Step 2: Add middleware to track requests**

```typescript
// apps/server/src/middleware/metrics-middleware.ts
import { metrics } from "../utils/metrics";
import type { Context } from "hono";
import type { ServerAppBindings } from "../context";

export async function metricsMiddleware(
  ctx: Context<ServerAppBindings>,
  next: () => Promise<void>
): Promise<void> {
  const start = Date.now();
  try {
    await next();
  } finally {
    metrics.inc("http_requests_total", {
      method: ctx.req.method,
      path: ctx.req.routePath || ctx.req.path,
      status: String(ctx.res.status),
    });
    metrics.inc("http_request_duration_ms", {
      method: ctx.req.method,
    });
  }
}
```

**Step 3: Register in app.ts**

```typescript
// apps/server/src/app.ts
import { metricsMiddleware } from "./middleware/metrics-middleware";

app.use("*", metricsMiddleware);
```

**Step 4: Add GET /metrics route**

```typescript
// apps/server/src/routes/global.ts
app.get("/metrics", (ctx) => {
  ctx.header("Content-Type", "text/plain; version=0.0.4");
  return ctx.text(metrics.toPrometheus());
});
```

**Step 5: Verify**

```bash
(cd apps/server && bun run typecheck)
bun test
```

**Expected:** Typecheck passes, tests pass. Visiting `/metrics` returns Prometheus format.

---

## Execution Order

Tasks are ordered by dependency and risk:

| Order | Task | Risk | Time |
|-------|------|------|------|
| 1 | Session list pagination | 🟢 Low | 20 min |
| 2 | Permission decision persistence | 🟢 Low | 10 min |
| 3 | Message pagination in context builder | 🟡 Medium | 20 min |
| 4 | FileBrowser path re-validation | 🟡 Medium | 15 min |
| 5 | Structured logging | 🟢 Low | 20 min |
| 6 | Docker Compose | 🟢 Low | 10 min |
| 7 | Session max duration timeout | 🟢 Low | 15 min |
| 8 | Prometheus metrics | 🟢 Low | 25 min |

**Total estimate:** ~2.5 hours

---

## Verification Suite

After all tasks are complete, run:

```bash
cd ~/workspace/agent-workbench

# Full typecheck
for pkg in $(ls packages/); do (cd packages/$pkg && bun run typecheck) || exit 1; done
for app in server tui cli mobile-web; do (cd apps/$app && bun run typecheck) || exit 1; done

# Health checks
bash scripts/test-health.sh

# Full test suite
bun test

# E2E tests
bun run test:e2e

# Build
bash scripts/build-all.sh

# Docker validation
docker compose config
```

**Expected:** All typechecks pass, all 5 health checks pass, 357+ tests pass, 54+ e2e pass, build succeeds, compose config valid.
