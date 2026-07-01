# 📐 @agent-workbench/diff

[![Status](https://img.shields.io/badge/status-complete-brightgreen)]()
[![Phase](https://img.shields.io/badge/Phase-9-blue)]()

Patch preview, patch apply/revert, file snapshots, and file dry-run support.

## Status

**Complete** — Phase 9. Diff preview generation, patch application, mutation revert, and file content hashing all implemented.

## Purpose

Provides safe file mutation through diff-first operations. Every mutation generates a preview before application, supports rollback via content hashing.

## Key Modules

| Module | Export | Responsibility |
|--------|--------|---------------|
| `preview` | `generateDiffPreview`, `extractDiffParams` | Unified diff generation and parameter extraction |
| `apply` | `applyMutation`, `canApplyPatch` | Patch application with safety checks |
| `revert` | `revertMutation`, `contentHash` | Rollback mutations via stored content hashes |

## Types

```typescript
export type {
  DiffParams,             // Parameters for diff generation
  WriteDiffParams,        // Write operation diff params
  EditDiffParams,         // Edit operation diff params
  ApplyPatchDiffParams,   // Patch application params
  ApplyResult,            // Patch application result
  ApplyError,             // Patch application error
  RevertResult,           // Revert result
  RevertError,            // Revert error
  RevertInput,            // Revert parameters
  CanApplyResult,         // Pre-apply safety check
} from "@agent-workbench/diff";
```

## Usage

```typescript
import { generateDiffPreview, applyMutation } from "@agent-workbench/diff";

const preview = generateDiffPreview({
  type: "edit",
  filePath: "./src/index.ts",
  oldString: "function old()",
  newString: "function new()",
});

const result = applyMutation({
  type: "write",
  filePath: "./src/new-file.ts",
  content: "export const greeting = 'hello';",
});
```

## Commands

```bash
bun run typecheck
bun run build
```

## Boundary

Does **not** own: tool definitions, permission policy, runtime orchestration, storage, TUI rendering.

👉 See [`docs/14_DRY_RUN_MODEL.md`](../docs/14_DRY_RUN_MODEL.md)
