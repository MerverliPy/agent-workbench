# 🐚 @agent-workbench/shell

[![Status](https://img.shields.io/badge/status-complete-brightgreen)]()
[![Phase](https://img.shields.io/badge/Phase-10-blue)]()

Simple command runner, command parsing, risk classification, timeout, and abort behavior.

## Status

**Complete** — Phase 10. Provides controlled shell execution through the runtime/tool path.

## Purpose

Owns the mechanics of running shell commands: process spawning, stdout/stderr capture, timeout enforcement, abort handling, output size limits, and secret redaction. Works exclusively through the tool registry — never called directly by the TUI or server routes.

## Key Modules

| Module | Export | Responsibility |
|--------|--------|---------------|
| `SimpleCommandRunner` | `SimpleCommandRunner` | Process lifecycle, timeout, abort, stdout/stderr capture |
| `previewCommand` | `previewCommand` | Static command preview/dry-run metadata |
| `redactSecrets` | `redactSecrets` | API key and secret redaction in output |

## Constants

```typescript
MAX_STDOUT_BYTES    = 1_000_000  // 1MB max stdout
MAX_STDERR_BYTES    = 100_000    // 100KB max stderr
DEFAULT_TIMEOUT_MS  = 30_000     // 30 seconds
MAX_TIMEOUT_MS      = 300_000    // 5 minutes
```

## Types

```typescript
export type {
  ShellRunOptions,     // command, args, timeout, env, cwd
  ShellResult,         // stdout, stderr, exitCode, duration
  CommandPreview,      // dry-run metadata
} from "@agent-workbench/shell";
```

## Usage

```typescript
import { SimpleCommandRunner, previewCommand } from "@agent-workbench/shell";

const runner = new SimpleCommandRunner();

const preview = previewCommand("rm -rf /tmp/build");
// → { riskLevel: "destructive", classifiedAs: "high" }

const result = await runner.run({
  command: "ls -la",
  timeout: 10_000,
  cwd: "/home/user/project",
});
```

## Commands

```bash
bun run typecheck
bun run build
```

## Boundary

Does **not** own: tool definitions, permission policy, TUI rendering, storage, runtime orchestration. Shell execution is invoked through the tools package, never directly.

👉 See [`docs/10_TOOL_RUNTIME_MODEL.md`](../docs/10_TOOL_RUNTIME_MODEL.md)
