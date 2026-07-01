/// <reference types="bun" />
import { describe, it, expect } from "bun:test";
import { StubModelProvider, type ModelStreamChunk } from "@agent-workbench/models";

describe("StubModelProvider.stream", () => {
  it("yields chunks word by word and terminates", async () => {
    const provider = new StubModelProvider({
      textResponse: "hello world test",
    });

    const chunks: ModelStreamChunk[] = [];
    for await (const chunk of provider.stream({
      messages: [{ role: "user", content: "hi" }],
    })) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThanOrEqual(3);

    // First chunk should be "hello "
    expect(chunks[0]!.content).toBe("hello ");
    expect(chunks[0]!.done).toBe(false);

    // Middle chunk should be "world "
    expect(chunks[1]!.content).toBe("world ");

    // Last chunk should be "test" with done=true, stopReason, and usage
    const last = chunks[chunks.length - 1]!;
    expect(last.content).toBe("test");
    expect(last.done).toBe(true);
    expect(last.stopReason).toBe("stop");
    expect(last.usage).toBeDefined();
    expect(last.usage!.inputTokens).toBeGreaterThan(0);
    expect(last.usage!.outputTokens).toBeGreaterThan(0);
  });

  it("handles single-word text response", async () => {
    const provider = new StubModelProvider({
      textResponse: "hello",
    });

    const chunks: ModelStreamChunk[] = [];
    for await (const chunk of provider.stream({
      messages: [{ role: "user", content: "hi" }],
    })) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBe(1);
    expect(chunks[0]!.content).toBe("hello");
    expect(chunks[0]!.done).toBe(true);
  });

  it("throws AbortError when signal is already aborted", async () => {
    const provider = new StubModelProvider();
    const controller = new AbortController();
    controller.abort();

    const iterable = provider.stream({
      messages: [{ role: "user", content: "hi" }],
      signal: controller.signal,
    });

    const iterator = iterable[Symbol.asyncIterator]();
    try {
      await iterator.next();
      expect.unreachable("Expected abort error");
    } catch (err) {
      expect((err as Error).name).toBe("AbortError");
    }
  });

  it("throws AbortError when aborted mid-stream", async () => {
    const provider = new StubModelProvider({
      textResponse: "one two three four five",
    });

    const controller = new AbortController();

    const iterator = provider.stream({
      messages: [{ role: "user", content: "hi" }],
      signal: controller.signal,
    })[Symbol.asyncIterator]();

    // Read a few chunks — discard values, just verify no error yet
    await iterator.next();
    await iterator.next();

    // Abort mid-stream
    controller.abort();

    // Next read should throw AbortError
    try {
      await iterator.next();
      expect.unreachable("Expected abort error");
    } catch (err) {
      expect((err as Error).name).toBe("AbortError");
    }
  });

  it("has stream method (supports streaming)", () => {
    const provider = new StubModelProvider();
    expect(typeof provider.stream).toBe("function");
  });

  it("yields empty stream for tool-call mode on first call", async () => {
    const provider = new StubModelProvider({
      stubbedToolCall: {
        id: "call_1",
        name: "test_tool",
        input: { arg: "value" },
      },
    });

    const chunks: ModelStreamChunk[] = [];
    for await (const chunk of provider.stream({
      messages: [{ role: "user", content: "hi" }],
    })) {
      chunks.push(chunk);
    }

    // Tool-call mode yields no chunks on first call (empty stream)
    expect(chunks.length).toBe(0);
  });
});
