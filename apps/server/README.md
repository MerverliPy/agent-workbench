# @agent-workbench/server

Status: Phase 3 — Local Server
Implementation status: local HTTP/SSE control plane

## Purpose

Local HTTP/SSE control plane package. Owns routes, middleware, and server lifecycle only.

## Current Scope

- Hono app and server startup.
- Request validation using `@agent-workbench/protocol` route contracts.
- Structured `ErrorEnvelope` responses.
- Localhost-only default binding.
- SSE transport plumbing for later runtime phases.

## Current Boundaries

- Do not import `@agent-workbench/sdk`.
- Do not implement core runtime, storage, tools, permissions, shell, models, diff, cache, planner, or token-health runtime behavior here.
- Consume protocol contracts and schemas instead of hand-writing duplicate DTOs.
- Non-global routes may remain validated placeholders until later phases own their backing behavior.

## Boundary

Refer to:

- `docs/03_BACKEND_FRONTEND_BOUNDARY.md`
- `docs/18_PHASE_EXIT_GATES.md`
- `docs/19_TARGET_REPO_TREE.md`
