import { describe, expect, test } from "bun:test";
import {
  AirGapBlockedError,
  createAirGappedFetch,
  isAirGapped,
  isLocalUrl,
} from "./airgap";

// ── isLocalUrl ──────────────────────────────────────────────────────────

describe("isLocalUrl", () => {
  test("returns true for localhost", () => {
    expect(isLocalUrl("http://localhost:11434/v1/chat")).toBe(true);
    expect(isLocalUrl("http://localhost/")).toBe(true);
  });

  test("returns true for 127.0.0.1", () => {
    expect(isLocalUrl("http://127.0.0.1:3000/")).toBe(true);
    expect(isLocalUrl("http://127.0.0.1/api")).toBe(true);
  });

  test("returns true for ::1", () => {
    expect(isLocalUrl("http://[::1]:3000/")).toBe(true);
  });

  test("returns true for 0.0.0.0", () => {
    expect(isLocalUrl("http://0.0.0.0:3000/")).toBe(true);
  });

  test("returns false for external URLs", () => {
    expect(isLocalUrl("https://api.openai.com/v1")).toBe(false);
    expect(isLocalUrl("https://api.anthropic.com/v1")).toBe(false);
    expect(isLocalUrl("https://openrouter.ai/api/v1")).toBe(false);
  });

  test("returns false for invalid URLs", () => {
    expect(isLocalUrl("not-a-url")).toBe(false);
    expect(isLocalUrl("")).toBe(false);
  });
});

// ── createAirGappedFetch ────────────────────────────────────────────────

describe("createAirGappedFetch", () => {
  test("allows localhost requests", async () => {
    let called = false;
    const mockFetch = async (
      _input: URL | Request | string,
      _init?: RequestInit,
    ) => {
      called = true;
      return new Response("ok");
    };

    const airGapped = createAirGappedFetch(
      mockFetch as unknown as typeof fetch,
    );
    const response = await airGapped("http://localhost:11434/v1/chat");
    expect(called).toBe(true);
    expect(await response.text()).toBe("ok");
  });

  test("allows 127.0.0.1 requests", async () => {
    let called = false;
    const mockFetch = async () => {
      called = true;
      return new Response("ok");
    };

    const airGapped = createAirGappedFetch(
      mockFetch as unknown as typeof fetch,
    );
    await airGapped("http://127.0.0.1:3000/health");
    expect(called).toBe(true);
  });

  test("blocks external URLs", async () => {
    const mockFetch = async () => new Response("should not be called");
    const airGapped = createAirGappedFetch(
      mockFetch as unknown as typeof fetch,
    );

    expect(airGapped("https://api.openai.com/v1")).rejects.toThrow(
      AirGapBlockedError,
    );
  });

  test("blocked error contains the URL and clear message", async () => {
    const airGapped = createAirGappedFetch();
    try {
      await airGapped("https://api.anthropic.com/v1/messages");
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AirGapBlockedError);
      expect((err as Error).message).toContain("api.anthropic.com");
      expect((err as Error).message).toContain("AGENT_WORKBENCH_AIRGAPPED");
    }
  });

  test("blocks Request objects with external URLs", async () => {
    const airGapped = createAirGappedFetch();
    const request = new Request("https://openrouter.ai/api/v1/chat");
    expect(airGapped(request)).rejects.toThrow(AirGapBlockedError);
  });
});

// ── isAirGapped ─────────────────────────────────────────────────────────

describe("isAirGapped", () => {
  test("returns true when env is 'true'", () => {
    const prev = process.env.AGENT_WORKBENCH_AIRGAPPED;
    process.env.AGENT_WORKBENCH_AIRGAPPED = "true";
    expect(isAirGapped()).toBe(true);
    process.env.AGENT_WORKBENCH_AIRGAPPED = prev;
  });

  test("returns false when env is 'false'", () => {
    const prev = process.env.AGENT_WORKBENCH_AIRGAPPED;
    process.env.AGENT_WORKBENCH_AIRGAPPED = "false";
    expect(isAirGapped()).toBe(false);
    process.env.AGENT_WORKBENCH_AIRGAPPED = prev;
  });

  test("returns false when env is unset", () => {
    const prev = process.env.AGENT_WORKBENCH_AIRGAPPED;
    delete process.env.AGENT_WORKBENCH_AIRGAPPED;
    expect(isAirGapped()).toBe(false);
    process.env.AGENT_WORKBENCH_AIRGAPPED = prev;
  });
});
