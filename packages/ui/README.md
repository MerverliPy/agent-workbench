# 🎨 @agent-workbench/ui

[![Status](https://img.shields.io/badge/status-scaffold-yellow)]()
[![Phase](https://img.shields.io/badge/Phase-1-lightgrey)]()

Shared display formatting, theme tokens, and non-authoritative UI helpers.

## Status

**Scaffold** — Phase 1. Package structure only. No runtime implementation yet.

## Purpose

Will provide shared UI primitives, theme tokens, and display formatting utilities used by the TUI and CLI apps.

## Current Rules

- This package is scaffold-only.
- `src/.gitkeep` exists only to preserve the folder.
- No runtime implementation logic has been added.
- Do not add implementation code until the phase checklist allows it.

## Boundary

Does **not** own: TUI rendering (apps/tui), CLI rendering (apps/cli), any runtime logic.

👉 See [`docs/03_BACKEND_FRONTEND_BOUNDARY.md`](../docs/03_BACKEND_FRONTEND_BOUNDARY.md), [`docs/18_PHASE_EXIT_GATES.md`](../docs/18_PHASE_EXIT_GATES.md)
