import type { z } from "zod/v4";
import type { HttpTransport } from "../transport/http";
import {
  ListPlansRoute,
  GetPlanRoute,
  DecidePlanRoute,
} from "@agent-workbench/protocol";
import type { InferRouteResponse } from "@agent-workbench/protocol";

export class PlanResource {
  constructor(private readonly transport: HttpTransport) {}

  async list(
    sessionId: string,
    signal?: AbortSignal
  ): Promise<InferRouteResponse<typeof ListPlansRoute>> {
    const path = ListPlansRoute.path.replace(":sessionId", sessionId);
    return this.transport.request(
      ListPlansRoute.method,
      path,
      { responseSchema: ListPlansRoute.response },
      signal
    );
  }

  async get(
    sessionId: string,
    planId: string,
    signal?: AbortSignal
  ): Promise<InferRouteResponse<typeof GetPlanRoute>> {
    const path = GetPlanRoute.path
      .replace(":sessionId", sessionId)
      .replace(":planId", planId);
    return this.transport.request(
      GetPlanRoute.method,
      path,
      { responseSchema: GetPlanRoute.response },
      signal
    );
  }

  async decide(
    sessionId: string,
    planId: string,
    data: z.infer<typeof DecidePlanRoute.body>,
    signal?: AbortSignal
  ): Promise<InferRouteResponse<typeof DecidePlanRoute>> {
    const path = DecidePlanRoute.path
      .replace(":sessionId", sessionId)
      .replace(":planId", planId);
    return this.transport.request(
      DecidePlanRoute.method,
      path,
      { body: data, responseSchema: DecidePlanRoute.response },
      signal
    );
  }
}
