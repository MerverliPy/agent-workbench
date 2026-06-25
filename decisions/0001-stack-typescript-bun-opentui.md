# 0001 — Stack: TypeScript + Bun + OpenTUI

Status: Accepted  
Phase: Phase 0 — Planning Docs  
Decision type: Architecture Decision Record

## Context

The project is a local-first OpenCode-style agent TUI workbench. It needs a terminal UI, local server, typed SDK, schema-first API, core runtime, tools, permissions, storage, and token-health systems.

The user selected a modern OpenCode-style architecture rather than the older Go/Bubble Tea lineage.

## Decision

Use the following primary stack:

```text
TypeScript
Bun
OpenTUI
SolidJS
Hono
Zod + OpenAPI
SQLite + Drizzle
Server-Sent Events
Typed TypeScript SDK
```

## Rationale

This stack keeps the TUI, server, protocol, SDK, runtime, tools, and model integration in one TypeScript-oriented ecosystem. It reduces schema duplication and supports coding-agent implementation across a cohesive monorepo.

## Consequences

### Positive

```text
[+] Shared types across layers.
[+] Schema-first API can drive SDK and validation.
[+] OpenTUI + SolidJS fits terminal UI component architecture.
[+] Bun supports TypeScript-first local tooling.
[+] Hono is lightweight for a local HTTP/SSE control plane.
[+] SQLite + Drizzle fits local-first persistence.
```

### Negative / Tradeoffs

```text
[-] Requires current API verification for OpenTUI, Bun, Hono, Drizzle, and SDK tooling.
[-] Less suitable if the project later prioritizes a small static Go binary.
[-] Native terminal behavior may require lower-level work or later PTY/native helpers.
```

## Implementation Rules

```text
[ ] Use TypeScript as the primary language.
[ ] Use Bun as the primary runtime/tooling target.
[ ] Use OpenTUI + SolidJS for the terminal UI.
[ ] Use Hono for the local server.
[ ] Use Zod as the schema source of truth.
[ ] Use SQLite + Drizzle for local persistence.
[ ] Do not replace the primary stack without explicit confirmation.
```

## Boundaries

The stack decision does not define exact dependency versions, final provider list, exact OpenTUI APIs, or exact SDK generation tooling. Those remain unresolved until implementation.

## Risks

```text
[ ] Dependency APIs may change before implementation.
[ ] Exact Bun/SQLite driver compatibility must be verified.
[ ] OpenTUI/Solid integration details must be verified.
```

## Validation Checklist

```text
[ ] Future docs reference this stack consistently.
[ ] No Go/Bubble Tea primary architecture is introduced.
[ ] No route-first API approach replaces Zod-first design.
```

## Notes for Future Agents

Do not re-open the primary stack decision unless the user explicitly asks for a stack reassessment.
