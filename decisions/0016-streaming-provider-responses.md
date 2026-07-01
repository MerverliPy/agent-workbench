# 0016 — Streaming Provider Responses

Status: Accepted
Phase: Phase 16 — Streaming Provider Responses
Decision type: Architecture Decision Record

## Context

Phase 15 added a non-streaming OpenAI-compatible provider adapter. The provider
interface (`ModelProvider`) only exposes `call(): Promise<ModelResponse>`, which
blocks until the full response is available. For user-facing agent sessions,
this means the TUI shows nothing until the model finishes — a poor experience
for longer generations.

The project already has SSE infrastructure:
- `SseTransport` in `packages/sdk` — typed event dispatch over SSE.
- `EventRoute` in `packages/protocol` — globally scoped SSE endpoint.
- `EventPublisher` in `packages/core` — runtime event emission.

This existing SSE path carries internal lifecycle events (permission requests,
tool results, ledger entries) but does not carry streaming model output.

## Decision

Add streaming to the model interface and wire it through the existing
event architecture:

```text
Provider (SSE http chunk) → ModelRouter (async iterable)
  → SessionRunner (buffer + emit events)
    → EventPublisher (model.stream_delta / .stream_complete)
      → Server SSE endpoint (existing /global/event)
        → SdkTransport (typed dispatch)
          → TUI (incremental render)
```

### Interface

Add `stream()` to `ModelProvider`:

```typescript
interface ModelProvider {
  call(request: ModelRequest): Promise<ModelResponse>;
  stream(request: ModelRequest): AsyncIterable<ModelStreamChunk>;
}
```

`stream()` is optional — consumers check availability before calling.
Default implementation throws `ProviderConfigError`.

### Protocol

Three new event types (`model.stream_delta`, `model.stream_complete`,
`model.stream_error`) carry incremental content from the core runtime to
the TUI through the existing SSE event route. No new server routes needed.

### Runtime

`SessionRunner` uses streaming as the primary path when the provider supports
it. It emits deltas as they arrive, buffers the complete response, persists
the final message, and falls back to `call()` for non-streaming providers
and for tool-call responses.

## Rationale

1. **Leverage existing infrastructure.** `SseTransport`, `EventPublisher`,
   and the `/global/event` SSE route already exist. Adding streaming events
   uses the same typed event pipeline — no new transport layer.

2. **Minimal interface change.** Adding a single `stream()` method to the
   `ModelProvider` interface is the least-invasive change that enables the
   full path. Tool-call responses remain non-streaming (they're atomic by
   nature).

3. **Fallback compatibility.** Non-streaming providers, the stub provider
   in tests, and existing test mocks that only implement `call()` all
   continue to work without modification.

4. **Streaming is not tool streaming.** Tool-call responses are inherently
   atomic — the model emits the complete set of tool calls at once. Only
   text content benefits from incremental delivery. The design preserves
   this distinction.

5. **No additional server routes.** Events flow through the existing
   `/global/event` SSE route. The server remains a thin control plane.

## Consequences

### Positive

```text
[+] TUI renders model output incrementally instead of waiting for completion.
[+] Reuses existing SSE transport, event bus, and typed event dispatch.
[+] No changes to permission engine, storage, tools, shell, or planner.
[+] Fallback path for non-streaming providers is trivial (existing call()).
[+] Stub provider can emit fake stream chunks for offline testing.
```

### Negative / Tradeoffs

```text
[-] Streaming error handling is more complex than call() — errors can arrive
    mid-stream after partial output has already been rendered.
[-] TUI must manage in-progress message state (append vs. replace).
[-] Real-time token counting during streaming is deferred (not in scope).
[-] Provider-specific SSE chunk formats must be normalized into
    ModelStreamChunk — the adapter is responsible for this mapping.
```

## Implementation Rules

```text
[ ] stream() must honour AbortSignal — abort mid-stream closes the SSE
    connection and emits model.stream_error.
[ ] Stream error events must be redacted (same rules as Phase 15).
[ ] Only the final complete message is persisted — deltas are ephemeral.
[ ] Tool-call responses must remain non-streaming.
[ ] TUI must not execute tools, decide policy, or access storage based on
    stream events — rendering only.
[ ] SessionRunner must fall back to call() when the provider does not
    support stream().
```

## Boundaries

| Layer | Owns |
|-------|------|
| `packages/models` | `ModelStreamChunk` type, `stream()` interface + impl |
| `packages/core` | `routeStream()`, stream→event path in SessionRunner |
| `packages/protocol` | Stream event schemas |
| `packages/sdk` | `onStreamDelta`/`onStreamComplete` convenience methods |
| `apps/tui` | Incremental text rendering — no tool/policy/storage authority |

## Risks

```text
[ ] Provider SSE format changes — mitigated by adapter-layer normalization.
[ ] Partial output rendered then lost on error — acceptable: user sees what
    was generated, error event explains the failure.
[ ] Large streams with many tiny deltas flood the event bus — mitigated by
    provider-level chunk sizing (typically word-level, not character-level).
```

## Validation Checklist

```text
[ ] ModelProvider.stream() interface defined in packages/models.
[ ] StubModelProvider.stream() emits fake chunks for offline testing.
[ ] OpenAICompatibleProvider.stream() parses real SSE chunks.
[ ] ModelRouter.routeStream() wraps provider.stream() with message mapping.
[ ] SessionRunner emits model.stream_delta for each chunk.
[ ] SessionRunner emits model.stream_complete on terminal chunk.
[ ] SessionRunner persists only the final complete message.
[ ] SessionRunner falls back to call() for providers without stream().
[ ] Protocol defines model.stream_delta, model.stream_complete,
    model.stream_error event schemas.
[ ] SDK EventsResource exposes onStreamDelta/onStreamComplete callbacks.
[ ] TUI assistant message rendering appends deltas incrementally.
[ ] TUI shows streaming indicator while stream is active.
[ ] Stream error events are redacted (no secrets, no internal paths).
[ ] AbortSignal mid-stream produces a clean error event.
[ ] All existing tests continue to pass.
[ ] Test-health passes all static checks.
[ ] git diff --check is clean.
```

## Notes for Future Agents

Streaming is OpenAI-compatible only. Add Anthropic streaming (SSE with a
different chunk format) in a future phase. Real-time token budget updates
during streaming are also deferred — the token health system (Phase 12)
currently operates on completed messages only.
