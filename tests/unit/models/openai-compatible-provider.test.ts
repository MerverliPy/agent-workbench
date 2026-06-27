/// <reference types="bun" />
import { describe, it, expect } from "bun:test";
import {
  OpenAICompatibleProvider,
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderServerError,
  ProviderResponseError,
} from "@agent-workbench/models";
import type { ProviderConfig } from "@agent-workbench/models";

function fakeFetch(responseFactory: (url: string, init?: RequestInit) => Response): typeof fetch {
  return ((_url: string | URL | Request, _init?: RequestInit) => {
    const url = typeof _url === "string" ? _url : _url.toString();
    return Promise.resolve(responseFactory(url, _init));
  }) as unknown as typeof fetch;
}

function makeConfig(overrides?: Partial<ProviderConfig>): ProviderConfig {
  return {
    provider: "openai",
    model: "gpt-4o",
    apiKey: "sk-test-api-key-12345",
    ...overrides,
  };
}

describe("OpenAICompatibleProvider — text response mapping", () => {
  it("maps a simple text response correctly", async () => {
    const fetchImpl = fakeFetch(() =>
      new Response(JSON.stringify({
        choices: [
          {
            message: { role: "assistant", content: "Hello, world!" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }), { status: 200 })
    );

    const provider = new OpenAICompatibleProvider(makeConfig(), fetchImpl);
    const response = await provider.call({
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(response.kind.type).toBe("text");
    if (response.kind.type === "text") {
      expect(response.kind.content).toBe("Hello, world!");
    }
    expect(response.stopReason).toBe("stop");
    expect(response.usage).toEqual({ inputTokens: 10, outputTokens: 5 });
  });

  it("handles response without usage field", async () => {
    const fetchImpl = fakeFetch(() =>
      new Response(JSON.stringify({
        choices: [
          {
            message: { role: "assistant", content: "No usage" },
            finish_reason: "stop",
          },
        ],
      }), { status: 200 })
    );

    const provider = new OpenAICompatibleProvider(makeConfig(), fetchImpl);
    const response = await provider.call({
      messages: [{ role: "user", content: "Hi" }],
    });
    expect(response.kind.type).toBe("text");
    expect(response.usage).toBeUndefined();
  });

  it("handles null/missing message content", async () => {
    const fetchImpl = fakeFetch(() =>
      new Response(JSON.stringify({
        choices: [
          {
            message: { role: "assistant" },
            finish_reason: "stop",
          },
        ],
      }), { status: 200 })
    );

    const provider = new OpenAICompatibleProvider(makeConfig(), fetchImpl);
    const response = await provider.call({
      messages: [{ role: "user", content: "Hi" }],
    });
    expect(response.kind.type).toBe("text");
    if (response.kind.type === "text") {
      expect(response.kind.content).toBe("");
    }
  });
});

describe("OpenAICompatibleProvider — tool calls mapping", () => {
  it("maps tool calls correctly", async () => {
    const fetchImpl = fakeFetch(() =>
      new Response(JSON.stringify({
        choices: [
          {
            message: {
              role: "assistant",
              tool_calls: [
                {
                  id: "call-1",
                  type: "function",
                  function: {
                    name: "read_file",
                    arguments: '{"path": "/tmp/test.txt"}',
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
        usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
      }), { status: 200 })
    );

    const provider = new OpenAICompatibleProvider(makeConfig(), fetchImpl);
    const response = await provider.call({
      messages: [{ role: "user", content: "Read a file" }],
      tools: [{ name: "read_file", description: "Read a file", inputSchema: {} }],
    });

    expect(response.kind.type).toBe("tool_calls");
    if (response.kind.type === "tool_calls") {
      expect(response.kind.calls.length).toBe(1);
      expect(response.kind.calls[0]!.id).toBe("call-1");
      expect(response.kind.calls[0]!.name).toBe("read_file");
      expect(response.kind.calls[0]!.input).toEqual({ path: "/tmp/test.txt" });
    }
    expect(response.stopReason).toBe("tool_calls");
    expect(response.usage).toEqual({ inputTokens: 20, outputTokens: 10 });
  });

  it("returns text response when tool_calls array is empty", async () => {
    const fetchImpl = fakeFetch(() =>
      new Response(JSON.stringify({
        choices: [
          {
            message: {
              role: "assistant",
              content: "No tools needed",
              tool_calls: [],
            },
            finish_reason: "stop",
          },
        ],
      }), { status: 200 })
    );

    const provider = new OpenAICompatibleProvider(makeConfig(), fetchImpl);
    const response = await provider.call({
      messages: [{ role: "user", content: "Hi" }],
    });
    expect(response.kind.type).toBe("text");
  });
});

describe("OpenAICompatibleProvider — request building", () => {
  it("includes tools when provided", async () => {
    let capturedBody: string | undefined;
    const fetchImpl = fakeFetch((url, init) => {
      capturedBody = init?.body as string;
      return new Response(JSON.stringify({
        choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
      }), { status: 200 });
    });

    const provider = new OpenAICompatibleProvider(makeConfig(), fetchImpl);
    await provider.call({
      messages: [{ role: "user", content: "Test" }],
      tools: [{ name: "grep", description: "Search", inputSchema: { type: "object" } }],
    });

    expect(capturedBody).toBeDefined();
    const body = JSON.parse(capturedBody!);
    expect(body.tools).toBeDefined();
    expect(body.tools).toHaveLength(1);
    expect(body.tools[0].type).toBe("function");
    expect(body.tools[0].function.name).toBe("grep");
  });

  it("includes max_tokens when provided", async () => {
    let capturedBody: string | undefined;
    const fetchImpl = fakeFetch((url, init) => {
      capturedBody = init?.body as string;
      return new Response(JSON.stringify({
        choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
      }), { status: 200 });
    });

    const provider = new OpenAICompatibleProvider(makeConfig(), fetchImpl);
    await provider.call({
      messages: [{ role: "user", content: "Test" }],
      maxTokens: 100,
    });

    const body = JSON.parse(capturedBody!);
    expect(body.max_tokens).toBe(100);
  });

  it("sets Authorization header with API key", async () => {
    let capturedHeaders: HeadersInit | undefined;
    const fetchImpl = fakeFetch((url, init) => {
      capturedHeaders = init?.headers;
      return new Response(JSON.stringify({
        choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
      }), { status: 200 });
    });

    const provider = new OpenAICompatibleProvider(makeConfig({ apiKey: "sk-custom-key" }), fetchImpl);
    await provider.call({ messages: [{ role: "user", content: "Test" }] });

    expect(capturedHeaders).toBeDefined();
    const headers = capturedHeaders as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer sk-custom-key");
  });

  it("includes tool_call_id for tool messages", async () => {
    let capturedBody: string | undefined;
    const fetchImpl = fakeFetch((url, init) => {
      capturedBody = init?.body as string;
      return new Response(JSON.stringify({
        choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
      }), { status: 200 });
    });

    const provider = new OpenAICompatibleProvider(makeConfig(), fetchImpl);
    await provider.call({
      messages: [
        { role: "user", content: "Test" },
        { role: "tool", content: "result", toolCallId: "call-123" },
      ],
    });

    const body = JSON.parse(capturedBody!);
    expect(body.messages[1].tool_call_id).toBe("call-123");
  });
});

describe("OpenAICompatibleProvider — HTTP error handling", () => {
  it("handles 401 auth error", async () => {
    const fetchImpl = fakeFetch(() =>
      new Response(JSON.stringify({ error: { message: "Invalid API key" } }), { status: 401 })
    );

    const provider = new OpenAICompatibleProvider(makeConfig(), fetchImpl);
    await expect(
      provider.call({ messages: [{ role: "user", content: "Test" }] })
    ).rejects.toThrow(ProviderAuthError);
  });

  it("handles 403 forbidden error", async () => {
    const fetchImpl = fakeFetch(() =>
      new Response("Forbidden", { status: 403 })
    );

    const provider = new OpenAICompatibleProvider(makeConfig(), fetchImpl);
    await expect(
      provider.call({ messages: [{ role: "user", content: "Test" }] })
    ).rejects.toThrow(ProviderAuthError);
  });

  it("handles 429 rate limit error", async () => {
    const fetchImpl = fakeFetch(() =>
      new Response(JSON.stringify({ error: { message: "Rate limited" } }), { status: 429 })
    );

    const provider = new OpenAICompatibleProvider(makeConfig(), fetchImpl);
    await expect(
      provider.call({ messages: [{ role: "user", content: "Test" }] })
    ).rejects.toThrow(ProviderRateLimitError);
  });

  it("handles 500 server error", async () => {
    const fetchImpl = fakeFetch(() =>
      new Response("Internal Server Error", { status: 500 })
    );

    const provider = new OpenAICompatibleProvider(makeConfig(), fetchImpl);
    await expect(
      provider.call({ messages: [{ role: "user", content: "Test" }] })
    ).rejects.toThrow(ProviderServerError);
  });

  it("handles 502/503/504 server errors", async () => {
    for (const status of [502, 503, 504]) {
      const fetchImpl = fakeFetch(() =>
        new Response("Unavailable", { status })
      );
      const provider = new OpenAICompatibleProvider(makeConfig(), fetchImpl);
      await expect(
        provider.call({ messages: [{ role: "user", content: "Test" }] })
      ).rejects.toThrow(ProviderServerError);
    }
  });

  it("redacts API key from error messages", async () => {
    const fetchImpl = fakeFetch(() =>
      new Response(JSON.stringify({ error: { message: "Invalid key: sk-test-api-key-12345" } }), { status: 401 })
    );

    const provider = new OpenAICompatibleProvider(makeConfig(), fetchImpl);
    let caught: Error | undefined;
    try {
      await provider.call({ messages: [{ role: "user", content: "Test" }] });
    } catch (err) {
      caught = err as Error;
    }
    expect(caught).toBeDefined();
    expect(caught!.message).not.toContain("sk-test-api-key-12345");
  });
});

describe("OpenAICompatibleProvider — malformed response handling", () => {
  it("handles non-JSON response body", async () => {
    const fetchImpl = fakeFetch(() =>
      new Response("plain text, not json", { status: 200 })
    );

    const provider = new OpenAICompatibleProvider(makeConfig(), fetchImpl);
    await expect(
      provider.call({ messages: [{ role: "user", content: "Test" }] })
    ).rejects.toThrow(ProviderResponseError);
  });

  it("handles response missing choices", async () => {
    const fetchImpl = fakeFetch(() =>
      new Response(JSON.stringify({ not_choices: true }), { status: 200 })
    );

    const provider = new OpenAICompatibleProvider(makeConfig(), fetchImpl);
    await expect(
      provider.call({ messages: [{ role: "user", content: "Test" }] })
    ).rejects.toThrow(ProviderResponseError);
  });

  it("handles response with empty choices array", async () => {
    const fetchImpl = fakeFetch(() =>
      new Response(JSON.stringify({ choices: [] }), { status: 200 })
    );

    const provider = new OpenAICompatibleProvider(makeConfig(), fetchImpl);
    await expect(
      provider.call({ messages: [{ role: "user", content: "Test" }] })
    ).rejects.toThrow(ProviderResponseError);
  });

  it("handles response that is not an object", async () => {
    const fetchImpl = fakeFetch(() =>
      new Response(JSON.stringify("just a string"), { status: 200 })
    );

    const provider = new OpenAICompatibleProvider(makeConfig(), fetchImpl);
    await expect(
      provider.call({ messages: [{ role: "user", content: "Test" }] })
    ).rejects.toThrow(ProviderResponseError);
  });
});

describe("OpenAICompatibleProvider — abort signal", () => {
  it("throws AbortError when signal is already aborted", async () => {
    const provider = new OpenAICompatibleProvider(makeConfig());
    const controller = new AbortController();
    controller.abort();

    await expect(
      provider.call({
        messages: [{ role: "user", content: "Test" }],
        signal: controller.signal,
      })
    ).rejects.toThrow();
  });

  it("does NOT make a fetch call when signal is already aborted", () => {
    let fetchCalled = false;
    const fetchImpl = fakeFetch(() => {
      fetchCalled = true;
      return new Response("{}", { status: 200 });
    });

    const provider = new OpenAICompatibleProvider(makeConfig(), fetchImpl);
    const controller = new AbortController();
    controller.abort();

    // The call rejects before fetching
    expect(provider.call({
      messages: [{ role: "user", content: "Test" }],
      signal: controller.signal,
    })).rejects.toThrow();

    // Wait a tick to verify fetch was never invoked
    expect(fetchCalled).toBe(false);
  });
});
