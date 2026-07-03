import { GetTokenHealthRoute } from "@agent-workbench/protocol";
import type { Hono } from "hono";
import type { ServerAppBindings, ServerServices } from "../context";
import { ApiError } from "../errors";
import { createJsonRouteHandler } from "./helpers";

export function registerTokenHealthRoutes(
  app: Hono<ServerAppBindings>,
  services: ServerServices,
): void {
  const { sessionRunner } = services;

  app.get(
    GetTokenHealthRoute.path,
    createJsonRouteHandler(GetTokenHealthRoute, (_ctx, { validated }) => {
      const { sessionId } = validated.pathParams as { sessionId: string };

      try {
        return sessionRunner.getTokenHealth(sessionId);
      } catch (err: unknown) {
        throw new ApiError({
          status: 500,
          code: "INTERNAL_ERROR",
          message: `Failed to compute token health: ${err instanceof Error ? err.message : String(err)}`,
          recoverable: false,
        });
      }
    }),
  );
}
