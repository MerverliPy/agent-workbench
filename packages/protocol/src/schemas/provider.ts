import { z } from "zod/v4";

export const ProviderStatus = z.enum(["connected", "disconnected", "error"]);
export type ProviderStatus = z.infer<typeof ProviderStatus>;

export const ModelProvider = z.object({
  id: z.string(),
  name: z.string(),
  status: ProviderStatus,
  description: z.string().optional(),
});
export type ModelProvider = z.infer<typeof ModelProvider>;

export const Model = z.object({
  id: z.string(),
  providerId: z.string(),
  name: z.string(),
  capabilities: z.array(z.string()).optional(),
  contextLimit: z.number().int().nonnegative().optional(),
});
export type Model = z.infer<typeof Model>;
