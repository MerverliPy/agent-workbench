# Architecture & Design Integrity Audit Report

**Date:** 2026-07-03  
**Auditor:** Hermes Agent  
**Repository:** agent-workbench (GitHub: MerverliPy/agent-workbench)  
**Scope:** Actual code vs. declared architecture, protocol adherence, package boundary enforcement

---

## Executive Summary

The repository is **well-structured with strong protocol adherence**. The most significant finding is a **HIGH severity boundary violation**: the TUI depends on and imports from `@agent-workbench/eval`, which is not an allowed dependency per AGENTS.md. Additionally, **AGENTS.md and architecture docs are stale** — they list only 3 apps / 15 packages, but the actual codebase has 5 apps / 20 packages. The protocol-route-contract pattern is correctly implemented end-to-end (protocol → SDK → server → validation → OpenAPI).

---

## 1. Workspace Configuration

### Finding: ✅ Workspaces match directory structure

**Root `package.json`** declares workspaces as:
```json
["apps/*", "packages/*", "tests"]
```

This correctly matches the actual directory layout:
- **apps/**: cli, dashboard, mobile-web, server, tui (5 apps, all with `package.json`)
- **packages/**: auth, cache, collab, config, core, diff, eval, events, models, permissions, planner, plugin-sdk, protocol, sdk, shell, storage, telemetry, tokens, tools, ui (20 packages, all with `package.json`)
- **tests/**: single `package.json` at root

**All package names** follow the `@agent-workbench/<name>` convention consistently.

---

## 2. Package Boundary Compliance

### DECLARED BOUNDARIES (from AGENTS.md)

| Package | Allowed to Import | Must NOT Import |
|---------|-------------------|-----------------|
| apps/tui | sdk, protocol, events, ui | core, tools, shell, storage, permissions/internal, models/internal |

### FINDING: HIGH — TUI imports `@agent-workbench/eval` (violation)

**Evidence:**
- **`apps/tui/package.json`** line 13: `"@agent-workbench/eval": "workspace:*"`
- **`apps/tui/src/components/panels/PlaygroundPanel.tsx`** line 1: `import { ModelPlayground } from "@agent-workbench/eval"`
- **`apps/tui/src/components/panels/ComparisonPanel.tsx`** line 1: `import { ModelComparer } from "@agent-workbench/eval"`

**Why it's a violation:** AGENTS.md explicitly states TUI may import "packages/sdk, packages/protocol, packages/events, and packages/ui". The `@agent-workbench/eval` package is not in that list. The eval package has storage dependencies (Drizzle ORM, SQLite) and should not be consumed by the thin TUI client.

**Recommendation:** Either (a) add `@agent-workbench/eval` to the allowed-imports list in AGENTS.md, or (b) refactor the TUI eval panels to communicate through the SDK/server (like every other feature does).

### FINDING: MEDIUM — TUI does not import `@agent-workbench/events` or `@agent-workbench/ui`

**Evidence:**
- `apps/tui/package.json` has no `@agent-workbench/events` dependency — it consumes events through the SDK's SSE transport via `@agent-workbench/sdk`
- `apps/tui/package.json` has no `@agent-workbench/ui` dependency — the ui package exports are used nowhere

**Analysis:** This is not a violation but means the declared allowances are aspirational rather than enforced. The TUI correctly gets events via SDK's SseTransport (which validates with `EventEnvelope.safeParse`), not by importing the events package directly. The `@agent-workbench/ui` package is essentially unused — it has no dependencies and no exports (`exports` field absent from its package.json).

**Recommendation:** Remove `@agent-workbench/ui` from AGENTS.md allowed-imports list, or implement shared UI primitives in it.

### FINDING: MEDIUM — AGENTS.md is incomplete

**Packages that exist but are NOT documented in AGENTS.md boundaries:**

| Package | Purpose | AGENTS.md coverage |
|---------|---------|-------------------|
| apps/cli | CLI entrypoint with plugin loading | Not mentioned |
| apps/dashboard | Observability dashboard (Vite + Solid) | Not mentioned |
| apps/mobile-web | Mobile web companion (Vite + Solid + PWA) | Not mentioned |
| packages/auth | Bearer token auth, TLS, session tokens | Not mentioned |
| packages/collab | Session sharing, review queue, presence | Not mentioned |
| packages/eval | Model evaluation & playground | Not mentioned |
| packages/telemetry | OpenTelemetry, Prometheus metrics | Not mentioned |
| packages/plugin-sdk | Plugin extension interfaces | Not mentioned |
| packages/config | Layered config loading | Not mentioned |

These have been added through later phases (22-29) but AGENTS.md hasn't been updated to reflect the current package inventory.

### FINDING: ✅ No TUI imports runtime authority packages

Confirmed Zero violations across TUI source for importing:
- `from "@agent-workbench/core"` → 0 matches
- `from "@agent-workbench/tools"` → 0 matches
- `from "@agent-workbench/shell"` → 0 matches
- `from "@agent-workbench/storage"` → 0 matches
- `from "@agent-workbench/permissions"` → 0 matches
- `from "@agent-workbench/models"` → 0 matches

The same is true for apps/dashboard and apps/mobile-web.

### FINDING: ✅ Server dependencies are appropriate

`apps/server` depends on: cache, core, events, models, permissions, protocol, shell, storage, tokens, tools, telemetry, plugin-sdk, auth, collab, hono, ulid, zod. All are legitimate server concerns.

---

## 3. Protocol Adherence (Zod Schemas)

### FINDING: ✅ Route contracts follow the declared pattern

**`packages/protocol/src/types.ts`** defines the `RouteContract` interface with:
```typescript
interface RouteContract {
  readonly method: "GET" | "POST" | "PATCH" | "DELETE";
  readonly path: string;
  readonly pathParams?: z.ZodType;
  readonly query?: z.ZodType;
  readonly body?: z.ZodType;
  readonly response: z.ZodType;
  readonly errors: readonly [typeof ErrorEnvelope];
  readonly isStream?: boolean;
}
```

**Every route** in `packages/protocol/src/routes/` follows this pattern. Examples verified:
- `session.ts` — CreateSessionRoute, ListSessionsRoute, GetSessionRoute, UpdateSessionRoute, AbortSessionRoute, SummarizeSessionRoute, DeleteSessionRoute
- `message.ts` — SubmitMessageRoute, ListMessagesRoute, GetMessageRoute
- `plan.ts` — ListPlansRoute, GetPlanRoute, DecidePlanRoute
- `event.ts` — EventRoute (with isStream: true)

### FINDING: ✅ Route contracts properly distinguish pathParams, query, body, response, errors

Every route correctly specifies its shape. `SessionIdParams` is reused across routes. Errors always include `ErrorEnvelope`.

### FINDING: ✅ OpenAPI is generated from route contracts

**`packages/protocol/src/openapi/index.ts`** implements `createOpenApiDocument()` which:
- Creates an `OpenAPIRegistry`
- Registers all route contracts from the routes directory
- Uses `@asteasolutions/zod-to-openapi` to generate OpenAPI 3.0.3 documents
- Preserves path params (`:param` → `{param}`), query params, request bodies, error responses, and SSE media types (`text/event-stream`)

17 route contracts are registered for OpenAPI generation.

---

## 4. SDK → Protocol Contract Consumption

### FINDING: ✅ SDK consumes protocol contracts, does not duplicate DTOs

**`packages/sdk/src/resources/sessions.ts`** demonstrates the pattern:
```typescript
import { AbortSessionRoute, CreateSessionRoute, ... } from "@agent-workbench/protocol";

async create(data: z.infer<typeof CreateSessionRoute.body>): Promise<InferRouteResponse<typeof CreateSessionRoute>> {
  return this.transport.request(CreateSessionRoute.method, CreateSessionRoute.path, {
    body: data, responseSchema: CreateSessionRoute.response,
  });
}
```

Every SDK resource (sessions, messages, permissions, plans, tools, agents, files, config, providers, auth, token-health, tui) follows this pattern.

### FINDING: ✅ SDK validates responses, not casts

**`packages/sdk/src/transport/http.ts`** lines 88-101:
```typescript
if (options?.responseSchema) {
  const result = options.responseSchema.safeParse(parsed);
  if (!result.success) {
    throw new SdkError(`Response validation failed: ${issues}`, result.error);
  }
  return result.data as T;
}
```

Responses are validated with `safeParse` and throw on mismatch — no blind casts.

### FINDING: ✅ SSE parsing validates event envelopes

**`packages/sdk/src/transport/sse.ts`** lines 122-134:
```typescript
const result = EventEnvelope.safeParse({ ...raw, type: raw.type ?? type });
if (!result.success) {
  this.errorHandler?.(new SdkError(`Malformed SSE event: ${issues}`));
  return;
}
```

Event envelopes are validated. Malformed events are reported via error handler, not silently swallowed.

### FINDING: ✅ SDK error handling uses ErrorEnvelope schema

**`packages/sdk/src/transport/http.ts`** lines 117-118:
```typescript
const parsed = ErrorEnvelope.safeParse(body);
if (parsed.success) { ... }
```

HTTP error responses are parsed through the ErrorEnvelope Zod schema.

---

## 5. Server Implementation

### FINDING: ✅ Server uses Hono correctly

**`apps/server/src/app.ts`** creates a `new Hono<ServerAppBindings>()` and applies middleware chain:
- `requestIdMiddleware` (first)
- `rateLimitMiddleware`
- `metricsMiddleware`
- `tracingMiddleware`
- CORS with localhost defaults (ADR-0004)
- `authMiddleware` (conditional, Phase 27)

### FINDING: ✅ Server routes consume protocol contracts

**`apps/server/src/routes/helpers.ts`**:
```typescript
export function createJsonRouteHandler<T>(
  contract: RouteContract,
  handler: (context, routeContext) => T
): Handler {
  return async (context) => {
    const validated = await validateRequest(contract, context.req);
    const result = await handler(context, { validated });
    const response = validateResponse(contract, result);
    return context.json(response);
  };
}
```

**`apps/server/src/utils/validation.ts`** validates path params, query params, and body through the contract's Zod schemas. Response validation ensures handlers produce valid output.

**All route handlers** (session-routes.ts, message-routes.ts, permission-routes.ts, plan-routes.ts, etc.) use `createJsonRouteHandler` with protocol contracts — no manual validation.

### FINDING: ✅ SSE event routing is correct

**`apps/server/src/routes/global.ts`** handles the EventRoute path:
- Validates request with `validateRequest(EventRoute, context.req)`
- Uses `hono/streaming`'s `streamSSE` for the SSE connection
- Subscribes to `EventBus` and writes JSON-serialized events as SSE data lines
- Includes keep-alive (30s interval) and retry directive

---

## 6. Decisions Implementation

### FINDING: ✅ Decision 0013 (Pre-Run Planner) is implemented

**The pre-run planner gate exists and is operational:**

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Plan object exists | ✅ | `packages/planner/src/validate.ts` + `packages/protocol/src/schemas/plan.ts` |
| Mutation gate exists | ✅ | `packages/core/src/plan-gate.ts` — `PlanGate` class with `gate()` method |
| Unsafe plans can be rejected | ✅ | `validatePlan()` rejects empty/invalid plans; `PermissionEngine.evaluatePlan()` blocks denied plans |
| Plan events are ledgered | ✅ | `RunLedger` records plan proposed/denied/approved/completed |
| Mutation does not bypass plan gate | ✅ | `SessionRunner` calls `planGate.gate()` before mutation tool dispatch |

**PlanGate flow:** Build plan → validate → permission evaluation → if "ask": persist + emit → wait for user decision via PermissionGate → proceed or block.

### FINDING: ✅ Decision 0015 (Dry-Run) is partially implemented

| Requirement | Status | Evidence |
|-------------|--------|----------|
| File dry-run exists | ✅ | diff previews generated before permission gates in SessionRunner (lines with `generateDiffPreview`) |
| Shell preview exists | ✅ | `packages/shell` exports `previewCommand()`, `CommandPreview` |
| Dry-run separate from execution | ✅ | Diff is preview-only, shell preview is static |
| Permission flow uses dry-run metadata | ✅ | Diff summary included in PermissionRequest payload |
| Ledger records dry-run events | ✅ | Ledger records diff.preview_created events |

**Note:** True sandbox dry-run (non-mutating execution simulation) is not implemented — this is by design per decision 0015's notes.

---

## 7. Architecture Documentation vs. Reality

### FINDING: MEDIUM — docs/02_ARCHITECTURE.md is stale

The architecture doc lists this package model:
```
apps/ → cli, server, tui    (3 apps)
packages/ → protocol, sdk, core, events, storage, config, permissions, tools, models, shell, diff, tokens, cache, planner, ui   (15 packages)
```

Actual:
```
apps/ → cli, dashboard, mobile-web, server, tui   (5 apps)
packages/ → auth, cache, collab, config, core, diff, eval, events, models, permissions, planner, plugin-sdk, protocol, sdk, shell, storage, telemetry, tokens, tools, ui   (20 packages)
```

Missing from architecture doc: dashboard, mobile-web, auth, collab, eval, plugin-sdk, telemetry (+ config exists in doc but is a stub with no source files).

The **architecture diagram** in docs/02_ARCHITECTURE.md also doesn't show the dashboard, mobile-web, auth, collab, telemetry, or plugin-sdk.

### FINDING: ✅ DESIGN.md is consistent with implemented web UI

The DESIGN.md document describes a dark-first design system for mobile-web/dashboard companions:
- Color tokens (slate/navy palette, single blue accent)
- Typography, spacing, border radii
- Component definitions (buttons, cards, inputs, badges, messages, tabs, nav drawer, model chip, code blocks)
- Accessibility contract (ARIA, focus-visible, reduced-motion, touch targets, WCAG AA contrast)
- Anti-patterns (no gradients, no box-shadows, no LLM purple)

This matches the actual styling in apps/mobile-web (Tailwind CSS with similar tokens, PWA manifest, notifications, offline support).

---

## 8. Core Runtime Structure

### FINDING: ✅ Clean internal architecture

**`packages/core/src/`** files:
- `session-runner.ts` — Main orchestration loop (model/tool loop, permission gating, streaming)
- `plan-gate.ts` — Pre-mutation planning gate
- `model-router.ts` — Model provider routing
- `tool-dispatcher.ts` — Tool call dispatching
- `context-builder.ts` — Context building for model prompts
- `event-publisher.ts` — Event emission wrapper
- `run-ledger.ts` — Ledger recording wrapper
- `run-state.ts` — Active run registry
- `token-health.ts` — Token health service
- `pty-orchestrator.ts` — PTY orchestration
- `agent/` — Agent definitions, registry, types
- `types.ts` — CoreDependencies interface (DI container pattern)

The `CoreDependencies` interface cleanly separates concerns — it accepts repository/service interfaces from storage, events, tools, models, permissions, shell — no direct imports of implementation internals.

### FINDING: ✅ Planner is lightweight and focused

**`packages/planner/src/`** has only 2 files:
- `index.ts` — Public exports (validatePlan, computePlanRiskLevel, etc.)
- `validate.ts` — Plan validation logic (98 lines)

No overcomplicated DAG system. Lightweight validation per ADR-0013.

### FINDING: ✅ Permission engine is clean and deterministic

**`packages/permissions/src/`** has 5 files:
- `engine.ts` — Stateless `PermissionEngine` with 5-step evaluation (command → agent → path → tool → fallback)
- `gate.ts` — Stateful `PermissionGate` for async pause/resume of ask-gated operations
- `policy.ts` — Default policy definitions
- `types.ts` — Type definitions
- `index.ts` — Public exports

The engine correctly never executes tools, accesses storage, renders UI, makes HTTP requests, or trusts model-generated risk assessments (all annotated in code comments).

---

## 9. Summary of Findings

### CRITICAL / HIGH

| # | Severity | Finding | Location | Recommendation |
|---|----------|---------|----------|---------------|
| 1 | **HIGH** | TUI imports `@agent-workbench/eval` violating declared boundaries | `apps/tui/package.json`, `PlaygroundPanel.tsx`, `ComparisonPanel.tsx` | Either update AGENTS.md to allow eval, or refactor eval panels through SDK/server |

### MEDIUM

| # | Severity | Finding | Location | Recommendation |
|---|----------|---------|----------|---------------|
| 2 | **MEDIUM** | AGENTS.md missing 5 apps + 5 packages from boundary documentation | `AGENTS.md` | Update to list all 5 apps and 20 packages with their boundaries |
| 3 | **MEDIUM** | `docs/02_ARCHITECTURE.md` stale — missing dashboard, mobile-web, auth, collab, eval, plugin-sdk, telemetry | `docs/02_ARCHITECTURE.md` | Regenerate architecture doc to match actual codebase |
| 4 | **MEDIUM** | `@agent-workbench/ui` is declared in AGENTS.md but has zero deps, zero exports, zero consumers | `packages/ui/`, `AGENTS.md` | Either implement shared UI primitives or remove from documentation |
| 5 | **MEDIUM** | TUI doesn't directly use `@agent-workbench/events` despite AGENTS.md allowance | `apps/tui/package.json` | Minor — events consumed through SDK is correct |

### LOW / OBSERVATIONS

| # | Severity | Finding | Location | Recommendation |
|---|----------|---------|----------|---------------|
| 6 | **LOW** | `packages/config` has no source files (empty shell) | `packages/config/` | Either implement or remove workspace entry |
| 7 | **LOW** | `packages/tokens` has zero dependencies (no protocol import, no storage) | `packages/tokens/package.json` | Verify this is intentional |
| 8 | **LOW** | `plugin-sdk` uses `zod: ^4.0.0` while all other packages use `^4.4.3` | `packages/plugin-sdk/package.json` | Normalize zod version |
| 9 | **LOW** | Server route for `/global/event` manually validates without `createJsonRouteHandler` | `apps/server/src/routes/global.ts` line 80-81 | Minor — deliberate choice for SSE handler |

### POSITIVE FINDINGS (Strengths)

| # | Finding | Evidence |
|---|---------|----------|
| ✅ | Protocol contracts are the single source of truth | Route contracts defined in protocol, consumed by SDK + Server + OpenAPI |
| ✅ | SDK validates responses (no blind casts) | `responseSchema.safeParse()` in HttpTransport |
| ✅ | SSE validates event envelopes | `EventEnvelope.safeParse()` in SseTransport |
| ✅ | OpenAPI generated from schemas | `createOpenApiDocument()` in openapi/index.ts |
| ✅ | No TUI imports from core/tools/shell/storage/permissions/models | grep confirmed zero matches |
| ✅ | Planner is lightweight (no DAG overengineering) | 2 files, 98 lines of validation logic |
| ✅ | Permission engine is stateless + deterministic | Documented design, no side effects |
| ✅ | Decision 0013 (pre-run planner) is fully implemented | PlanGate + validatePlan + permission evaluation |
| ✅ | Decision 0015 (dry-run) is partially implemented | Diff previews, shell previews, permission flow integration |
| ✅ | Server validates all requests through contract schemas | `validateRequest()` in validation.ts |
| ✅ | CoreDependencies uses clean DI pattern | No global storage imports in core |
| ✅ | DESIGN.md is consistent with implemented web UI | Color tokens, components, ARIA match mobile-web/dashboard |

---

## 10. Recommendations (Priority Order)

1. **HIGH** — Fix the TUI→eval boundary violation: either update AGENTS.md to include `@agent-workbench/eval` in TUI's allowed imports, or refactor eval panels to communicate through the SDK
2. **MEDIUM** — Update `AGENTS.md` with complete package inventory and boundaries for all 5 apps and 20 packages
3. **MEDIUM** — Update `docs/02_ARCHITECTURE.md` diagram and package model to match actual codebase
4. **MEDIUM** — Either implement `packages/ui` with shared primitives, or remove from documentation
5. **LOW** — Either implement or remove the empty `packages/config`
6. **LOW** — Normalize zod version in `packages/plugin-sdk`

---

*Report generated by Hermes Agent. 44 source files examined across apps, packages, docs, and decisions.*
