import { ErrorEnvelope } from "@agent-workbench/protocol";
import type { z } from "zod/v4";
import { ApiError, SdkError } from "./errors";

export interface HttpTransportOptions {
  baseUrl: string;
}

export class HttpTransport {
  private baseUrl: string;

  constructor(options: HttpTransportOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
  }

  async request<T = unknown>(
    method: string,
    path: string,
    options?: {
      params?: Record<string, string | undefined>;
      body?: unknown;
      responseSchema?: z.ZodType<T>;
    },
    signal?: AbortSignal,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    if (options?.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined) {
          url.searchParams.set(key, value);
        }
      }
    }

    const headers: Record<string, string> = {};

    if (options?.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const fetchOptions: RequestInit = { method, headers };
    if (options?.body !== undefined) {
      fetchOptions.body = JSON.stringify(options.body);
    }
    if (signal) {
      fetchOptions.signal = signal;
    }

    const resolvedUrl = url.toString();

    let response: Response;
    try {
      response = await fetch(resolvedUrl, fetchOptions);
    } catch (error) {
      const reason =
        error instanceof TypeError &&
        (error.message === "Failed to fetch" || error.message === "Load failed")
          ? " (connection refused, unreachable, or CORS blocked)"
          : error instanceof DOMException && error.name === "AbortError"
            ? " (request timed out or was cancelled)"
            : error instanceof Error
              ? ` (${error.message})`
              : "";
      throw new SdkError(`${method} ${resolvedUrl} failed${reason}`, error);
    }

    if (!response.ok) {
      const parsed = await this.parseError(response, resolvedUrl);
      throw parsed;
    }

    const text = await response.text();
    if (!text) {
      return undefined as T;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new SdkError(
        `Failed to parse response: ${text.slice(0, 100)}`,
        error,
      );
    }

    if (options?.responseSchema) {
      const result = options.responseSchema.safeParse(parsed);
      if (!result.success) {
        const issues =
          result.error?.issues
            ?.map((i: { message: string }) => i.message)
            .join(", ") ?? "unknown";
        throw new SdkError(
          `Response validation failed: ${issues}`,
          result.error,
        );
      }
      return result.data as T;
    }

    return parsed as T;
  }

  private async parseError(
    response: Response,
    resolvedUrl: string,
  ): Promise<ApiError> {
    let code = "unknown";
    let message = `${response.status} ${response.statusText} from ${resolvedUrl}`;
    let details: unknown;
    let requestId: string | undefined;
    let recoverable: boolean | undefined;

    try {
      const body = await response.json();
      const parsed = ErrorEnvelope.safeParse(body);
      if (parsed.success) {
        code = parsed.data.error.code;
        message = parsed.data.error.message;
        details = parsed.data.error.details;
        requestId = parsed.data.error.requestId;
        recoverable = parsed.data.error.recoverable;
      }
    } catch {
      // body not parseable as error envelope
    }

    return new ApiError(
      code,
      message,
      response.status,
      requestId,
      recoverable,
      details,
    );
  }
}
