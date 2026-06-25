import { z } from "zod/v4";

export const Config = z.object({
  projectPath: z.string().optional(),
  defaultProvider: z.string().optional(),
  defaultModel: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  agent: z.string().optional(),
  permissions: z
    .object({
      read: z.enum(["allow", "ask", "deny"]).optional(),
      write: z.enum(["allow", "ask", "deny"]).optional(),
      edit: z.enum(["allow", "ask", "deny"]).optional(),
      bash: z.enum(["allow", "ask", "deny"]).optional(),
      destructive: z.enum(["allow", "ask", "deny"]).optional(),
    })
    .optional(),
  server: z
    .object({
      host: z.string().optional(),
      port: z.number().int().min(1).max(65535).optional(),
    })
    .optional(),
});
export type Config = z.infer<typeof Config>;
