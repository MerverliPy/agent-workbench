import { z } from "zod/v4";
import { ErrorEnvelope } from "../schemas/error-envelope";

export const PrefillPromptRequest = z.object({
  text: z.string(),
});
export type PrefillPromptRequest = z.infer<typeof PrefillPromptRequest>;

export const TuiFocusRequest = z.object({
  panel: z.string(),
});
export type TuiFocusRequest = z.infer<typeof TuiFocusRequest>;

export const PrefillPromptRoute = {
  method: "POST" as const,
  path: "/tui/prompt/prefill",
  body: PrefillPromptRequest,
  response: z.object({ ok: z.boolean() }),
  errors: [ErrorEnvelope],
} as const;

export const FocusRoute = {
  method: "POST" as const,
  path: "/tui/focus",
  body: TuiFocusRequest,
  response: z.object({ ok: z.boolean() }),
  errors: [ErrorEnvelope],
} as const;

export const GetTuiStateRoute = {
  method: "GET" as const,
  path: "/tui/state",
  response: z.object({ state: z.record(z.string(), z.unknown()) }),
  errors: [ErrorEnvelope],
} as const;
