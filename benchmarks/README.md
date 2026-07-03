# Benchmarks

Performance benchmarks for agent-workbench packages and apps.

## Running

```bash
# Run the benchmark suite
bun run benchmarks/benchmark-runner.ts
```

## What's Benchmarked

### Build & Type System
- Build time per package (`tsc`)
- Typecheck time per package
- Bundle size analysis

### Runtime
- Server startup time
- Session creation throughput
- Message submission latency

### TUI
- Render time for large timelines
- Command palette search latency

### Permission Engine
- Policy evaluation with many rules
- Plan evaluation with many steps

## Adding Benchmarks

Add new benchmark suites in `benchmarks/tools/`. Each suite should export a `run()` function that returns a `BenchmarkResult`.
