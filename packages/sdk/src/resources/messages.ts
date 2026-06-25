import type { HttpTransport } from "../transport/http";
import {
  SubmitMessageRoute,
  ListMessagesRoute,
  GetMessageRoute,
} from "@agent-workbench/protocol";
import type {
  Message,
  SubmitMessageRequest,
  Ulid,
} from "@agent-workbench/protocol";

function toParams(record: Record<string, unknown>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(record)) {
    out[key] = value === undefined ? undefined : String(value);
  }
  return out;
}

export class MessageResource {
  constructor(private transport: HttpTransport) {}

  async submit(sessionId: string, data: SubmitMessageRequest, signal?: AbortSignal): Promise<Message> {
    return this.transport.request<Message>(
      SubmitMessageRoute.method,
      SubmitMessageRoute.path.replace(":sessionId", sessionId),
      { body: data },
      signal,
    );
  }

  async list(
    sessionId: string,
    params?: { role?: string; cursor?: string; limit?: number },
    signal?: AbortSignal,
  ): Promise<{ items: Message[]; nextCursor?: Ulid }> {
    return this.transport.request(
      ListMessagesRoute.method,
      ListMessagesRoute.path.replace(":sessionId", sessionId),
      params ? { params: toParams(params as Record<string, unknown>) } : undefined,
      signal,
    );
  }

  async get(sessionId: string, messageId: string, signal?: AbortSignal): Promise<Message> {
    return this.transport.request<Message>(
      GetMessageRoute.method,
      GetMessageRoute.path.replace(":sessionId", sessionId).replace(":messageId", messageId),
      undefined,
      signal,
    );
  }
}
