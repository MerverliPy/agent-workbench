import type { HttpTransport } from "../transport/http";
import {
  PrefillPromptRoute,
  FocusRoute,
  GetTuiStateRoute,
} from "@agent-workbench/protocol";
import type { PrefillPromptRequest, TuiFocusRequest } from "@agent-workbench/protocol";

export class TuiResource {
  constructor(private transport: HttpTransport) {}

  async prefillPrompt(data: PrefillPromptRequest, signal?: AbortSignal): Promise<{ ok: boolean }> {
    return this.transport.request(
      PrefillPromptRoute.method,
      PrefillPromptRoute.path,
      { body: data },
      signal,
    );
  }

  async focus(data: TuiFocusRequest, signal?: AbortSignal): Promise<{ ok: boolean }> {
    return this.transport.request(
      FocusRoute.method,
      FocusRoute.path,
      { body: data },
      signal,
    );
  }

  async getState(signal?: AbortSignal): Promise<{ state: Record<string, unknown> }> {
    return this.transport.request(
      GetTuiStateRoute.method,
      GetTuiStateRoute.path,
      undefined,
      signal,
    );
  }
}
