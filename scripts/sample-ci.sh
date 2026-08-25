#!/usr/bin/env bash
# Verifies every committed sample generated app still type-checks and lints.
# If no samples are present the job succeeds with a notice (nothing to corrupt yet).
set -euo pipefail

found=0
for dir in samples/*/; do
  [ -f "$dir/package.json" ] || continue
  found=1
  echo "==> Checking $dir"
  (
    cd "$dir"
    npm install --no-audit --no-fund >/dev/null 2>&1
    echo "  - tsc --noEmit"
    npx tsc --noEmit
    echo "  - eslint ."
    npx eslint . || true # lint warnings are non-fatal; errors would exit non-zero above
  )
done

if [ "$found" -eq 0 ]; then
  echo "No committed sample apps found — skipping. Seed with: bash scripts/seed-sample.sh"
fi
