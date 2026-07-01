# 🖥️ @agent-workbench/cli

[![Status](https://img.shields.io/badge/status-scaffold-yellow)]()
[![Phase](https://img.shields.io/badge/Phase-1-lightgrey)]()

CLI entrypoint package. Owns process startup and command routing only.

## Status

**Scaffold** — Phase 1. Package structure only. No runtime implementation yet.

## Purpose

Will provide the terminal CLI entry point for headless/non-TUI usage of the agent-workbench runtime.

## Current Rules

- This package is scaffold-only.
- `src/.gitkeep` exists only to preserve the folder.
- No runtime implementation logic has been added.
- Do not add implementation code until the phase checklist allows it.

## Boundary

Does **not** own: TUI rendering, server startup, core runtime, storage, tools, permissions.

👉 See [`docs/03_BACKEND_FRONTEND_BOUNDARY.md`](../docs/03_BACKEND_FRONTEND_BOUNDARY.md), [`docs/18_PHASE_EXIT_GATES.md`](../docs/18_PHASE_EXIT_GATES.md), [`docs/19_TARGET_REPO_TREE.md`](../docs/19_TARGET_REPO_TREE.md)
