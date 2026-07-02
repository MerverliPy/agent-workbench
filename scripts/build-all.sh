#!/usr/bin/env bash
# Build all @agent-workbench workspace packages in dependency order.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Building packages (dependency-ordered) ==="

# Level 0: no @agent-workbench dependencies
for pkg in protocol models storage tokens diff telemetry plugin-sdk; do
  echo "  [build] packages/$pkg"
  (cd "$ROOT/packages/$pkg" && bun run build 2>&1) || exit 1
done

# Level 1: depend on level 0 packages
for pkg in events sdk shell permissions cache planner; do
  echo "  [build] packages/$pkg"
  (cd "$ROOT/packages/$pkg" && bun run build 2>&1) || exit 1
done

# Level 2: depends on cache, diff, protocol, shell, storage
echo "  [build] packages/tools"
(cd "$ROOT/packages/tools" && bun run build 2>&1) || exit 1

# Level 3: depends on many packages (incl. tools)
echo "  [build] packages/core"
(cd "$ROOT/packages/core" && bun run build 2>&1) || exit 1

# Apps
echo "  [build] apps/server"
(cd "$ROOT/apps/server" && bun run build 2>&1) || exit 1

echo "  [build] apps/cli"
(cd "$ROOT/apps/cli" && bun run build 2>&1) || exit 1

# tui is a Vite/SolidJS app, no tsc build needed for test resolution
# (it only imports protocol types and SDK which are already built)

echo "=== All packages built ==="
