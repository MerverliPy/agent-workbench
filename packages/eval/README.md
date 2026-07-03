# @agent-workbench/eval

Model experimentation and evaluation framework. Provides integration adapters for external evaluation tools, benchmarking harnesses, and the ModelPlayground for one-shot chat across multiple providers.

## Usage

```typescript
import { ModelPlayground, EvalAdapter, MetricsCollector } from "@agent-workbench/eval";

// One-shot chat across providers
const playground = new ModelPlayground({ providers });
const result = await playground.chat("What is 2+2?", {
  model: "deepseek-v4-pro",
  provider: "deepseek"
});

// Collect metrics
const metrics = new MetricsCollector();
metrics.record("response_time_ms", 1234);
const report = metrics.export();
```

## API

| Module | Description |
|--------|-------------|
| `ModelPlayground` | One-shot chat across multiple configured providers |
| `EvalAdapter` | Integration adapter for lm-evaluation-harness |
| `MetricsCollector` | Metrics collection and CSV/JSON export |
| `ComparisonRunner` | Run same prompt across multiple models for comparison |
| `PromptStore` | Manage and version evaluation prompts |

## Scope

- Integration adapters for lm-evaluation-harness and other eval tools
- ModelPlayground: one-shot chat across providers
- Metrics collection and export
- Prompt versioning and management
- Benchmark runner integration

Part of **Phase 29** (model experimentation & evaluation).
