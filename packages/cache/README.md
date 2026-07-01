# 💾 @agent-workbench/cache

[![Status](https://img.shields.io/badge/status-complete-brightgreen)]()
[![Phase](https://img.shields.io/badge/Phase-7-blue)]()

Session-scoped read/search cache with invalidation on mutation.

## Status

**Complete** — Phase 7. Read/grep/glob cache with automatic invalidation when file mutations occur.

## Purpose

Caches results from read-only tools (read, grep, glob) to avoid redundant I/O. Invalidates affected entries when file mutations are detected.

## Key Modules

| Module | Export | Responsibility |
|--------|--------|---------------|
| `tool-cache` | `ToolCache` | Session-scoped cache with invalidation |

## Usage

```typescript
import { ToolCache } from "@agent-workbench/cache";

const cache = new ToolCache();

// Cache a read operation
cache.set("read:./README.md:1-100", "file content...");

// Check cache
const cached = cache.get("read:./README.md:1-100");

// Invalidate on mutation
cache.invalidatePath("./README.md");
```

## Commands

```bash
bun run typecheck
bun run build
```

## Boundary

Does **not** own: tool definitions, permission policy, runtime orchestration, storage schema.

👉 See [`docs/15_CACHE_MODEL.md`](../docs/15_CACHE_MODEL.md)
