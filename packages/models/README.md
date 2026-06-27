# @agent-workbench/models

Status: Phase 15 complete — Provider integration active
Implementation status: stub provider, OpenAI-compatible provider adapter, provider registry, configuration, redaction

## Purpose

Model provider adapters, model router, stream normalization, and usage metadata.

## Current Modules

- `types.ts` — Provider-neutral ModelProvider, ModelRequest, ModelResponse, ModelMessage, ModelToolCall, etc.
- `stub-provider.ts` — StubModelProvider for deterministic testing
- `errors.ts` — ProviderConfigError, ProviderAuthError, ProviderRateLimitError, ProviderServerError, ProviderResponseError
- `redact.ts` — API key, Bearer token, header, and error redaction utilities
- `provider-config.ts` — Environment variable configuration parsing (AGENT_WORKBENCH_PROVIDER, OPENAI_API_KEY, etc.)
- `providers/openai-compatible.ts` — OpenAICompatibleProvider implementing ModelProvider with injectable fetch
- `provider-registry.ts` — ProviderRegistry for managing registered providers and their metadata

## Configuration

Environment variables:
- `AGENT_WORKBENCH_PROVIDER` — provider id (e.g. "openai")
- `OPENAI_API_KEY` — API key for the provider
- `AGENT_WORKBENCH_MODEL` — model name (default: "gpt-4o")
- `OPENAI_BASE_URL` — custom base URL (default: https://api.openai.com/v1)

## Boundary

Refer to:
- `docs/03_BACKEND_FRONTEND_BOUNDARY.md`
- `docs/18_PHASE_EXIT_GATES.md`
- `docs/19_TARGET_REPO_TREE.md`
- `docs/23_PHASE_15_PROVIDER_INTEGRATION.md`
