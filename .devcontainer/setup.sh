#!/usr/bin/env bash
set -euo pipefail

echo "Setting up dev container..."

if [ -f package.json ]; then
  npm install
fi

if [ -f requirements.txt ]; then
  python3 -m pip install -r requirements.txt
fi

if [ -f go.mod ]; then
  go mod download
fi

echo "Dev container setup complete."
