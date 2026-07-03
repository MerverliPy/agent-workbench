# @agent-workbench/eval

Model experimentation and evaluation framework. Provides integration adapters for external evaluation tools, benchmarking harnesses, and the ModelPlayground for one-shot chat across multiple providers.

## Usage

```typescript
import { ModelPlayground, EvalAdapter } from "@agent-workbench/eval";

const playground = new ModelPlayground({ providers });
const result = await playground.chat("What is 2+2?", { model: "deepseek-v4-pro" });
```

## Scope

- Integration adapters for lm-evaluation-harness and other eval tools
- ModelPlayground: one-shot chat across providers
- Metrics collection and export
- Benchmark runner integration
- Part of Phase 29 (model experimentation & evaluation)
