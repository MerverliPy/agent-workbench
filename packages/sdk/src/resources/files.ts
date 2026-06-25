import type { HttpTransport } from "../transport/http";
import {
  ListFilesRoute,
  ReadFileRoute,
  GetFileDiffRoute,
  GetFileTreeRoute,
} from "@agent-workbench/protocol";
import type { FileEntry, FileContent, DiffPreview } from "@agent-workbench/protocol";

function toParams(record: Record<string, unknown>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(record)) {
    out[key] = value === undefined ? undefined : String(value);
  }
  return out;
}

export class FileResource {
  constructor(private transport: HttpTransport) {}

  async list(params?: { path?: string; pattern?: string }, signal?: AbortSignal): Promise<{ items: FileEntry[] }> {
    return this.transport.request(
      ListFilesRoute.method,
      ListFilesRoute.path,
      params ? { params: toParams(params as Record<string, unknown>) } : undefined,
      signal,
    );
  }

  async read(params: { path: string; limit?: number }, signal?: AbortSignal): Promise<FileContent> {
    return this.transport.request<FileContent>(
      ReadFileRoute.method,
      ReadFileRoute.path,
      { params: toParams(params as Record<string, unknown>) },
      signal,
    );
  }

  async diff(params: { path: string; targetPath?: string }, signal?: AbortSignal): Promise<DiffPreview> {
    return this.transport.request<DiffPreview>(
      GetFileDiffRoute.method,
      GetFileDiffRoute.path,
      { params: toParams(params as Record<string, unknown>) },
      signal,
    );
  }

  async tree(params?: { path?: string }, signal?: AbortSignal): Promise<{ items: FileEntry[] }> {
    return this.transport.request(
      GetFileTreeRoute.method,
      GetFileTreeRoute.path,
      params ? { params: toParams(params as Record<string, unknown>) } : undefined,
      signal,
    );
  }
}
