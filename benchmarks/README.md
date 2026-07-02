# Benchmarks for agent-workbench
#
# Run with: bun vitest bench --reporter=verbose
# (Requires vitest — not a dependency yet)

## Server benchmarks (planned)
- Server startup time
- Session creation throughput
- Message submission latency (10, 100, 1000 messages)
- Concurrent session handling (10, 50 simulataneous)

## TUI benchmarks (planned)
- Render time for 100+ message timeline
- Command palette search latency (1000 entries)
- Panel switch latency

## SDK benchmarks (planned)
- Session list with 100+ sessions
- Stream throughput for long model responses

## Permission engine benchmarks (planned)
- Policy evaluation with 100+ rules
- Plan evaluation with 50+ steps
