#!/usr/bin/env bash
set -euo pipefail

echo "Setting up dev container..."

if [ -f package.json ]; then
  bun install
fi

if [ -d packages ]; then
  bash scripts/build-all.sh
fi

echo "Dev container setup complete."
