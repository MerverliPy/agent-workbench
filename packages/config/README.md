# ⚙️ @agent-workbench/config

[![Status](https://img.shields.io/badge/status-scaffold-yellow)]()
[![Phase](https://img.shields.io/badge/Phase-1-lightgrey)]()

Layered config loading, resolution, validation, and secret references.

## Status

**Scaffold** — Phase 1. Package structure only. No runtime implementation yet.

## Purpose

Will provide layered configuration loading, resolution, validation, and secret reference handling.

## Current Rules

- This package is scaffold-only.
- `src/.gitkeep` exists only to preserve the folder.
- No runtime implementation logic has been added.
- Do not add implementation code until the phase checklist allows it.

## Boundary

Does **not** own: model provider config (handled in `packages/models`), server config, storage, runtime orchestration.

👉 See [`docs/03_BACKEND_FRONTEND_BOUNDARY.md`](../docs/03_BACKEND_FRONTEND_BOUNDARY.md), [`docs/18_PHASE_EXIT_GATES.md`](../docs/18_PHASE_EXIT_GATES.md)
