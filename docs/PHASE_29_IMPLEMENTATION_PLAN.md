# Phase 29 Implementation Plan: Model Experimentation & Evaluation

**Status:** Scaffolding complete — all packages compile cleanly  
**Estimated:** 2 weeks  
**Dependencies:** ✅ Phase 19 (live providers), ✅ Phase 24 (smart routing)  

---

## Overview

Phase 29 delivers built-in model evaluation tools: A/B test prompts across providers, run eval harnesses (MMLU, HumanEval, GSM8K), and track prompt effectiveness over time.

**Key value:** Transform agent-workbench from "just another AI tool" into a disciplined ML experimentation platform with measurement and comparison capabilities.

---

## Exit Gates (10 total)

```text
[ ] Built-in eval runner with standard benchmarks (MMLU, HumanEval, GSM8K)
[ ] A/B test: same prompt → compare outputs across 2+ models
[ ] Prompt versioning with git-backed history
[ ] Cost-per-eval tracking
[ ] Latency percentiles (p50, p95, p99) per model per task type
[ ] Side-by-side diff viewer for model outputs
[ ] Export eval results to CSV/JSON for external analysis
[ ] Model playground: one-shot chat in TUI to test any configured model
[ ] Prompt library: 4+ built-in templates in ~/.agent-workbench/prompts/library/
[ ] Playground supports streaming responses
```

---

## Implementation Phases

### Phase 29.1: Integration Research & Design ✅ COMPLETE (Days 1-2)
- ✅ **Research integration approaches** (lm-evaluation-harness + promptfoo)
- ✅ **promptfoo installed** — `bun add promptfoo` → direct npm import
- ✅ **lm-evaluation-harness installed** — `.venv-lm-eval/bin/pip install lm_eval[api]` → subprocess bridge
- **Design eval data storage** (SQLite schema via @agent-workbench/storage)
- **Design TUI panels** (playground, comparison, results)

### Phase 29.2: Core Infrastructure (Days 3-5)
- **EvalRunner implementation** — delegate to external tools
- **MetricsCollector** — persistence + aggregation
- **Storage migration** — eval tables in SQLite

### Phase 29.3: Model Playground (Days 6-7)
- **ModelPlayground implementation** — one-shot chat
- **TUI playground panel** — model selector, streaming support
- **Provider integration** — leverage existing @agent-workbench/protocol system

### Phase 29.4: Model Comparison (Days 8-9)
- **ModelComparer implementation** — parallel execution
- **Side-by-side diff viewer** — use @agent-workbench/diff
- **TUI comparison panel** — results display

### Phase 29.5: Prompt Library (Days 10-11)
- **PromptStore implementation** — git-backed versioning
- **Built-in prompt templates** — code-review.md, refactor.md, explain.md, test-gen.md
- **Template variable substitution**

### Phase 29.6: Integration & Polish (Days 12-14)
- **Integration with lm-evaluation-harness** — subprocess approach
- **promptfoo integration** — npm dependency
- **Results export** — CSV/JSON for external analysis
- **Documentation** — usage guides, API reference

---

## Technical Architecture

### Package Structure

```
packages/eval/src/
├── index.ts              # Public API exports
├── runner.ts             # EvalRunner — delegates to external tools
├── metrics.ts            # MetricsCollector — persistence + aggregation  
├── comparison.ts         # ModelComparer — parallel A/B testing
├── prompt-store.ts       # PromptStore — git-backed versioning
├── playground.ts         # ModelPlayground — one-shot chat
├── integrations/         # External tool integrations
│   ├── lm-eval.ts        # lm-evaluation-harness subprocess wrapper
│   ├── promptfoo.ts      # promptfoo npm integration
│   └── custom.ts         # User-defined eval scripts
└── storage/              # SQLite persistence layer
    ├── schema.ts         # Drizzle schema for eval tables
    └── queries.ts        # Database operations
```

### Database Schema (via @agent-workbench/storage)

```sql
-- Evaluation runs
eval_runs (
  id TEXT PRIMARY KEY,
  benchmark_id TEXT NOT NULL,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL, -- 'running' | 'completed' | 'failed'
  config JSON NOT NULL, -- EvalRunOptions
  raw_output TEXT
);

-- Individual scores within a run
eval_scores (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES eval_runs(id),
  task TEXT NOT NULL,
  score REAL NOT NULL,
  metric TEXT NOT NULL,
  item_count INTEGER NOT NULL
);

-- Aggregated metrics per run
eval_metrics (
  run_id TEXT PRIMARY KEY REFERENCES eval_runs(id),
  accuracy REAL NOT NULL,
  total_items INTEGER NOT NULL,
  items_passed INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  cost_usd REAL NOT NULL,
  tokens_input INTEGER NOT NULL,
  tokens_output INTEGER NOT NULL,
  latency_p50_ms REAL NOT NULL,
  latency_p95_ms REAL NOT NULL,
  latency_p99_ms REAL NOT NULL,
  error_rate REAL NOT NULL
);

-- Model playground history
playground_runs (
  id TEXT PRIMARY KEY,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  system_prompt TEXT,
  user_message TEXT NOT NULL,
  output TEXT NOT NULL,
  created_at TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  cost_usd REAL NOT NULL,
  tokens_input INTEGER NOT NULL,
  tokens_output INTEGER NOT NULL,
  streamed BOOLEAN NOT NULL DEFAULT FALSE
);

-- Model comparison results
comparison_runs (
  id TEXT PRIMARY KEY,
  prompt TEXT NOT NULL,
  system_prompt TEXT,
  created_at TEXT NOT NULL
);

comparison_results (
  id TEXT PRIMARY KEY,
  comparison_id TEXT NOT NULL REFERENCES comparison_runs(id),
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  output TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  cost_usd REAL NOT NULL,
  tokens_input INTEGER NOT NULL,
  tokens_output INTEGER NOT NULL,
  ranking INTEGER -- 1=best, NULL=unranked
);
```

---

## Integration Strategy (Research Results — Verified)

### promptfoo (Node.js → Direct npm Import) ✅ RECOMMENDED PRIMARY

**Package:** `promptfoo@0.121.17` — LLM eval & testing toolkit (MIT, now part of OpenAI, remains OSS)

**Key API:**
```typescript
import { evaluate, type EvaluateTestSuite, type EvaluateOptions } from 'promptfoo';

// Core function: runs an evaluation
const evalResult = await evaluate(testSuite: EvaluateTestSuite, options?: EvaluateOptions);
// Returns Eval class (id, createdAt, results[], prompts[], config, etc.)
```

**What it provides:**
- A/B testing across multiple models/providers
- Grading functions: matchesLlmRubric, matchesFactuality, matchesSimilarity, matchesClosedQa
- Custom assertions (JavaScript-based grading)
- Output-based eval (not benchmark-based — designed for prompt-level testing)
- Built-in providers for OpenAI, Anthropic, Google, etc.
- Red teaming plugin system

**Why RECOMMENDED as primary integration:**
- Native TypeScript, direct npm dependency
- Clean `evaluate()` API — just import and call
- Already handles provider routing and multi-model comparison
- Narrow scope: prompt-level eval (complements benchmark eval below)

**Approach:**
```typescript
import { evaluate } from 'promptfoo';

export async function runPromptfooEval(suite: EvaluateTestSuite): Promise<Eval> {
  // promptfoo handles: provider routing, parallel execution, scoring, reporting
  return await evaluate(suite, { /* options */ });
}
```

**package.json addition:**
```json
"dependencies": {
  "promptfoo": "^0.121.17"
}
```

### lm-evaluation-harness (Python → Subprocess)

**Package:** `lm-eval==0.4.12` — Standard LLM benchmark framework (MIT, EleutherAI)

**What it provides:**
- Standard ML benchmarks: MMLU, HumanEval, GSM8K, HellaSwag, ARC, etc.
- Task-based evaluation with predefined metrics (accuracy, exact_match)
- Industry-standard: used by model providers for their published results
- Cannot be imported into TypeScript — subprocess only

**Approach:**
```typescript
import { execSync } from 'child_process';
import { tmpdir } from 'os';

export async function runLmEvalHarness(benchmark: string, model: string, provider: string): Promise<RawResults> {
  // 1. Write model config to a temp YAML
  // 2. Run: python -m lm_eval --model <backend> --model_args <config> --tasks <benchmark> --output_path <tmp> --log_samples --write_out
  // 3. Parse JSON results from output_path
  // 4. Map back to our EvalResult format
}
```

**Installation:**
```bash
# User responsibility — documented in README
pip install lm-eval
# Or in a venv:
python3 -m venv ~/.agent-workbench/.venv
~/.agent-workbench/.venv/bin/pip install lm-eval
```

**Comparison with promptfoo:**

| Feature | promptfoo (npm) | lm-eval (pip) |
|---------|----------------|---------------|
| Eval Type | Prompt-level (A/B prompts) | Benchmark-level (standard ML) |
| Integration | Direct import | Subprocess |
| Dependency | TypeScript-native | Python (external) |
| Best for | "Which prompt performs better?" | "Is my model competitive on MMLU?" |
| Metrics | Custom assertions, LLM grading | Standardized (accuracy, exact_match) |
| Parallel | Built-in | Limited |
| Red teaming | ✅ Built-in | ❌ |

**Decision:** Use **both**.
- `promptfoo` for prompt-level A/B testing, comparison, and grading
- `lm-evaluation-harness` for standard benchmark runs (optional, user must install Python deps)
- Our `EvalRunner` class abstracts over both, dispatching to the right backend

---

## TUI Integration

### New TUI Panels

**1. Playground Panel** (`apps/tui/src/panels/playground.tsx`)
- Model dropdown (populated from provider registry)
- System prompt text area
- User message input
- Stream response output
- Token count + cost display

**2. Comparison Panel** (`apps/tui/src/panels/comparison.tsx`)
- Prompt input
- Model selection (2+ models)
- Side-by-side output display
- Diff view toggle
- Export results button

**3. Eval Results Panel** (`apps/tui/src/panels/eval-results.tsx`)
- Benchmark run history
- Metric visualization
- Export to CSV/JSON
- Run comparison table

### Navigation Updates

Add to TUI main menu:
- `E` — Evaluation (opens sub-menu)
  - `P` — Playground
  - `C` — Compare Models
  - `R` — Results
  - `B` — Run Benchmark

---

## Configuration

### ~/.agent-workbench/prompts/library/ Structure

```
~/.agent-workbench/prompts/library/
├── code-review.prompt.md
├── refactor.prompt.md  
├── explain.prompt.md
└── test-gen.prompt.md
```

### Prompt Template Format

```markdown
---
id: code-review
name: Code Review
description: Review code for bugs, style issues, and improvements
version: 1.0.0
category: code-review
---

# Code Review Prompt

Please review the following code for:
- Bugs and potential errors
- Style and formatting issues  
- Performance improvements
- Security concerns
- Best practices violations

## Code to Review

```{{language}}
{{code}}
```

## Context

{{context}}

## Review Focus

{{focus}}

Provide specific, actionable feedback with line number references where applicable.
```

---

## Quality Assurance

### Testing Strategy

**Unit Tests (packages/eval/src/__tests__/)**
- EvalRunner benchmark parsing
- MetricsCollector aggregation logic
- PromptStore template rendering
- ModelComparer parallel execution

**Integration Tests (tests/integration/eval/)**
- lm-eval-harness subprocess integration
- promptfoo npm integration
- SQLite persistence round-trip
- TUI panel rendering

**E2E Tests (tests/e2e/eval/)**
- Full benchmark run workflow
- Model comparison workflow
- Playground usage workflow

### Test Commands

```bash
bun test packages/eval          # Unit tests
bun test tests/integration/eval # Integration tests  
bun test tests/e2e/eval        # E2E tests
```

---

## Deployment & Distribution

### Dependencies Management

**Python (optional):** lm-evaluation-harness requires `pip install lm-eval[all]`
**Node.js:** promptfoo via npm (automatic)

### Documentation Updates

**README.md additions:**
- Evaluation features overview
- Installation instructions (Python setup for lm-eval)
- Usage examples

**New docs:**
- `docs/EVALUATION.md` — comprehensive evaluation guide
- `docs/API_EVAL.md` — API reference for packages/eval

---

## Success Metrics

### Exit Gate Verification

Each exit gate has explicit verification criteria:

| Exit Gate | Verification Command |
|-----------|---------------------|
| Built-in eval runner | `agent-workbench eval run --benchmark mmlu --model gpt-4` |
| A/B testing | `agent-workbench eval compare --prompt "..." --models gpt-4,claude-3` |
| Prompt versioning | `git log ~/.agent-workbench/prompts/library/code-review.prompt.md` |
| Cost tracking | `agent-workbench eval results --show-cost` |
| Latency percentiles | `agent-workbench eval results --show-latency` |
| Diff viewer | TUI comparison panel with diff toggle |
| Export results | `agent-workbench eval export --format csv --output results.csv` |
| Model playground | TUI playground panel with model dropdown |
| Prompt library | 4 templates in `~/.agent-workbench/prompts/library/` |
| Streaming playground | TUI playground with streaming output |

### Performance Benchmarks

- **Playground response time:** < 200ms to first token
- **Comparison parallelization:** N models in ~1x time (not N×)
- **Results export:** 10K eval records → CSV in < 5 seconds
- **TUI responsiveness:** No blocking on eval operations

---

## Risk Mitigation

### Technical Risks

| Risk | Mitigation |
|------|------------|
| lm-eval-harness subprocess instability | Robust error handling, fallback to manual mode |
| promptfoo API changes | Pin to specific version, abstract behind interface |
| Large benchmark memory usage | Streaming results, pagination |
| TUI complexity with new panels | Incremental rollout, feature flags |

### User Experience Risks

| Risk | Mitigation |
|------|------------|
| Python setup complexity | Clear docs, optional dependency |
| Long benchmark run times | Background execution, progress indicators |
| Results data overwhelming | Filtering, summarization views |
| Cost accumulation | Cost warnings, usage caps |

---

## Future Extensions (Beyond Phase 29)

- **Custom benchmark definitions** (user-provided eval scripts)
- **Evaluation CI/CD integration** (run evals on git push)
- **Model fine-tuning evaluation** (before/after fine-tune comparison)
- **Collaborative evaluation** (share results across team)
- **Advanced visualizations** (charts, trend analysis)

---

## Ready State

✅ **Phase 27 complete** — remote access & collaboration foundation  
✅ **Scaffolding complete** — packages/eval/ structure created  
✅ **Dependencies verified** — protocol schemas, build system updated  
✅ **Implementation plan** — detailed 14-day roadmap  

**Next action:** Wait for integration research results, then start Phase 29.1 (Integration Research & Design).