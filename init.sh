#!/usr/bin/env bash
set -euo pipefail

echo "[init] Taipei Public Safety Dashboard harness verification"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

required_files=(
  "AGENTS.md"
  "feature_list.json"
  "progress.md"
  "session-handoff.md"
)

echo "[check] required harness files"
for file in "${required_files[@]}"; do
  if [[ -f "$file" ]]; then
    echo "  - ok: $file"
  else
    echo "  - missing: $file"
    exit 1
  fi
done

echo "[check] repository baseline"
if [[ -d .git ]]; then
  echo "  - ok: git repository detected"
else
  echo "  - fail: .git missing"
  exit 1
fi

echo "[check] toolchain availability"
if command -v node >/dev/null 2>&1; then
  echo "  - ok: node $(node -v)"
else
  echo "  - warn: node not found"
fi

if command -v python3 >/dev/null 2>&1; then
  echo "  - ok: python $(python3 --version | awk '{print $2}')"
else
  echo "  - warn: python3 not found"
fi

echo "[check] app verification commands"
if [[ -f package.json ]]; then
  if command -v npm >/dev/null 2>&1; then
    echo "  - run: npm run lint (if defined)"
    npm run lint --if-present
    echo "  - run: npm run typecheck (if defined)"
    npm run typecheck --if-present
    echo "  - run: npm test (if defined)"
    npm test --if-present
  else
    echo "  - warn: npm not found; skipped JS checks"
  fi
else
  echo "  - info: package.json not present yet; skipped JS checks"
fi

if [[ -d scripts ]]; then
  echo "  - info: scripts directory present"
else
  echo "  - info: scripts directory not present yet"
fi

echo "[done] Harness verification finished"
