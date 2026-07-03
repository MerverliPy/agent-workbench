import { z } from "zod/v4";
import { ErrorEnvelope } from "../schemas/error-envelope";
import {
  ProviderProfile,
  ProviderProfileInput,
} from "../schemas/provider-profile";

/**
 * GET /marketplace/providers — list all provider profiles.
 */
export const ListProviderProfilesRoute = {
  method: "GET" as const,
  path: "/marketplace/providers",
  response: z.object({ items: z.array(ProviderProfile) }),
  errors: [ErrorEnvelope],
} as const;

/**
 * GET /marketplace/providers/:id — get a single provider profile.
 */
export const GetProviderProfileRoute = {
  method: "GET" as const,
  path: "/marketplace/providers/:id",
  pathParams: z.object({ id: z.string().min(1) }),
  response: ProviderProfile,
  errors: [ErrorEnvelope],
} as const;

/**
 * POST /marketplace/providers — create a new provider profile.
 */
export const CreateProviderProfileRoute = {
  method: "POST" as const,
  path: "/marketplace/providers",
  body: ProviderProfileInput,
  response: ProviderProfile,
  errors: [ErrorEnvelope],
} as const;

/**
 * PATCH /marketplace/providers/:id — update an existing provider profile.
 */
export const UpdateProviderProfileRoute = {
  method: "PATCH" as const,
  path: "/marketplace/providers/:id",
  pathParams: z.object({ id: z.string().min(1) }),
  body: ProviderProfileInput.partial(),
  response: ProviderProfile,
  errors: [ErrorEnvelope],
} as const;

/**
 * DELETE /marketplace/providers/:id — remove a provider profile.
 */
export const DeleteProviderProfileRoute = {
  method: "DELETE" as const,
  path: "/marketplace/providers/:id",
  pathParams: z.object({ id: z.string().min(1) }),
  response: z.object({ deleted: z.boolean() }),
  errors: [ErrorEnvelope],
} as const;

/**
 * POST /marketplace/providers/:id/test — test a provider connection.
 */
export const TestProviderConnectionRoute = {
  method: "POST" as const,
  path: "/marketplace/providers/:id/test",
  pathParams: z.object({ id: z.string().min(1) }),
  response: z.object({
    ok: z.boolean(),
    latencyMs: z.number().nonnegative().optional(),
    error: z.string().optional(),
  }),
  errors: [ErrorEnvelope],
} as const;

/**
 * GET /marketplace/cost/session/:sessionId — cost summary for a session.
 */
export const GetSessionCostRoute = {
  method: "GET" as const,
  path: "/marketplace/cost/session/:sessionId",
  pathParams: z.object({ sessionId: z.string().min(1) }),
  response: z.object({
    totalCost: z.number().nonnegative(),
    records: z.array(z.any()),
  }),
  errors: [ErrorEnvelope],
} as const;
