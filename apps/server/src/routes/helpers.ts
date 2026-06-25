import type { Context, Handler } from "hono";
import type { RouteContract } from "@agent-workbench/protocol";
import type { ServerAppBindings } from "../context";
import { ApiError } from "../errors";
import { validateRequest, validateResponse, type ValidatedRequest } from "../utils/validation";

export interface RouteHandlerContext {
  readonly validated: ValidatedRequest;
}

type AppContext = Context<ServerAppBindings>;

export function createJsonRouteHandler<T>(
  contract: RouteContract,
  handler: (context: AppContext, routeContext: RouteHandlerContext) => Promise<T> | T
): Handler<ServerAppBindings> {
  return async (context) => {
    const validated = await validateRequest(contract, context.req);
    const result = await handler(context, { validated });
    const response = validateResponse(contract, result);
    return context.json(response);
  };
}

export function createNotImplementedHandler(contract: RouteContract, routeName: string): Handler<ServerAppBindings> {
  return async (context) => {
    await validateRequest(contract, context.req);

    throw new ApiError({
      status: 501,
      code: "NOT_IMPLEMENTED",
      message: `${routeName} is not implemented in Phase 3`,
      recoverable: true,
    });
  };
}
