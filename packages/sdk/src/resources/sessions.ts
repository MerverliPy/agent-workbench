import type { InferRouteResponse } from "@agent-workbench/protocol";
import {
  AbortSessionRoute,
  CreateSessionRoute,
  DeleteSessionRoute,
  GetSessionRoute,
  ListSessionsRoute,
  SummarizeSessionRoute,
  UpdateSessionRoute,
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

export class SessionResource {
  constructor(private transport: HttpTransport) {}

  async create(
    data: z.infer<typeof CreateSessionRoute.body>,
    signal?: AbortSignal,
  ): Promise<InferRouteResponse<typeof CreateSessionRoute>> {
    return this.transport.request(
      CreateSessionRoute.method,
      CreateSessionRoute.path,
      { body: data, responseSchema: CreateSessionRoute.response },
      signal,
    );
  }

  async list(
    params?: {
      status?: string;
      projectPath?: string;
      cursor?: string;
      limit?: number;
    },
    signal?: AbortSignal,
  ): Promise<InferRouteResponse<typeof ListSessionsRoute>> {
    return this.transport.request(
      ListSessionsRoute.method,
      ListSessionsRoute.path,
      params
        ? {
            params: toParams(params as Record<string, unknown>),
            responseSchema: ListSessionsRoute.response,
          }
        : { responseSchema: ListSessionsRoute.response },
      signal,
    );
  }

  async get(
    sessionId: string,
    signal?: AbortSignal,
  ): Promise<InferRouteResponse<typeof GetSessionRoute>> {
    return this.transport.request(
      GetSessionRoute.method,
      GetSessionRoute.path.replace(":sessionId", sessionId),
      { responseSchema: GetSessionRoute.response },
      signal,
    );
  }

  async update(
    sessionId: string,
    data: z.infer<typeof UpdateSessionRoute.body>,
    signal?: AbortSignal,
  ): Promise<InferRouteResponse<typeof UpdateSessionRoute>> {
    return this.transport.request(
      UpdateSessionRoute.method,
      UpdateSessionRoute.path.replace(":sessionId", sessionId),
      { body: data, responseSchema: UpdateSessionRoute.response },
      signal,
    );
  }

  async abort(
    sessionId: string,
    signal?: AbortSignal,
  ): Promise<InferRouteResponse<typeof AbortSessionRoute>> {
    return this.transport.request(
      AbortSessionRoute.method,
      AbortSessionRoute.path.replace(":sessionId", sessionId),
      { responseSchema: AbortSessionRoute.response },
      signal,
    );
  }

  async summarize(
    sessionId: string,
    signal?: AbortSignal,
  ): Promise<InferRouteResponse<typeof SummarizeSessionRoute>> {
    return this.transport.request(
      SummarizeSessionRoute.method,
      SummarizeSessionRoute.path.replace(":sessionId", sessionId),
      { responseSchema: SummarizeSessionRoute.response },
      signal,
    );
  }

  async delete(
    sessionId: string,
    signal?: AbortSignal,
  ): Promise<InferRouteResponse<typeof DeleteSessionRoute>> {
    return this.transport.request(
      DeleteSessionRoute.method,
      DeleteSessionRoute.path.replace(":sessionId", sessionId),
      { responseSchema: DeleteSessionRoute.response },
      signal,
    );
  }
}
