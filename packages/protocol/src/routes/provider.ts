import { z } from "zod/v4";
import { ErrorEnvelope } from "../schemas/error-envelope";
import { ModelProvider, Model } from "../schemas/provider";

export const ProviderIdParams = z.object({
  providerId: z.string().min(1),
});

export const ListProvidersRoute = {
  method: "GET" as const,
  path: "/provider",
  response: z.object({ items: z.array(ModelProvider) }),
  errors: [ErrorEnvelope],
} as const;

export const GetProviderRoute = {
  method: "GET" as const,
  path: "/provider/:providerId",
  pathParams: ProviderIdParams,
  response: ModelProvider,
  errors: [ErrorEnvelope],
} as const;

export const ListProviderModelsRoute = {
  method: "GET" as const,
  path: "/provider/:providerId/model",
  pathParams: ProviderIdParams,
  response: z.object({ items: z.array(Model) }),
  errors: [ErrorEnvelope],
} as const;
