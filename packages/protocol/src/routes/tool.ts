import { z } from "zod/v4";
import { ErrorEnvelope } from "../schemas/error-envelope";
import { ToolDefinition } from "../schemas/tool";

export const ListToolsRoute = {
  method: "GET" as const,
  path: "/tool",
  response: z.object({ items: z.array(ToolDefinition) }),
  errors: [ErrorEnvelope],
} as const;

export const GetToolRoute = {
  method: "GET" as const,
  path: "/tool/:toolName",
  response: ToolDefinition,
  errors: [ErrorEnvelope],
} as const;
