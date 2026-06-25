import type { HttpTransport } from "../transport/http";
import { CreateTokenRoute, GetAuthStatusRoute } from "@agent-workbench/protocol";
import type { AuthTokenRequest, AuthTokenResponse } from "@agent-workbench/protocol";

export class AuthResource {
  constructor(private transport: HttpTransport) {}

  async createToken(data: AuthTokenRequest, signal?: AbortSignal): Promise<AuthTokenResponse> {
    return this.transport.request<AuthTokenResponse>(
      CreateTokenRoute.method,
      CreateTokenRoute.path,
      { body: data },
      signal,
    );
  }

  async getStatus(signal?: AbortSignal): Promise<{ authenticated: boolean; method?: string }> {
    return this.transport.request(
      GetAuthStatusRoute.method,
      GetAuthStatusRoute.path,
      undefined,
      signal,
    );
  }
}
