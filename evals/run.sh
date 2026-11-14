#!/usr/bin/env bash
# Reruns the evals and rewrites evals/results.md. From the repo root: bash evals/run.sh
# Needs mcp/.venv (see mcp/README.md). The gym part calls headless Claude Code (3 runs, about $0.12 each).
# Skip it with: GYM=0 bash evals/run.sh (keeps the last gym results).
set -euo pipefail
cd "$(dirname "$0")/.."
mcp/.venv/bin/python evals/receipts/score.py
if [[ "${GYM:-1}" == "1" ]]; then
  # exit 1 means some checks failed (still reported below); any other failure stops the script
  python3 evals/gym/score.py --runs 3 || [[ $? -eq 1 ]]
fi
python3 evals/build_results.py
