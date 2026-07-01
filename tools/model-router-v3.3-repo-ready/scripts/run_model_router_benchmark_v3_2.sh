#!/usr/bin/env bash
set -euo pipefail

python collect_model_router_benchmark_v3_2.py all

echo ""
echo "Next: run this repeatedly to paste router outputs:"
echo "  python collect_model_router_benchmark_v3_2.py collect-next"
echo ""
echo "When complete, run:"
echo "  python collect_model_router_benchmark_v3_2.py grade"
