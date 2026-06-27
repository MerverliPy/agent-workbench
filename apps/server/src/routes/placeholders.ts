import type { Hono } from "hono";
import {
  CreateTokenRoute,
  FocusRoute,
  GetAuthStatusRoute,
  GetConfigRoute,
  GetEffectiveConfigRoute,
  GetFileDiffRoute,
  GetFileTreeRoute,
  GetTuiStateRoute,
  ListFilesRoute,
  ListToolsRoute,
  GetToolRoute,
  PrefillPromptRoute,
  ReadFileRoute,
  ValidateConfigRoute,
  type RouteContract,
} from "@agent-workbench/protocol";
import type { ServerAppBindings } from "../context";
import { createNotImplementedHandler } from "./helpers";

/**
 * Routes that are not yet implemented and return 501.
 *
 * Session and message routes were removed from this list in Phase 6.
 * Permission routes were removed from this list in Phase 8 (now real handlers
 * in permission-routes.ts).
 * Provider routes were removed from this list in Phase 15 (now real handlers
 * in provider-routes.ts).
 */
interface PlaceholderRouteDefinition {
  readonly contract: RouteContract;
  readonly routeName: string;
}

const placeholderRoutes: readonly PlaceholderRouteDefinition[] = [
  { contract: GetConfigRoute, routeName: "config.get" },
  { contract: GetEffectiveConfigRoute, routeName: "config.getEffective" },
  { contract: ValidateConfigRoute, routeName: "config.validate" },
  { contract: ListFilesRoute, routeName: "file.list" },
  { contract: ReadFileRoute, routeName: "file.read" },
  { contract: GetFileDiffRoute, routeName: "file.diff" },
  { contract: GetFileTreeRoute, routeName: "file.tree" },
  { contract: ListToolsRoute, routeName: "tool.list" },
  { contract: GetToolRoute, routeName: "tool.get" },
  { contract: PrefillPromptRoute, routeName: "tui.prefillPrompt" },
  { contract: FocusRoute, routeName: "tui.focus" },
  { contract: GetTuiStateRoute, routeName: "tui.getState" },
  { contract: CreateTokenRoute, routeName: "auth.createToken" },
  { contract: GetAuthStatusRoute, routeName: "auth.getStatus" },
] as const;

function registerRoute(app: Hono<ServerAppBindings>, definition: PlaceholderRouteDefinition) {
  const handler = createNotImplementedHandler(definition.contract, definition.routeName);

  switch (definition.contract.method) {
    case "GET":
      app.get(definition.contract.path, handler);
      break;
    case "POST":
      app.post(definition.contract.path, handler);
      break;
    case "PATCH":
      app.patch(definition.contract.path, handler);
      break;
    case "DELETE":
      app.delete(definition.contract.path, handler);
      break;
  }
}

export function registerPlaceholderRoutes(app: Hono<ServerAppBindings>) {
  for (const definition of placeholderRoutes) {
    registerRoute(app, definition);
  }
}
