#!/usr/bin/env bash
set -euo pipefail

echo "Scanning project files and reachable Git history for credential patterns..."

PATTERNS=(
  'AIza[0-9A-Za-z_-]{35}'
  'GOCSPX-[0-9A-Za-z_-]{20,}'
  'gh[pousr]_[0-9A-Za-z]{30,}'
  'github_pat_[0-9A-Za-z_]{30,}'
  'sk-[0-9A-Za-z]{20,}'
  '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----'
  'postgres(ql)?://[^:/[:space:]]+:[^@[:space:]]+@[^/[:space:]]+'
)
printf -v joined '%s|' "${PATTERNS[@]}"
pattern="${joined%|}"
exclude=(':(exclude)scripts/check-secrets.sh' ':(exclude).env.example')
found=0

scan() {
  local code=0
  git grep -I -l -E -e "$pattern" "$@" -- . "${exclude[@]}" || code=$?
  if [[ "$code" -eq 0 ]]; then
    found=1
  elif [[ "$code" -ne 1 ]]; then
    exit "$code"
  fi
}

scan --untracked
while IFS= read -r revision; do
  scan "$revision"
done < <(git rev-list --all)

if git log --all --format= --name-only -- .env ':(glob)**/.env' ':(glob)**/.env.*'     ':(exclude,glob)**/.env.example' | awk 'NF { found=1 } END { exit !found }'; then
  echo 'A local environment file appears in the reachable Git history.'
  found=1
fi

if [[ "$found" -ne 0 ]]; then
  echo 'Secret scan failed. Inspect the listed file names privately.'
  exit 1
fi

echo 'Credential-pattern scan passed.'
