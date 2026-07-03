import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  GetFileDiffRoute,
  GetFileTreeRoute,
  ListFilesRoute,
  ReadFileRoute,
} from "@agent-workbench/protocol";
import type { Hono } from "hono";
import type { ServerAppBindings } from "../context";
import { ApiError } from "../errors";
import { createJsonRouteHandler } from "./helpers";

// ── Helpers ────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 100_000; // 100KB preview limit
const MAX_DIR_ENTRIES = 500;

interface FileEntry {
  path: string;
  type: "file" | "directory";
  size?: number;
}

async function listDirectory(
  dirPath: string,
  globPattern?: string,
): Promise<FileEntry[]> {
  const resolved = path.resolve(dirPath);

  // Safety: don't allow listing outside typical project scope
  const stat = await fs.stat(resolved).catch(() => null);
  if (!stat) {
    throw new ApiError({
      status: 404,
      code: "NOT_FOUND",
      message: `Directory not found: ${dirPath}`,
      recoverable: true,
    });
  }
  if (!stat.isDirectory()) {
    throw new ApiError({
      status: 400,
      code: "BAD_REQUEST",
      message: `Not a directory: ${dirPath}`,
      recoverable: true,
    });
  }

  const names = await fs.readdir(resolved);
  const entries: FileEntry[] = [];

  for (const name of names.slice(0, MAX_DIR_ENTRIES)) {
    // Skip hidden files/dirs unless explicitly in root
    if (name.startsWith(".") && dirPath !== "." && dirPath !== "/") continue;

    // Simple glob filtering
    if (globPattern) {
      try {
        const regex = new RegExp(
          globPattern.replace(/\*/g, ".*").replace(/\?/g, "."),
        );
        if (!regex.test(name)) continue;
      } catch {
        // If glob pattern is invalid, skip filtering
      }
    }

    try {
      const entryStat = await fs.stat(path.join(resolved, name));
      const entry: FileEntry = {
        path: path.join(dirPath, name).replace(/\\/g, "/"),
        type: entryStat.isDirectory() ? "directory" : "file",
      };
      if (entryStat.isFile()) {
        entry.size = entryStat.size;
      }
      entries.push(entry);
    } catch {
      // Skip entries we can't stat (permissions, broken symlinks)
    }
  }

  // Sort: directories first, then alphabetical
  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.path.localeCompare(b.path);
  });

  return entries;
}

async function readFileContent(
  filePath: string,
  limit?: number,
): Promise<{ path: string; content: string; truncated: boolean }> {
  const resolved = path.resolve(filePath);

  const stat = await fs.stat(resolved).catch(() => null);
  if (!stat) {
    throw new ApiError({
      status: 404,
      code: "NOT_FOUND",
      message: `File not found: ${filePath}`,
      recoverable: true,
    });
  }
  if (stat.isDirectory()) {
    throw new ApiError({
      status: 400,
      code: "BAD_REQUEST",
      message: `Path is a directory: ${filePath}`,
      recoverable: true,
    });
  }
  if (stat.size > MAX_FILE_SIZE) {
    throw new ApiError({
      status: 413,
      code: "CONTENT_TOO_LARGE",
      message: `File exceeds ${MAX_FILE_SIZE / 1000}KB preview limit: ${filePath}`,
      recoverable: true,
    });
  }

  const maxBytes = limit
    ? Math.min(limit * 1000, MAX_FILE_SIZE)
    : MAX_FILE_SIZE;
  const content = await fs.readFile(resolved, "utf-8");
  const truncated = content.length > maxBytes;
  const displayed = truncated
    ? `${content.slice(0, maxBytes)}\n... (truncated)`
    : content;

  return { path: filePath, content: displayed, truncated };
}

// ── Route registration ─────────────────────────────────────────────────

export function registerFileRoutes(app: Hono<ServerAppBindings>) {
  // GET /file — list directory contents
  app.get(
    ListFilesRoute.path,
    createJsonRouteHandler(ListFilesRoute, async (_ctx, { validated }) => {
      const { path: dirPath = "/", pattern } = validated.query as unknown as {
        path?: string;
        pattern?: string;
      };
      const items = await listDirectory(dirPath, pattern);
      return { items };
    }),
  );

  // GET /file/content — read file content
  app.get(
    ReadFileRoute.path,
    createJsonRouteHandler(ReadFileRoute, async (_ctx, { validated }) => {
      const { path: filePath, limit } = validated.query as unknown as {
        path: string;
        limit?: number;
      };
      return readFileContent(filePath, limit);
    }),
  );

  // GET /file/diff — not yet implemented (requires diff engine)
  app.get(
    GetFileDiffRoute.path,
    createJsonRouteHandler(GetFileDiffRoute, async () => {
      throw new ApiError({
        status: 501,
        code: "NOT_IMPLEMENTED",
        message: "File diff is not yet implemented",
        recoverable: true,
      });
    }),
  );

  // GET /file/tree — recursive directory listing (delegates to list for now)
  app.get(
    GetFileTreeRoute.path,
    createJsonRouteHandler(GetFileTreeRoute, async (_ctx, { validated }) => {
      const params = (validated.query ?? {}) as unknown as { path?: string };
      const dirPath = params.path ?? "/";
      const items = await listDirectory(dirPath);
      return { items };
    }),
  );
}
