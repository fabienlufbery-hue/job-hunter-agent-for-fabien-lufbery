#!/usr/bin/env bash
set -euo pipefail

echo "Scanning repository for accidental secrets or private credentials..."

PATTERNS=(
  'AIza[0-9A-Za-z_-]{35}'
  'GOCSPX-[0-9A-Za-z_-]{20,}'
  'ghp_[0-9A-Za-z]{30,}'
  'gho_[0-9A-Za-z]{30,}'
  'sk-[0-9A-Za-z]{20,}'
  '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----'
  'postgres(ql)?://[^:]+:[^@]+@[^/]+'
)

FOUND=0
for pat in "${PATTERNS[@]}"; do
  if grep -rnE \
    --exclude-dir=node_modules \
    --exclude-dir=.next \
    --exclude-dir=.git \
    --exclude-dir=.data \
    --exclude='check-secrets.sh' \
    --exclude='.env.example' \
    --exclude='*.test.ts' \
    -e "$pat" . ; then
    echo "ERROR: Potential secret matched pattern: $pat"
    FOUND=1
  fi
done

if [ -f .env ] || [ -f .env.local ]; then
  if git ls-files --error-unmatch .env .env.local >/dev/null 2>&1; then
    echo "ERROR: .env or .env.local is tracked in git!"
    FOUND=1
  fi
fi

if [ "$FOUND" -ne 0 ]; then
  echo "Secret scan FAILED."
  exit 1
fi

echo "Secret scan PASSED (0 secrets detected)."
