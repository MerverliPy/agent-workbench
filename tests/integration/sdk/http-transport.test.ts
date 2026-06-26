/// <reference types="bun" />
import { describe, it, expect } from "bun:test";
import { Hono } from "hono";
import { HttpTransport, ApiError } from "@agent-workbench/sdk";
import { ErrorEnvelope } from "@agent-workbench/protocol";
import { z } from "zod/v4";

function createTestApp() {
  const app = new Hono();

  app.get("/health", (c) =>
    c.json({ status: "ok", uptime: 1, version: "test" })
  );

  app.get("/error-400", (c) =>
    c.json(
      {
        error: {
          code: "BAD_REQUEST",
          message: "Missing parameter",
          requestId: "req-1",
          recoverable: true,
        },
      },
      400
    )
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
      500
    )
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
      expect(caught!.code).toBe("BAD_REQUEST");
      expect(caught!.status).toBe(400);
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
      expect(caught!.code).toBe("INTERNAL_ERROR");
      expect(caught!.status).toBe(500);
    } finally {
      server.stop(true);
    }
  });

  it("validates response with Zod schema", async () => {
    const { server, url: baseUrl } = createTestApp();

    try {
      const transport = new HttpTransport({ baseUrl });
      const StrictSchema = z.object({ status: z.literal("ok"), uptime: z.number(), version: z.string() });
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
      expect(typeof caught!.code).toBe("string");
    } finally {
      server.stop(true);
    }
  });
});
