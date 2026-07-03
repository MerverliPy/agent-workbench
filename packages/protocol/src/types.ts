import type { z } from "zod/v4";
import type { ErrorEnvelope } from "./schemas/error-envelope";

export interface RouteContract {
  readonly method: "GET" | "POST" | "PATCH" | "DELETE";
  readonly path: string;
  readonly pathParams?: z.ZodType;
  readonly query?: z.ZodType;
  readonly body?: z.ZodType;
  readonly response: z.ZodType;
  readonly errors: readonly [typeof ErrorEnvelope];
  readonly isStream?: boolean;
}

export type InferRouteResponse<T extends RouteContract> = z.infer<
  T["response"]
>;

export type InferRouteParams<T extends RouteContract> =
  T["pathParams"] extends z.ZodType
    ? z.infer<T["pathParams"]>
    : Record<string, never>;

export type InferRouteQuery<T extends RouteContract> =
  T["query"] extends z.ZodType ? z.infer<T["query"]> : Record<string, never>;
