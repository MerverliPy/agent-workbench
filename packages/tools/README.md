# 🛠️ @agent-workbench/tools

[![Status](https://img.shields.io/badge/status-complete-brightgreen)]()
[![Phase](https://img.shields.io/badge/Phase-7..10-blue)]()

Tool registry and tool definitions — read, grep, glob, write, edit, apply_patch, bash, diff preview, path guard.

## Status

**Complete** — implemented across Phases 7–10. All read-only, mutation, and shell tools are implemented and permission-gated.

## Purpose

Provides the tool registry and all tool definitions. Tools are registered with metadata and executed through the permission-gated runtime. Execution is always permission-gated — the tools package owns definitions, not policy.

## Key Modules

| Module | Export | Responsibility |
|--------|--------|---------------|
| `ToolRegistry` | `ToolRegistry` | Central registry for all tool definitions and executors |
| `read` | `ReadInput`, `ReadResult` | File reading with line/offset control |
| `grep` | `GrepInput`, `GrepResult` | Regex search with excerpt support |
| `glob` | `GlobInput`, `GlobResult` | File pattern matching |
| `write` | — | File writing with diff preview |
| `edit` | — | Targeted string replacement in files |
| `apply-patch` | — | Unified diff application |
| `diff-preview` | — | Preview diffs before applying |
| `bash` | — | Shell command execution |
| `revert-last-change` | — | Rollback last mutation |
| `path-guard` | `PathGuardError`, `isSensitivePath`, `assertSafePath`, `toRelativePath` | Path safety validation |
| `compress` | `truncateLines`, `truncateItems` | Output truncation utilities |
| `mutation-context` | — | Mutation metadata |
| `types` | `ToolExecutor`, `ToolExecutionContext`, `RegisteredTool` | Core type definitions |

## Limits

```typescript
READ_MAX_LINES = 2000
GREP_MAX_MATCHES = 200
GLOB_MAX_PATHS = 200
GREP_EXCERPT_MAX_CHARS = 300
```

## Usage

```typescript
import { ToolRegistry, ReadInput } from "@agent-workbench/tools";

const registry = new ToolRegistry();
await registry.registerBuiltins();

const result = await registry.execute("read", {
  path: "./README.md",
  limit: 100,
});
```

## Commands

```bash
bun run typecheck
bun run build
```

## Boundary

Does **not** own: permission policy, runtime orchestration, shell process lifecycle, storage, TUI rendering.

👉 See [`docs/10_TOOL_RUNTIME_MODEL.md`](../docs/10_TOOL_RUNTIME_MODEL.md), [`docs/09_AGENT_MODEL.md`](../docs/09_AGENT_MODEL.md)
