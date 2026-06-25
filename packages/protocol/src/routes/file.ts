import { z } from "zod/v4";
import { ErrorEnvelope } from "../schemas/error-envelope";
import { FileContent, FileEntry, DiffPreview } from "../schemas/file";

export const FileContentParams = z.object({
  path: z.string(),
  limit: z.coerce.number().int().positive().optional(),
});

export const FileListParams = z.object({
  path: z.string().optional(),
  pattern: z.string().optional(),
});

export const FileDiffParams = z.object({
  path: z.string(),
  targetPath: z.string().optional(),
});

export const ListFilesRoute = {
  method: "GET" as const,
  path: "/file",
  query: FileListParams,
  response: z.object({ items: z.array(FileEntry) }),
  errors: [ErrorEnvelope],
} as const;

export const ReadFileRoute = {
  method: "GET" as const,
  path: "/file/content",
  query: FileContentParams,
  response: FileContent,
  errors: [ErrorEnvelope],
} as const;

export const GetFileDiffRoute = {
  method: "GET" as const,
  path: "/file/diff",
  query: FileDiffParams,
  response: DiffPreview,
  errors: [ErrorEnvelope],
} as const;

export const GetFileTreeRoute = {
  method: "GET" as const,
  path: "/file/tree",
  query: z.object({ path: z.string().optional() }).optional(),
  response: z.object({ items: z.array(FileEntry) }),
  errors: [ErrorEnvelope],
} as const;
