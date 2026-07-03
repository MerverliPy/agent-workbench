/// <reference types="bun" />
import { describe, expect, it } from "bun:test";
import {
  type ApiError,
  HttpTransport,
  type SdkError,
} from "@agent-workbench/sdk";
import { Hono } from "hono";
import { z } from "zod/v4";

function createTestApp() {
  const app = new Hono();

  app.get("/health", (c) =>
    c.json({ status: "ok", uptime: 1, version: "test" }),
  );

  app.get("/health-malformed", (_c) => {
    // Return invalid JSON to test parse failure.
    return new Response("not json", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });

  app.get("/error-400", (c) =>
    c.json(
      {
        error: {
          code: "BAD_REQUEST",
          message: "Missing parameter",
          requestId: "req-1",
          recoverable: true,
          details: { field: "query" },
        },
      },
      400,
    ),
  );

  app.get("/error-500", (c) =>
    c.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Something broke",
          requestId: "req-2",
          recoverable: false,
        },
      },
      500,
    ),
  );

  app.get("/error-raw", (c) => c.json({ raw: "error" }, 400));

  const server = Bun.serve({ fetch: app.fetch, port: 0 });
  return { server, port: server.port, url: server.url.toString() };
}

describe("HttpTransport", () => {
  it("makes a successful health request", async () => {
    const { server, url: baseUrl } = createTestApp();

    try {
      const transport = new HttpTransport({ baseUrl });
      const HealthSchema = z.object({
        status: z.string(),
        uptime: z.number(),
        version: z.string(),
      });
      const result = await transport.request("GET", "/health", {
        responseSchema: HealthSchema,
      });
      expect(result.status).toBe("ok");
      expect(result.uptime).toBe(1);
    } finally {
      server.stop(true);
    }
  });

  it("throws ApiError on 4xx responses", async () => {
    const { server, url: baseUrl } = createTestApp();

    try {
      const transport = new HttpTransport({ baseUrl });
      let caught: ApiError | undefined;
      try {
        await transport.request("GET", "/error-400");
      } catch (err) {
        caught = err as ApiError;
      }
      expect(caught).toBeDefined();
      expect(caught?.code).toBe("BAD_REQUEST");
      expect(caught?.status).toBe(400);
    } finally {
      server.stop(true);
    }
  });

  it("throws ApiError on 5xx responses", async () => {
    const { server, url: baseUrl } = createTestApp();

    try {
      const transport = new HttpTransport({ baseUrl });
      let caught: ApiError | undefined;
      try {
        await transport.request("GET", "/error-500");
      } catch (err) {
        caught = err as ApiError;
      }
      expect(caught).toBeDefined();
      expect(caught?.code).toBe("INTERNAL_ERROR");
      expect(caught?.status).toBe(500);
    } finally {
      server.stop(true);
    }
  });

  it("validates response with Zod schema", async () => {
    const { server, url: baseUrl } = createTestApp();

    try {
      const transport = new HttpTransport({ baseUrl });
      const StrictSchema = z.object({
        status: z.literal("ok"),
        uptime: z.number(),
        version: z.string(),
      });
      const result = await transport.request("GET", "/health", {
        responseSchema: StrictSchema,
      });
      expect(result.status).toBe("ok");
    } finally {
      server.stop(true);
    }
  });

  it("parses non-standard error responses gracefully", async () => {
    const { server, url: baseUrl } = createTestApp();

    try {
      const transport = new HttpTransport({ baseUrl });
      let caught: ApiError | undefined;
      try {
        await transport.request("GET", "/error-raw");
      } catch (err) {
        caught = err as ApiError;
      }
      expect(caught).toBeDefined();
      // Should still be an ApiError with some code
      expect(typeof caught?.code).toBe("string");
    } finally {
      server.stop(true);
    }
  });
});

describe("HttpTransport contract — invalid response handling", () => {
  it("throws SdkError on invalid JSON success response", async () => {
    const { server, url: baseUrl } = createTestApp();

    try {
      const transport = new HttpTransport({ baseUrl });
      let caught: SdkError | undefined;
      try {
        await transport.request("GET", "/health-malformed");
      } catch (err) {
        caught = err as SdkError;
      }
      expect(caught).toBeDefined();
      expect(caught?.name).toBe("SdkError");
    } finally {
      server.stop(true);
    }
  });

  it("throws SdkError on response schema validation failure", async () => {
    const { server, url: baseUrl } = createTestApp();

    try {
      const transport = new HttpTransport({ baseUrl });
      const StrictSchema = z.object({
        status: z.literal("ok"),
        uptime: z.number(),
        version: z.string(),
        mustBePresent: z.string(),
      });
      let caught: SdkError | undefined;
      try {
        await transport.request("GET", "/health", {
          responseSchema: StrictSchema,
        });
      } catch (err) {
        caught = err as SdkError;
      }
      expect(caught).toBeDefined();
      expect(caught?.message).toContain("Response validation failed");
    } finally {
      server.stop(true);
    }
  });

  it("preserves recoverable flag from ErrorEnvelope", async () => {
    const { server, url: baseUrl } = createTestApp();

    try {
      const transport = new HttpTransport({ baseUrl });
      let caught: ApiError | undefined;
      try {
        await transport.request("GET", "/error-400");
      } catch (err) {
        caught = err as ApiError;
      }
      expect(caught).toBeDefined();
      expect(caught?.recoverable).toBe(true);
    } finally {
      server.stop(true);
    }
  });

  it("preserves details from ErrorEnvelope", async () => {
    const { server, url: baseUrl } = createTestApp();

    try {
      const transport = new HttpTransport({ baseUrl });
      let caught: ApiError | undefined;
      try {
        await transport.request("GET", "/error-400");
      } catch (err) {
        caught = err as ApiError;
      }
      expect(caught).toBeDefined();
      expect(caught?.details).toBeDefined();
      expect(caught?.details).toEqual({ field: "query" });
    } finally {
      server.stop(true);
    }
  });

  it("non-envelope error maps to ApiError with fallback values", async () => {
    const { server, url: baseUrl } = createTestApp();

    try {
      const transport = new HttpTransport({ baseUrl });
      let caught: ApiError | undefined;
      try {
        await transport.request("GET", "/error-raw");
      } catch (err) {
        caught = err as ApiError;
      }
      expect(caught).toBeDefined();
      expect(typeof caught?.code).toBe("string");
      expect(caught?.code).toBe("unknown");
      expect(caught?.status).toBe(400);
      expect(caught?.requestId).toBeUndefined();
    } finally {
      server.stop(true);
    }
  });

  it("network failure maps to SdkError", async () => {
    const transport = new HttpTransport({ baseUrl: "http://127.0.0.1:19999" });

    let caught: SdkError | undefined;
    try {
      await transport.request("GET", "/health");
    } catch (err) {
      caught = err as SdkError;
    }
    expect(caught).toBeDefined();
    expect(caught?.name).toBe("SdkError");
  });

  it("abort signal aborts request", async () => {
    const { server, url: baseUrl } = createTestApp();

    try {
      const transport = new HttpTransport({ baseUrl });
      const controller = new AbortController();
      controller.abort();

      let caught: unknown;
      try {
        await transport.request("GET", "/health", undefined, controller.signal);
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeDefined();
      // Either an SdkError wrapping the abort or the DOMException propagates.
    } finally {
      server.stop(true);
    }
  });
});
