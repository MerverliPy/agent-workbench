import type { HttpTransport } from "../transport/http";
import {
  ListFilesRoute,
  ReadFileRoute,
  GetFileDiffRoute,
  GetFileTreeRoute,
} from "@agent-workbench/protocol";
import type { InferRouteResponse } from "@agent-workbench/protocol";

function toParams(record: Record<string, unknown>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(record)) {
    out[key] = value === undefined ? undefined : String(value);
  }
  return out;
}

export class FileResource {
  constructor(private transport: HttpTransport) {}

  async list(params?: { path?: string; pattern?: string }, signal?: AbortSignal): Promise<InferRouteResponse<typeof ListFilesRoute>> {
    return this.transport.request(
      ListFilesRoute.method,
      ListFilesRoute.path,
      params ? { params: toParams(params as Record<string, unknown>), responseSchema: ListFilesRoute.response } : { responseSchema: ListFilesRoute.response },
      signal,
    );
  }

  async read(params: { path: string; limit?: number }, signal?: AbortSignal): Promise<InferRouteResponse<typeof ReadFileRoute>> {
    return this.transport.request(
      ReadFileRoute.method,
      ReadFileRoute.path,
      { params: toParams(params as Record<string, unknown>), responseSchema: ReadFileRoute.response },
      signal,
    );
  }

  async diff(params: { path: string; targetPath?: string }, signal?: AbortSignal): Promise<InferRouteResponse<typeof GetFileDiffRoute>> {
    return this.transport.request(
      GetFileDiffRoute.method,
      GetFileDiffRoute.path,
      { params: toParams(params as Record<string, unknown>), responseSchema: GetFileDiffRoute.response },
      signal,
    );
  }

  async tree(params?: { path?: string }, signal?: AbortSignal): Promise<InferRouteResponse<typeof GetFileTreeRoute>> {
    return this.transport.request(
      GetFileTreeRoute.method,
      GetFileTreeRoute.path,
      params ? { params: toParams(params as Record<string, unknown>), responseSchema: GetFileTreeRoute.response } : { responseSchema: GetFileTreeRoute.response },
      signal,
    );
  }
}
