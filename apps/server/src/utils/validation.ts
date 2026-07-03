import type { RouteContract } from "@agent-workbench/protocol";
import type { HonoRequest } from "hono";
import { ZodError, type z } from "zod";
import { ApiError } from "../errors";

type ParsedQuery = Record<string, string | string[] | undefined>;

export interface ValidatedRequest {
  readonly pathParams: Record<string, string>;
  readonly query: Record<string, string | string[] | undefined>;
  readonly body: unknown;
}

function formatValidationDetails(error: ZodError) {
  return error.issues.map((issue: ZodError["issues"][number]) => ({
    path: issue.path,
    code: issue.code,
    message: issue.message,
  }));
}

function parseWithSchema<T extends z.ZodType>(
  schema: T,
  value: unknown,
  target: "pathParams" | "query" | "body",
): z.infer<T> {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ApiError({
        status: 400,
        code: "VALIDATION_ERROR",
        message: `Invalid request ${target}`,
        details: formatValidationDetails(error),
        recoverable: true,
      });
    }

    throw error;
  }
}

function parseQuery(request: HonoRequest): ParsedQuery {
  const singleValueQuery = request.query();
  const repeatedValueQuery = request.queries();
  const parsed: ParsedQuery = {};

  for (const [key, value] of Object.entries(singleValueQuery)) {
    parsed[key] = value;
  }

  for (const [key, values] of Object.entries(repeatedValueQuery)) {
    if (values.length > 1) {
      parsed[key] = values;
      continue;
    }

    if (values.length === 1) {
      parsed[key] = values[0];
    }
  }

  return parsed;
}

async function parseBodyIfPresent(request: HonoRequest): Promise<unknown> {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD") {
    return undefined;
  }

  const contentLength = request.header("content-length");
  if (contentLength === "0") {
    return undefined;
  }

  const contentType = request.header("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return undefined;
  }

  try {
    return await request.json();
  } catch {
    throw new ApiError({
      status: 400,
      code: "INVALID_JSON",
      message: "Request body must be valid JSON",
      recoverable: true,
    });
  }
}

export async function validateRequest(
  contract: RouteContract,
  request: HonoRequest,
): Promise<ValidatedRequest> {
  const pathParams = contract.pathParams
    ? (parseWithSchema(
        contract.pathParams,
        request.param(),
        "pathParams",
      ) as Record<string, string>)
    : {};

  const query = contract.query
    ? (parseWithSchema(contract.query, parseQuery(request), "query") as Record<
        string,
        string | string[] | undefined
      >)
    : {};

  const rawBody = await parseBodyIfPresent(request);
  const body = contract.body
    ? parseWithSchema(contract.body, rawBody, "body")
    : undefined;

  return {
    pathParams,
    query,
    body,
  };
}

export function validateResponse<T>(contract: RouteContract, value: T): T {
  try {
    return contract.response.parse(value) as T;
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ApiError({
        status: 500,
        code: "RESPONSE_VALIDATION_ERROR",
        message: "Handler produced an invalid response payload",
        details: formatValidationDetails(error),
        recoverable: false,
      });
    }

    throw error;
  }
}
