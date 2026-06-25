# 0003 — Schema-First Zod Contract

Status: Accepted  
Phase: Phase 0 — Planning Docs  
Decision type: Architecture Decision Record

## Context

The system needs a typed contract between TUI, SDK, server, core runtime, and future clients. Route-first implementation risks API drift.

## Decision

Use a schema-first API contract with Zod as the source of truth.

## Rationale

Zod schemas provide runtime validation and TypeScript inference. They can support OpenAPI generation and typed SDK behavior while reducing duplicated DTOs.

## Consequences

### Positive

```text
[+] Runtime request validation.
[+] Shared type inference.
[+] OpenAPI generation path.
[+] Reduced API drift.
[+] Better agent implementation guidance.
```

### Negative / Tradeoffs

```text
[-] Requires schema discipline before route implementation.
[-] Some generated SDK tooling choices remain unresolved.
[-] Database schemas must be kept separate from API schemas.
```

## Implementation Rules

```text
[ ] Define protocol schemas before server routes.
[ ] Validate params, query, and body.
[ ] Use structured error envelopes.
[ ] Keep database schema separate from API schema.
[ ] Do not hand-maintain divergent TUI/server DTOs.
```

## Boundaries

`packages/protocol` owns schemas and route contracts. It must not own business logic, storage queries, tool execution, or UI state.

## Risks

```text
[ ] Route handlers may drift if schemas are bypassed.
[ ] Database tables may be mistaken for API DTOs.
[ ] Exact SDK generation method remains unresolved.
```

## Validation Checklist

```text
[ ] Zod schemas exist.
[ ] Error envelope exists.
[ ] Event envelope exists.
[ ] OpenAPI generation path exists.
[ ] SDK uses protocol-derived types.
```

## Notes for Future Agents

If exact fields are unknown, mark them provisional instead of inventing them.
