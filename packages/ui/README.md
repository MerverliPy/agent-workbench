# 🎨 @agent-workbench/ui

[![Status](https://img.shields.io/badge/status-stable-blue)]()
[![Phase](https://img.shields.io/badge/Phase-1-lightgrey)]()

Shared UI primitives, theme tokens, display formatting, and design system constants used by the TUI, mobile-web, and dashboard apps.

## Status

**Stable** — Provides shared constants and formatting utilities consumed by all client applications.

## What's Here

- Design tokens (colors, spacing, typography)
- Formatting helpers (timestamps, file sizes, truncation)
- Shared type definitions for UI components

## Usage

```ts
import { formatTimestamp, truncatePath } from "@agent-workbench/ui";
```

## Boundary

Does **not** own: TUI rendering (apps/tui), mobile-web rendering (apps/mobile-web), dashboard rendering (apps/dashboard), or any runtime logic.
