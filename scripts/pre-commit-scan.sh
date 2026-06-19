#!/usr/bin/env bash
# Pre-commit secret & sensitive-file scan — run before git init / first push:
#   chmod +x scripts/pre-commit-scan.sh && ./scripts/pre-commit-scan.sh
#   npm run pre-commit:scan
# Optional hook: ln -sf ../../scripts/pre-commit-scan.sh .githooks/pre-commit
#                 git config core.hooksPath .githooks
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
FAIL=0; WARN=0
pass(){ echo "  PASS: $*"; }; fail(){ echo "  FAIL: $*"; FAIL=$((FAIL+1)); }
warn(){ echo "  WARN: $*"; WARN=$((WARN+1)); }
is_git(){ git rev-parse --git-dir >/dev/null 2>&1; }
should_skip(){ [[ "$1" == *node_modules* || "$1" == *dist/* || "$1" == *cdk.out* || "$1" == .git/* ]]; }
is_env(){ local b; b=$(basename "$1"); [[ "$b" == .env || "$b" == .env.local || "$b" == .env.localstack ]] || [[ "$b" == .env.* && "$b" != .env.example && "$b" != .env.production.example && "$b" != .env.localstack.example ]]; }
ignored(){
  local p="$1" b; b=$(basename "$p")
  grep -qF '**/.env' .gitignore && { [[ "$b" == .env || "$b" == .env.local ]] && return 0; [[ "$b" == .env.* && "$b" != .env.example && "$b" != .env.production.example && "$b" != .env.localstack.example ]] && return 0; }
  grep -qF '.env.localstack' .gitignore && [[ "$b" == .env.localstack ]] && return 0
  grep -qF 'infra/cdk.context.json' .gitignore && [[ "$p" == infra/cdk.context.json ]] && return 0
  grep -qF 'deploy/.deploy-state.json' .gitignore && [[ "$p" == deploy/.deploy-state.json ]] && return 0
  grep -qF 'infra/cdk.out/' .gitignore && [[ "$p" == infra/cdk.out/* || "$p" == infra/cdk.out ]] && return 0
  grep -qF 'uploads/' .gitignore && [[ "$p" == uploads/* ]] && return 0
  grep -qF 'storage/' .gitignore && [[ "$p" == storage/* ]] && return 0
  return 1
}
list_files(){
  if is_git; then
    { git ls-files -z; git diff --cached --name-only -z; git ls-files --others --exclude-standard -z; } 2>/dev/null \
      | sort -zu | tr '\0' '\n'
  else
    find . -type f ! -path '*/node_modules/*' ! -path '*/dist/*' ! -path '*/cdk.out/*' ! -path '*/.git/*' \
      2>/dev/null | sed 's|^\./||' | sort -u
  fi
}
block_if_sensitive(){
  local f="$1" reason="$2"
  if is_git || ! ignored "$f"; then fail "$reason"; else pass "gitignored (local only): $f"; fi
}

echo "==> Secret scan ($(is_git && echo git repo || echo filesystem-only))"
echo "Checking sensitive paths..."
env_n=0
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  should_skip "$f" && continue
  if is_env "$f"; then env_n=$((env_n+1)); block_if_sensitive "$f" "env secret file must not be committed: $f"; fi
  case "$f" in
    infra/cdk.out/*|infra/cdk.out) block_if_sensitive "$f" "CDK output must not be committed: $f" ;;
    infra/cdk.context.json) block_if_sensitive "$f" "CDK context must not be committed: $f" ;;
    deploy/.deploy-state.json) block_if_sensitive "$f" "deploy state must not be committed: $f" ;;
    uploads/*|storage/*) [[ -f "$f" && "$f" != */.gitkeep ]] && block_if_sensitive "$f" "user file must not be committed: $f" ;;
  esac
done < <(list_files)
[[ "$env_n" -eq 0 ]] && pass "no .env secret files in commit candidates"
for d in uploads storage; do
  [[ -d "$d" ]] || continue
  n=$(find "$d" -type f ! -name .gitkeep 2>/dev/null | wc -l | tr -d ' ')
  [[ "$n" -gt 0 ]] && fail "$d/ contains $n user file(s)" || pass "$d/ has no user files"
done

if ! is_git; then
  echo; echo "Checking .gitignore coverage..."
  for p in 'infra/cdk.out/' 'infra/cdk.context.json' '**/.env' 'deploy/.deploy-state.json' 'uploads/' 'storage/'; do
    grep -qF "$p" .gitignore && pass ".gitignore includes: $p" || fail ".gitignore missing: $p"
  done
fi

echo; echo "Scanning file contents..."
scan=()
while IFS= read -r f; do
  [[ -z "$f" || ! -f "$f" ]] && continue
  should_skip "$f" && continue
  ! is_git && ignored "$f" && continue
  case "$f" in *.png|*.jpg|*.jpeg|*.gif|*.webp|*.ico|*.pdf|*.woff*|*.ttf|*.zip|*.gz|*.tsbuildinfo) continue ;; esac
  scan+=("$f")
done < <(list_files)

if [[ ${#scan[@]} -gt 0 ]]; then
  m=$(grep -lE 'AKIA[0-9A-Z]{16}' "${scan[@]}" 2>/dev/null) || true
  [[ -n "$m" ]] && while IFS= read -r x; do fail "AWS access key pattern in: $x"; done <<< "$m" || pass "no AWS access key patterns"
  m=$(grep -lE 'BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY' "${scan[@]}" 2>/dev/null) || true
  [[ -n "$m" ]] && while IFS= read -r x; do fail "private key in: $x"; done <<< "$m" || pass "no private key blocks"
  for f in "${scan[@]}"; do
    is_env "$f" || continue
    grep -qE '(JWT|SECRET|TOKEN|API_KEY)=[A-Za-z0-9_\-]{20,}' "$f" 2>/dev/null && warn "long secret-like value in $f"
  done
else pass "no scannable text files"; fi

echo; echo "Checking dev defaults (informational)..."
dev=$(for f in backend/src/seed/* e2e/helpers/*.ts e2e/*.ts backend/src/app.module.ts scripts/setup-db.sh docker-compose.yml docker-compose.migrate.yml; do [[ -f "$f" ]] && echo "$f"; done | sort -u)
if [[ -n "$dev" ]]; then
  m=$(echo "$dev" | xargs grep -lE 'password123|wgdspassword' 2>/dev/null) || true
  [[ -n "$m" ]] && while IFS= read -r x; do [[ -n "$x" ]] && warn "dev default password in: $x"; done <<< "$m" \
    || pass "no dev default passwords in seed/e2e paths"
fi

echo; echo "==> Summary: $FAIL failure(s), $WARN warning(s)"
[[ "$FAIL" -gt 0 ]] && { echo "    Fix failures before git init / first commit / push."; exit 1; }
[[ "$WARN" -gt 0 ]] && echo "    Warnings are informational."
echo "    Scan passed."; exit 0
