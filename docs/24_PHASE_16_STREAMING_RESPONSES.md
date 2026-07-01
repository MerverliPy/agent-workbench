# 24 — Phase 16 Streaming Provider Responses

Status: Draft — not yet accepted
Document type: implementation plan
Scope: streaming model responses from provider through protocol/SDK/server to TUI

## 1. Summary

Phase 15 added a non-streaming OpenAI-compatible provider. Phase 16 adds `stream()` to the `ModelProvider` interface, implements streaming in `OpenAICompatibleProvider`, routes streaming deltas through `ModelRouter` → `SessionRunner` → server SSE → SDK → TUI, and adds a streaming `StubModelProvider` for offline testing.

This phase does **not** add streaming to Anthropic, Google, or any other provider. It does **not** change the tool-call path — tool-call responses remain non-streaming. It does **not** add provider-specific TUI features beyond incremental text rendering.

## 2. Design

### 2.1 Provider Layer — `ModelProvider.stream()`

Add an optional `stream()` method to the `ModelProvider` interface:

```typescript
export interface ModelStreamChunk {
  /** Incremental text delta (empty for non-text chunks). */
  content: string;
  /** Final usage metadata — present only on the terminal chunk. */
  usage?: ModelUsage;
  /** True when this is the last chunk. */
  done: boolean;
  /** Final stop reason — present only on the terminal chunk. */
  stopReason?: string;
}

export interface ModelProvider {
  call(request: ModelRequest): Promise<ModelResponse>;
  stream(request: ModelRequest): AsyncIterable<ModelStreamChunk>;
}
```

`stream()` is optional at the interface level — consumers check with `"stream" in provider` before calling. The default implementation in a base class throws `ProviderConfigError("Streaming not supported by this provider")`.

### 2.2 OpenAI-Compatible Provider

`OpenAICompatibleProvider.stream()` sends a POST to `/chat/completions` with `stream: true` and parses the SSE response:

- Each `data: {"choices":[{"delta":{"content":"..."}}]}` → one `ModelStreamChunk`.
- The `data: [DONE]` signal → terminal chunk with `done: true`.
- Tool-call deltas are accumulated but not emitted until the terminal chunk — tool calls remain non-streaming in the interface.

### 2.3 Stub Provider

`StubModelProvider.stream()` emits the configured `textResponse` character-by-character (or word-by-word) with a small delay, producing realistic-looking stream chunks for offline testing.

### 2.4 Core — ModelRouter

Add a `routeStream()` method parallel to `route()`:

```typescript
class ModelRouter {
  async *routeStream(
    messages: ContextMessage[],
    tools?: ToolDefinition[],
    signal?: AbortSignal,
    maxTokens?: number
  ): AsyncIterable<ModelStreamChunk> { ... }
}
```

### 2.5 Core — SessionRunner

When a streaming-capable provider is configured, `SessionRunner` uses `routeStream()` instead of `route()`:

- Emits `model.stream_delta` events via `EventPublisher` for each chunk.
- Collects chunks into a buffer for the final assistant message.
- On the terminal chunk, persists the complete message and emits `model.stream_complete`.
- Falls back to `route()` when the provider does not support streaming.

### 2.6 Protocol Events

Add streaming-specific event types:

```typescript
// Emitted for each content delta during streaming
export type ModelStreamDeltaEvent = {
  type: "model.stream_delta";
  runId: string;
  delta: string;
};

// Emitted when streaming finishes
export type ModelStreamCompleteEvent = {
  type: "model.stream_complete";
  runId: string;
  content: string;
  usage?: ModelUsage;
  stopReason?: string;
};

// Emitted when streaming is aborted or fails
export type ModelStreamErrorEvent = {
  type: "model.stream_error";
  runId: string;
  message: string;
};
```

### 2.7 SDK

`SseTransport` already handles typed event dispatch. The SDK's `EventsResource` gains convenience methods:

```typescript
class EventsResource {
  onStreamDelta(callback: (event: ModelStreamDeltaEvent) => void): void;
  onStreamComplete(callback: (event: ModelStreamCompleteEvent) => void): void;
}
```

### 2.8 TUI

The message timeline component already renders assistant messages. When the renderer receives `model.stream_delta` events, it appends the delta to the current in-progress message's text content without waiting for completion. The message component shows a subtle streaming indicator (e.g. blinking cursor or pulsing dot) while `runId` has an active stream.

The TUI must continue to **not** execute tools, decide policy, or access storage directly — streaming rendering is strictly a presentation concern.

## 3. Provider Route Changes

### GET /provider/:providerId/model

Add `streaming: boolean` to each model entry so the TUI can indicate which provider/models support streaming.

## 4. Impact Analysis

### Packages Changed

| Package | Scope |
|---------|-------|
| `packages/models` | Add `ModelStreamChunk` type, `stream()` to interface, impl in OpenAI and stub providers |
| `packages/core` | Add `routeStream()` to ModelRouter, streaming path in SessionRunner, stream event emission |
| `packages/protocol` | Add stream event schemas to event types |
| `packages/sdk` | Add stream event convenience methods to EventsResource |
| `packages/events` | No changes (events already flow through existing Bus/Publisher) |
| `apps/server` | No route changes needed (stream events flow through existing SSE event route) |
| `apps/tui` | Incremental text rendering for in-progress assistant messages |
| `tests` | Add streaming unit/integration tests with mock streaming provider |

### Packages Unchanged

`packages/permissions`, `packages/shell`, `packages/storage`, `packages/diff`, `packages/tokens`, `packages/cache`, `packages/planner`, `packages/tools`, `packages/config`, `packages/ui`, `apps/cli`.

## 5. Implementation Order

1. Add `ModelStreamChunk` type to `packages/models/src/types.ts`.
2. Add `stream()` to `ModelProvider` interface with default error-throw.
3. Implement `StubModelProvider.stream()` for test use.
4. Implement `OpenAICompatibleProvider.stream()` — SSE parsing, delta accumulation, error handling.
5. Add `routeStream()` to `ModelRouter`.
6. Add streaming event schemas to `packages/protocol`.
7. Wire streaming path in `SessionRunner` — event emission, buffer accumulation, fallback.
8. Add `onStreamDelta`/`onStreamComplete` to SDK `EventsResource`.
9. Update TUI message rendering for incremental text.
10. Add `streaming` flag to provider model metadata.
11. Write tests: stub streaming, OpenAI streaming (mock fetch), streaming event round-trip, streaming in session runner, TUI incremental render.
12. Update README.md, docs/04, docs/18 exit gate.

## 6. Non-Goals (Deferred)

- Streaming for Anthropic/Google/other providers — Phase 16 is OpenAI-compatible only.
- Streaming for tool calls — tool-call responses remain non-streaming.
- Streaming abort via TUI (user cancels mid-stream) — defer to PTY/abort phase or explicit Phase 16 extension.
- Provider-specific streaming UI (token-by-token speed, model name badges) — `content` only.
- Streaming token counting / real-time budget updates — token health is Phase 12 (complete), but real-time budget during streaming is deferred.
- Persistent storage of stream deltas — only the final complete message is stored.
- Streaming for `delegate_task` or subagent responses.
- Token-by-token latency optimization.

## 7. Safety & Boundaries

- Streaming must not bypass permission gates — tool-call responses are always non-streaming and go through the existing permission path.
- Streaming must not access storage or execute tools directly from the SSE response stream.
- The TUI must never execute tools, decide policy, or access storage — streaming rendering is strictly a presentation concern.
- Stream error events must not expose API keys, Bearer tokens, or internal paths (same redaction rules as Phase 15).
- Abort signals flow through the streaming path — cancelling a run mid-stream must clean up the SSE connection.

## 8. Open Questions

- `Unknown` — How should `maxTokens` interact with streaming? Provider-side `max_tokens` still limits total output; stream just delivers it incrementally. Likely no interface change needed.
- `Provisional` — Should streaming be the default path for all providers that support it, with non-streaming as fallback? Yes — propose `routeStream()` as primary, fall back to `route()`.
- `Provisional` — Stream chunk size: word-level or character-level? The OpenAI SSE delta is typically word-level. Propose pass-through: whatever the provider sends.
- `Unresolved` — Should the `ModelResponse` interface gain a `fromStream(chunks)` static factory? Defer — buffer accumulation and normalized response construction can live in `SessionRunner` for now.

## 9. Verification

```text
bun test                                    # all existing tests still pass
bash scripts/test-health.sh                 # all static checks pass
bun run typecheck                           # in changed packages
bun test tests/unit/models/*stream*         # streaming unit tests
bun test tests/integration/*stream*         # streaming integration tests
bun test tests/e2e/*stream*                 # streaming e2e tests
```
