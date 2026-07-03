import { z } from "zod/v4";
import { Timestamp, Ulid } from "./common";

export const FileReference = z.object({
  path: z.string(),
  hash: z.string().optional(),
  size: z.number().int().nonnegative().optional(),
});
export type FileReference = z.infer<typeof FileReference>;

export const FileContent = z.object({
  path: z.string(),
  content: z.string(),
  hash: z.string().optional(),
  truncated: z.boolean().optional(),
});
export type FileContent = z.infer<typeof FileContent>;

export const DiffPreview = z.object({
  id: Ulid,
  path: z.string(),
  patch: z.string(),
  beforeHash: z.string().optional(),
  afterHash: z.string().optional(),
  linesAdded: z.number().int().nonnegative().optional(),
  linesRemoved: z.number().int().nonnegative().optional(),
  createdAt: Timestamp,
});
export type DiffPreview = z.infer<typeof DiffPreview>;

export const FileEntry = z.object({
  path: z.string(),
  type: z.enum(["file", "directory"]),
  size: z.number().int().nonnegative().optional(),
});
export type FileEntry = z.infer<typeof FileEntry>;
