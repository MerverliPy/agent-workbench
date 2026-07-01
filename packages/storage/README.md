# 🗄️ @agent-workbench/storage

[![Status](https://img.shields.io/badge/status-complete-brightgreen)]()
[![Phase](https://img.shields.io/badge/Phase-5-blue)]()

SQLite/Drizzle schema, migrations, and repositories for local durable state.

## Status

**Complete** — Phase 5. Full schema with 10 tables, 9 repositories, migration support.

## Purpose

SQLite/Drizzle persistence layer. Provides schema definitions, migrations, and typed repositories for all local durable state.

## Stack

- **SQLite** via `bun:sqlite` (zero native deps beyond Bun)
- **Drizzle ORM** (`drizzle-orm/bun-sqlite`) for schema and queries
- **Drizzle Kit** for deterministic migration generation

## Default DB Path

Respects `XDG_DATA_HOME` when set. Falls back to:

```
$HOME/.local/share/agent-workbench/workbench.db
```

An explicit path can be passed via `createStorageConnection({ dbPath })`.

## Schema

10 tables covering the Phase 5 exit gate:

| Table | Purpose |
|-------|---------|
| `sessions` | Session identity and lifecycle |
| `messages` | User, assistant, system, tool, summary messages |
| `tool_calls` | Tool invocation requests and results |
| `permission_requests` | Ask-gated permission requests |
| `permission_decisions` | Approval or denial decisions |
| `run_ledger` | Audit trail for runtime events |
| `file_changes` | File mutation metadata |
| `config_snapshots` | Redacted config at run boundaries |
| `summaries` | Session, run, tool-result, compaction summaries |
| `cache_entries` | Read/grep/glob cache entries |

Provider auth (`provider_auth`) is deferred to a later phase.

## Conventions

- ULID text primary keys
- ISO-8601 text timestamps
- JSON stored as text columns (`metadataJson`, `inputJson`, etc.)
- No plaintext secrets stored
- Ledger is append-only (create/list, no update/delete)

## Commands

```bash
# Typecheck
bun run typecheck

# Build
bun run build

# Generate migration from schema
bun run db:generate

# Run pending migrations against default DB
bun run db:migrate
```

## Public API

```typescript
import {
  createStorageConnection,
  defaultDbPath,
  runMigrations,
  SessionRepository,
  MessageRepository,
  ToolCallRepository,
  PermissionRepository,
  LedgerRepository,
  FileChangeRepository,
  ConfigSnapshotRepository,
  SummaryRepository,
  CacheRepository,
} from "@agent-workbench/storage";
```

## Usage

```typescript
import { createStorageConnection, runMigrations } from "@agent-workbench/storage";

const db = createStorageConnection({ dbPath: "./workbench.db" });
await runMigrations(db);

const sessions = new SessionRepository(db);
const session = await sessions.create({ name: "My Session" });
```

## Scope Guard

Storage does **not** own:

- Core runtime orchestration
- Tool execution
- Shell execution
- Model adapters
- TUI rendering
- Permission policy decisions
- Diff application
- Token-health runtime
- Any plaintext secret storage

## Deferred

- `runs` table (protocol defines Run type; not in Phase 5 data model)
- `provider_auth` table (not in Phase 5 exit gate; requires encryption)
- Migration rollback policy
- Test infrastructure

👉 See [`docs/08_DATA_MODEL_PLAN.md`](../docs/08_DATA_MODEL_PLAN.md), [`docs/05_PERMISSION_MODEL.md`](../docs/05_PERMISSION_MODEL.md)
