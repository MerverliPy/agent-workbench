#!/usr/bin/env bash
# Pre-commit secret scanning hook
# Lightweight grep-based check for common API key / secret patterns
# Full scanning is done on push via .github/workflows/ai-safety.yml

set -euo pipefail

RED='\033[0;31m'
NC='\033[0m'

if grep -RInE '(OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN|TELEGRAM_BOT_TOKEN|BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY|AKIA[0-9A-Z]{16}|ghp_[0-9a-zA-Z]{36}|npm_[a-z0-9]{36})' \
  --exclude-dir=.git \
  --exclude='*.md' \
  . 2>/dev/null; then
  echo -e "${RED}❌ Potential secret detected in staged changes.${NC}"
  echo "Review the above matches before committing."
  echo "Add patterns to .gitignore if these are false positives."
  exit 1
fi
