import type { z } from "zod/v4";
import type { HttpTransport } from "../transport/http";
import { CreateTokenRoute, GetAuthStatusRoute } from "@agent-workbench/protocol";
import type { InferRouteResponse } from "@agent-workbench/protocol";

export class AuthResource {
  constructor(private transport: HttpTransport) {}

  async createToken(data: z.infer<typeof CreateTokenRoute.body>, signal?: AbortSignal): Promise<InferRouteResponse<typeof CreateTokenRoute>> {
    return this.transport.request(
      CreateTokenRoute.method,
      CreateTokenRoute.path,
      { body: data, responseSchema: CreateTokenRoute.response },
      signal,
    );
  }

  async getStatus(signal?: AbortSignal): Promise<InferRouteResponse<typeof GetAuthStatusRoute>> {
    return this.transport.request(
      GetAuthStatusRoute.method,
      GetAuthStatusRoute.path,
      { responseSchema: GetAuthStatusRoute.response },
      signal,
    );
  }
}
