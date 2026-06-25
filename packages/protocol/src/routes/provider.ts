import { z } from "zod/v4";
import { ErrorEnvelope } from "../schemas/error-envelope";
import { ModelProvider, Model } from "../schemas/provider";

export const ListProvidersRoute = {
  method: "GET" as const,
  path: "/provider",
  response: z.object({ items: z.array(ModelProvider) }),
  errors: [ErrorEnvelope],
} as const;

export const GetProviderRoute = {
  method: "GET" as const,
  path: "/provider/:providerId",
  response: ModelProvider,
  errors: [ErrorEnvelope],
} as const;

export const ListProviderModelsRoute = {
  method: "GET" as const,
  path: "/provider/:providerId/model",
  response: z.object({ items: z.array(Model) }),
  errors: [ErrorEnvelope],
} as const;
