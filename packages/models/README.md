# 🤖 @agent-workbench/models

[![Status](https://img.shields.io/badge/status-complete-brightgreen)]()
[![Phase](https://img.shields.io/badge/Phase-15..16-blue)]()

Model provider adapters, model router, stream normalization, and usage metadata.

## Status

**Complete** — Phases 15–16. OpenAI-compatible provider, stub provider for testing, provider registry, config parsing, secret redaction.

## Purpose

Provides the model provider abstraction layer. Defines the `ModelProvider` interface, implements an OpenAI-compatible adapter, manages provider registration, and redacts sensitive information from provider interactions.

## Key Modules

| Module | Export | Responsibility |
|--------|--------|---------------|
| `types` | `ModelProvider`, `ModelRequest`, `ModelResponse`, `ModelStreamChunk`, `ModelMessage`, `ModelToolCall`, `ModelToolSpec`, `ModelUsage`, `ModelResponseKind` | Core provider-neutral types |
| `stub-provider` | `StubModelProvider` | Deterministic provider for offline testing |
| `openai-compatible` | `OpenAICompatibleProvider` | Real OpenAI-compatible API adapter with streaming |
| `provider-registry` | `ProviderRegistry` | Registration, lookup, and lifecycle of providers |
| `provider-config` | `parseProviderConfig` | Environment variable configuration parsing |
| `errors` | `ProviderConfigError`, `ProviderAuthError`, `ProviderRateLimitError`, `ProviderServerError`, `ProviderResponseError` | Typed provider errors |
| `redact` | `redactApiKey`, `redactAuthorizationHeader`, `redactString`, `redactHeaders`, `redactError` | Secret redaction utilities |

## Configuration

Environment variables:

| Variable | Purpose | Default |
|----------|---------|---------|
| `AGENT_WORKBENCH_PROVIDER` | Provider ID (e.g. "openai") | — |
| `OPENAI_API_KEY` | API key for the provider | — |
| `AGENT_WORKBENCH_MODEL` | Model name | `gpt-4o` |
| `OPENAI_BASE_URL` | Custom base URL | `https://api.openai.com/v1` |

## Usage

```typescript
import {
  OpenAICompatibleProvider,
  ProviderRegistry,
  StubModelProvider,
  parseProviderConfig,
} from "@agent-workbench/models";
import type { ModelResponse } from "@agent-workbench/models";

// Offline testing
const stub = new StubModelProvider();
const response: ModelResponse = await stub.complete({
  messages: [{ role: "user", content: "Hello" }],
});

// Real provider
const config = parseProviderConfig(process.env);
const registry = new ProviderRegistry();
registry.register("stub", stub);
if (config) {
  const provider = new OpenAICompatibleProvider(config);
  registry.register("openai", provider);
}
```

## Commands

```bash
bun run typecheck
bun run build
```

## Boundary

Does **not** own: runtime orchestration, tool definitions, storage, permission policy, TUI rendering.

👉 See [`docs/23_PHASE_15_PROVIDER_INTEGRATION.md`](../docs/23_PHASE_15_PROVIDER_INTEGRATION.md), [`docs/24_PHASE_16_STREAMING_RESPONSES.md`](../docs/24_PHASE_16_STREAMING_RESPONSES.md)
