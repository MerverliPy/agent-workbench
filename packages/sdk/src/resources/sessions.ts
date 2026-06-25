import type { HttpTransport } from "../transport/http";
import {
  CreateSessionRoute,
  ListSessionsRoute,
  GetSessionRoute,
  UpdateSessionRoute,
  AbortSessionRoute,
  SummarizeSessionRoute,
  DeleteSessionRoute,
} from "@agent-workbench/protocol";
import type {
  Session,
  CreateSessionRequest,
  UpdateSessionRequest,
  Ulid,
} from "@agent-workbench/protocol";

function toParams(record: Record<string, unknown>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(record)) {
    out[key] = value === undefined ? undefined : String(value);
  }
  return out;
}

export class SessionResource {
  constructor(private transport: HttpTransport) {}

  async create(data: CreateSessionRequest, signal?: AbortSignal): Promise<Session> {
    return this.transport.request<Session>(
      CreateSessionRoute.method,
      CreateSessionRoute.path,
      { body: data },
      signal,
    );
  }

  async list(
    params?: { status?: string; projectPath?: string; cursor?: string; limit?: number },
    signal?: AbortSignal,
  ): Promise<{ items: Session[]; nextCursor?: Ulid }> {
    return this.transport.request(
      ListSessionsRoute.method,
      ListSessionsRoute.path,
      params ? { params: toParams(params as Record<string, unknown>) } : undefined,
      signal,
    );
  }

  async get(sessionId: string, signal?: AbortSignal): Promise<Session> {
    return this.transport.request<Session>(
      GetSessionRoute.method,
      GetSessionRoute.path.replace(":sessionId", sessionId),
      undefined,
      signal,
    );
  }

  async update(sessionId: string, data: UpdateSessionRequest, signal?: AbortSignal): Promise<Session> {
    return this.transport.request<Session>(
      UpdateSessionRoute.method,
      UpdateSessionRoute.path.replace(":sessionId", sessionId),
      { body: data },
      signal,
    );
  }

  async abort(sessionId: string, signal?: AbortSignal): Promise<Session> {
    return this.transport.request<Session>(
      AbortSessionRoute.method,
      AbortSessionRoute.path.replace(":sessionId", sessionId),
      undefined,
      signal,
    );
  }

  async summarize(sessionId: string, signal?: AbortSignal): Promise<{ summary: string }> {
    return this.transport.request<{ summary: string }>(
      SummarizeSessionRoute.method,
      SummarizeSessionRoute.path.replace(":sessionId", sessionId),
      undefined,
      signal,
    );
  }

  async delete(sessionId: string, signal?: AbortSignal): Promise<{ deleted: boolean }> {
    return this.transport.request<{ deleted: boolean }>(
      DeleteSessionRoute.method,
      DeleteSessionRoute.path.replace(":sessionId", sessionId),
      undefined,
      signal,
    );
  }
}
