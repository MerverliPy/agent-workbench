import type { Hono } from "hono";
import { EventRoute, GlobalInfoRoute, HealthRoute } from "@agent-workbench/protocol";
import { streamSSE } from "hono/streaming";
import type { ServerConfig } from "../config";
import type { ServerAppBindings } from "../context";
import { validateRequest } from "../utils/validation";
import { createJsonRouteHandler } from "./helpers";

function sleep(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export function registerGlobalRoutes(
  app: Hono<ServerAppBindings>,
  options: { readonly startedAt: number; readonly config: ServerConfig }
) {
  app.get(
    HealthRoute.path,
    createJsonRouteHandler(HealthRoute, () => ({
      status: "ok",
      uptime: Math.floor((Date.now() - options.startedAt) / 1000),
      version: options.config.version,
    }))
  );

  app.get(
    GlobalInfoRoute.path,
    createJsonRouteHandler(GlobalInfoRoute, () => ({
      version: options.config.version,
      name: options.config.name,
      description: options.config.description,
      uptime: Math.floor((Date.now() - options.startedAt) / 1000),
      serverTime: new Date().toISOString(),
      capabilities: ["health", "info", "sse", "validated-placeholders"],
    }))
  );

  app.get(EventRoute.path, async (context) => {
    await validateRequest(EventRoute, context.req);

    return streamSSE(context, async (stream) => {
      await stream.write("retry: 3000\n\n");

      for (;;) {
        if (stream.aborted) {
          break;
        }

        // Phase 3 accepts repeated query params like ?types=a&types=b via Hono's
        // queries() support, but intentionally does not invent runtime events yet.
        await stream.write(`: keep-alive ${new Date().toISOString()}\n\n`);
        await sleep(30000);
      }
    });
  });
}
