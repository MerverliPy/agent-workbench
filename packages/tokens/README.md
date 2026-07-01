# 📊 @agent-workbench/tokens

[![Status](https://img.shields.io/badge/status-complete-brightgreen)]()
[![Phase](https://img.shields.io/badge/Phase-12-blue)]()

Context budget calculation, truncation, summarization, compaction, and relevance ranking.

## Status

**Complete** — Phase 12. Token counting, budget tracking, compaction support, and truncation all implemented.

## Purpose

Owns token and context window health. Tracks token consumption across sessions, warns when approaching budget limits, supports safe context truncation and compaction.

## Key Modules

| Module | Export | Responsibility |
|--------|--------|---------------|
| `counting` | `estimateTokens`, `estimateTokensFromLength`, `providerReportedTokens` | Token estimation (local + provider-reported) |
| `budget` | `calculateBudget` | Context budget calculation from input |
| `truncation` | `truncateToolOutput` | Safe output truncation |
| `compaction` | `suggestCompaction` | Compaction suggestions for overloaded contexts |

## Types

```typescript
export type {
  TokenHealthLevel,       // "healthy" | "warning" | "critical"
  TokenBudget,            // Budget with limits and current usage
  TokenCountEstimate,     // Estimated token count with method
  TruncationMeta,         // Truncation metadata
  CompactionSuggestion,   // Compaction suggestion output
  ContextBudgetInput,     // Input for budget calculation
  ContextMessageSummary,  // Message summary for context
} from "@agent-workbench/tokens";
```

## Usage

```typescript
import { calculateBudget, estimateTokens, suggestCompaction } from "@agent-workbench/tokens";

const usage = estimateTokens("Hello, world!");
// → { count: 4, method: "approximate" }

const budget = calculateBudget({
  messages: [/* ... */],
  maxContextTokens: 128_000,
});
// → { totalTokens, usedTokens, remaining, healthLevel }

const suggestion = suggestCompaction({
  totalTokens: 150_000,
  maxTokens: 128_000,
  messages: [/* ... */],
});
// → { shouldCompact: true, strategy: "summarize_oldest", ... }
```

## Commands

```bash
bun run typecheck
bun run build
```

## Boundary

Does **not** own: runtime orchestration, storage, TUI rendering, tool execution, model provider calls.

👉 See [`docs/11_TOKEN_HEALTH_MODEL.md`](../docs/11_TOKEN_HEALTH_MODEL.md)
