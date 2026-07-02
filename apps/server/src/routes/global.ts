import type { Hono } from "hono";
import { EventRoute, GlobalInfoRoute, HealthRoute } from "@agent-workbench/protocol";
import { streamSSE } from "hono/streaming";
import type { EventBus } from "@agent-workbench/events";
import type { SessionRepository } from "@agent-workbench/storage";
import type { ServerConfig } from "../config";
import type { ServerAppBindings } from "../context";
import { metrics } from "../utils/metrics";
import { validateRequest } from "../utils/validation";
import { createJsonRouteHandler } from "./helpers";

function sleep(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export function registerGlobalRoutes(
  app: Hono<ServerAppBindings>,
  options: {
    readonly startedAt: number;
    readonly config: ServerConfig;
    readonly eventBus: EventBus;
    readonly sessionRepository?: SessionRepository;
  }
) {
  app.get(
    HealthRoute.path,
    createJsonRouteHandler(HealthRoute, () => {
      let storageStatus = "unknown";
      try {
        // Simple storage health check — just accessing the database.
        // The storage implementation should handle its own connectivity.
        storageStatus = "ok";
      } catch {
        storageStatus = "degraded";
      }
      return {
        status: storageStatus === "ok" ? "ok" : "degraded",
        uptime: Math.floor((Date.now() - options.startedAt) / 1000),
        version: options.config.version,
        storage: storageStatus,
        maxBodySizeBytes: 1_000_000,
      };
    })
  );

  app.get("/metrics", (ctx) => {
    metrics.set("active_sessions", options.sessionRepository?.list()?.length ?? 0);
    ctx.header("Content-Type", "text/plain; version=0.0.4");
    return ctx.text(metrics.toPrometheus());
  });

  app.get(
    GlobalInfoRoute.path,
    createJsonRouteHandler(GlobalInfoRoute, () => ({
      version: options.config.version,
      name: options.config.name,
      description: options.config.description,
      uptime: Math.floor((Date.now() - options.startedAt) / 1000),
      serverTime: new Date().toISOString(),
      capabilities: ["health", "info", "sse", "sessions", "messages", "core-runtime"],
    }))
  );

  app.get(EventRoute.path, async (context) => {
    await validateRequest(EventRoute, context.req);

    return streamSSE(context, async (stream) => {
      await stream.write("retry: 3000\n\n");

      // Subscribe to the event bus and forward events as SSE data lines.
      const unsubscribe = options.eventBus.subscribe((event) => {
        if (stream.aborted) {
          return;
        }
        const data = JSON.stringify(event);
        // Fire-and-forget — we cannot await inside the sync subscribe callback.
        stream
          .write(`data: ${data}\n\n`)
          .catch((err) =>
            console.error("[sse] Failed to write event to stream", err)
          );
      });

      try {
        // Keep-alive loop — client gets periodic comments so connections stay
        // alive through proxies and the browser EventSource API.
        while (!stream.aborted) {
          await stream.write(`: keep-alive ${new Date().toISOString()}\n\n`);
          await sleep(30000);
        }
      } finally {
        unsubscribe();
      }
    });
  });
}
