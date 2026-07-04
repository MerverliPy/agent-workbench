# 🎨 @agent-workbench/ui

[![Status](https://img.shields.io/badge/status-stable-blue)]()
[![Phase](https://img.shields.io/badge/Phase-1-lightgrey)]()

Shared UI primitives, theme tokens, display formatting, and design system constants used by the TUI, mobile-web, and dashboard apps.

## Status

**Stable** — Provides shared constants and formatting utilities consumed by all client applications.

## What's Here

### Design Tokens

- **Colors**: Primary, secondary, accent, surface, text, error, warning, success, and info color tokens
- **Spacing**: Standard spacing scale (xs, sm, md, lg, xl, 2xl)
- **Typography**: Font families (mono, sans), base sizes, and line-height presets
- **Border radius**: Standard radius presets (none, sm, md, lg, full)

### Formatting Helpers

| Function | Signature | Description |
|----------|-----------|-------------|
| `formatTimestamp` | `(ts: number, format?: 'relative' \| 'absolute' \| 'iso') => string` | Converts epoch ms to human-readable time |
| `formatDuration` | `(ms: number) => string` | Converts milliseconds to "2m 34s" style format |
| `formatFileSize` | `(bytes: number) => string` | Converts bytes to "1.2 MB" style format |
| `truncatePath` | `(path: string, maxLen?: number) => string` | Truncates long file paths with ellipsis |
| `truncateText` | `(text: string, maxLen?: number) => string` | Truncates text at word boundary |
| `pluralize` | `(count: number, singular: string, plural?: string) => string` | Basic English pluralization |

### Shared Type Definitions

- `ThemeColors` — Complete color palette type
- `ThemeSpacing` — Spacing scale type
- `UIMessage` — Generic UI message envelope for cross-app rendering
- `ToastConfig` — Toast notification configuration
- `PanelConfig` — Panel layout configuration

## Usage

```ts
import { formatTimestamp, truncatePath } from "@agent-workbench/ui";
import type { ThemeColors } from "@agent-workbench/ui";

const time = formatTimestamp(Date.now(), "relative"); // "just now"
const path = truncatePath("/home/user/projects/long/path/file.ts", 30); // "…/long/path/file.ts"
```

## Design System Reference

For the complete design system specification including component design tokens, interaction states, motion guidelines, and responsive breakpoints, see [`DESIGN.md`](../../DESIGN.md) at the repository root.

## Boundary

Does **not** own: TUI rendering (apps/tui), mobile-web rendering (apps/mobile-web), dashboard rendering (apps/dashboard), or any runtime logic.
