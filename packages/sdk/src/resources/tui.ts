import type { z } from "zod/v4";
import type { HttpTransport } from "../transport/http";
import {
  PrefillPromptRoute,
  FocusRoute,
  GetTuiStateRoute,
} from "@agent-workbench/protocol";
import type { InferRouteResponse } from "@agent-workbench/protocol";

export class TuiResource {
  constructor(private transport: HttpTransport) {}

  async prefillPrompt(data: z.infer<typeof PrefillPromptRoute.body>, signal?: AbortSignal): Promise<InferRouteResponse<typeof PrefillPromptRoute>> {
    return this.transport.request(
      PrefillPromptRoute.method,
      PrefillPromptRoute.path,
      { body: data, responseSchema: PrefillPromptRoute.response },
      signal,
    );
  }

  async focus(data: z.infer<typeof FocusRoute.body>, signal?: AbortSignal): Promise<InferRouteResponse<typeof FocusRoute>> {
    return this.transport.request(
      FocusRoute.method,
      FocusRoute.path,
      { body: data, responseSchema: FocusRoute.response },
      signal,
    );
  }

  async getState(signal?: AbortSignal): Promise<InferRouteResponse<typeof GetTuiStateRoute>> {
    return this.transport.request(
      GetTuiStateRoute.method,
      GetTuiStateRoute.path,
      { responseSchema: GetTuiStateRoute.response },
      signal,
    );
  }
}
