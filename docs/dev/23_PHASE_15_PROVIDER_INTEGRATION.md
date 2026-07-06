# 23 — Phase 15 Provider Integration

Status: Complete
Document type: implementation summary
Scope: one OpenAI-compatible provider adapter, config, redaction, routes, and tests

## 1. Summary

Phase 15 adds a minimal OpenAI-compatible provider adapter behind the existing `ModelProvider` interface. Provider configuration is sourced from environment variables only. Provider routes expose metadata without secrets. Default tests remain offline with mock providers.

## 2. Implementation

### packages/models

| File | Purpose |
|---|---|
| `src/errors.ts` | ProviderConfigError, ProviderAuthError, ProviderRateLimitError, ProviderServerError, ProviderResponseError |
| `src/redact.ts` | redactApiKey, redactAuthorizationHeader, redactString, redactHeaders, redactError |
| `src/provider-config.ts` | parseProviderConfig(env?) from AGENT_WORKBENCH_PROVIDER, OPENAI_API_KEY, OPENAI_BASE_URL, AGENT_WORKBENCH_MODEL |
| `src/providers/openai-compatible.ts` | OpenAICompatibleProvider implements ModelProvider. Normalizes OpenAI chat completions to ModelResponse. Supports injectable fetch. |
| `src/provider-registry.ts` | ProviderRegistry — always registers stub provider, optionally registers OpenAI-compatible from env. Provides metadata for routes. |
| `src/index.ts` | Exports all new modules alongside existing types and StubModelProvider |

### apps/server

| File | Purpose |
|---|---|
| `src/routes/provider-routes.ts` | Thin handlers for GET /provider, GET /provider/:providerId, GET /provider/:providerId/model. Uses ProviderRegistry for metadata. |
| `src/routes/placeholders.ts` | Provider routes removed from placeholder list. |
| `src/context.ts` | ProviderRegistry added to ServerServices. |
| `src/app.ts` | registerProviderRoutes() called during app creation. |
| `src/index.ts` | ProviderRegistry created; default provider passed to SessionRunner. |

### packages/protocol

No changes. Existing provider schemas and route contracts (ListProvidersRoute, GetProviderRoute, ListProviderModelsRoute) are sufficient.

### packages/sdk

No changes. ProviderResource already handles all three endpoints.

### packages/core

No changes. SessionRunner continues to accept ModelProvider via CoreDependencies.

## 3. Configuration

Environment variables:

| Variable | Required | Default |
|---|---|---|
| `AGENT_WORKBENCH_PROVIDER` | Yes (for real provider) | — |
| `OPENAI_API_KEY` | Yes (for real provider) | — |
| `AGENT_WORKBENCH_MODEL` | No | `gpt-4o` |
| `OPENAI_BASE_URL` | No | `https://api.openai.com/v1` |

Without `AGENT_WORKBENCH_PROVIDER`, the stub provider is used.

## 4. Provider Routes

### GET /provider

Returns all registered providers with metadata (id, name, status, description). Does not expose secrets.

### GET /provider/:providerId

Returns metadata for a single provider. Returns 404 with ErrorEnvelope for unknown providers.

### GET /provider/:providerId/model

Returns models for a provider. Returns 404 with ErrorEnvelope for unknown providers.

## 5. Error Handling

Provider errors are normalized into typed error classes:

- `ProviderConfigError` — missing/invalid configuration
- `ProviderAuthError` — 401/403 responses
- `ProviderRateLimitError` — 429 responses
- `ProviderServerError` — 5xx responses
- `ProviderResponseError` — malformed responses, network errors

All error messages are redacted: API keys, Bearer tokens, and authorization headers are replaced with `***` or truncated forms.

## 6. Test Coverage

323 tests (was 272), 0 failures, 961 expect calls (was 841).

New test files:
- `tests/unit/models/provider-redaction.test.ts` — 14 tests
- `tests/unit/models/provider-config.test.ts` — 7 tests
- `tests/unit/models/openai-compatible-provider.test.ts` — 21 tests
- `tests/integration/server/provider-routes.test.ts` — 9 tests

All new tests use fake fetch/mock HTTP. No tests require real API keys or network access.

## 7. Non-Goals (Deferred)

- Streaming responses
- Provider-specific TUI features
- Anthropic/local-model adapters
- Persistent secret storage
- Interactive provider setup
- Real provider integration tests in default suite
- Production-readiness claim
