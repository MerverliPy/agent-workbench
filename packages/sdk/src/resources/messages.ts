import type { InferRouteResponse } from "@agent-workbench/protocol";
import {
  GetMessageRoute,
  ListMessagesRoute,
  SubmitMessageRoute,
} from "@agent-workbench/protocol";
import type { z } from "zod/v4";
import type { HttpTransport } from "../transport/http";

function toParams(
  record: Record<string, unknown>,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(record)) {
    out[key] = value === undefined ? undefined : String(value);
  }
  return out;
}

export class MessageResource {
  constructor(private transport: HttpTransport) {}

  async submit(
    sessionId: string,
    data: z.infer<typeof SubmitMessageRoute.body>,
    signal?: AbortSignal,
  ): Promise<InferRouteResponse<typeof SubmitMessageRoute>> {
    return this.transport.request(
      SubmitMessageRoute.method,
      SubmitMessageRoute.path.replace(":sessionId", sessionId),
      { body: data, responseSchema: SubmitMessageRoute.response },
      signal,
    );
  }

  async list(
    sessionId: string,
    params?: { role?: string; cursor?: string; limit?: number },
    signal?: AbortSignal,
  ): Promise<InferRouteResponse<typeof ListMessagesRoute>> {
    return this.transport.request(
      ListMessagesRoute.method,
      ListMessagesRoute.path.replace(":sessionId", sessionId),
      params
        ? {
            params: toParams(params as Record<string, unknown>),
            responseSchema: ListMessagesRoute.response,
          }
        : { responseSchema: ListMessagesRoute.response },
      signal,
    );
  }

  async get(
    sessionId: string,
    messageId: string,
    signal?: AbortSignal,
  ): Promise<InferRouteResponse<typeof GetMessageRoute>> {
    return this.transport.request(
      GetMessageRoute.method,
      GetMessageRoute.path
        .replace(":sessionId", sessionId)
        .replace(":messageId", messageId),
      { responseSchema: GetMessageRoute.response },
      signal,
    );
  }
}
