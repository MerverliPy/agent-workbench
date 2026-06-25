import { z } from "zod/v4";

const ULID_PATTERN = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

export const Ulid = z.string().regex(ULID_PATTERN, "Must be a valid ULID");
export type Ulid = z.infer<typeof Ulid>;

export const Timestamp = z.string().datetime({ offset: true });
export type Timestamp = z.infer<typeof Timestamp>;

export const Pagination = z.object({
  cursor: Ulid.optional(),
  limit: z.number().int().min(1).max(100).default(50),
});
export type Pagination = z.infer<typeof Pagination>;

export const PaginatedResponse = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    nextCursor: Ulid.optional(),
    total: z.number().int().nonnegative().optional(),
  });
