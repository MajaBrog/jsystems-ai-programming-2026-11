#!/usr/bin/env bash
# Run a command with variables from the checkout-root .env exported.
#
# Usage: bash app/scripts/with-env.sh <command> [args...]
#        bash app/scripts/with-env.sh env-check   # report which variables are set (never values)
#
# Rules:
# - A variable already set in the environment wins (so `OPENROUTER_API_KEY=invalid bash with-env.sh ...`
#   keeps the override); .env only fills variables that are unset.
# - Empty values in .env are skipped, so application defaults apply.
# - .env location: $ENV_FILE if set, else <checkout root>/.env, else the main worktree's .env
#   (so a linked git worktree shares the single .env of the main checkout).
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

find_env_file() {
  if [[ -n "${ENV_FILE:-}" ]]; then
    printf '%s\n' "$ENV_FILE"
    return
  fi
  local root main
  root="$(git -C "$script_dir" rev-parse --show-toplevel 2>/dev/null || (cd "$script_dir/../.." && pwd))"
  if [[ -f "$root/.env" ]]; then
    printf '%s\n' "$root/.env"
    return
  fi
  main="$(git -C "$script_dir" worktree list --porcelain 2>/dev/null | sed -n '1s/^worktree //p')"
  if [[ -n "$main" && -f "$main/.env" ]]; then
    printf '%s\n' "$main/.env"
    return
  fi
  printf '%s\n' "$root/.env"
}

env_file="$(find_env_file)"
declare -A source_of=()

if [[ -f "$env_file" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ "$line" =~ ^[[:space:]]*(#|$) ]] && continue
    line="${line#export }"
    [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || continue
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    # strip matching surrounding quotes
    if [[ "$value" =~ ^\"(.*)\"$ || "$value" =~ ^\'(.*)\'$ ]]; then
      value="${BASH_REMATCH[1]}"
    fi
    if [[ -n "${!key+x}" ]]; then
      source_of[$key]="environment"
      continue
    fi
    [[ -z "$value" ]] && continue
    export "$key=$value"
    source_of[$key]=".env"
  done < "$env_file"
fi

if [[ "${1:-}" == "env-check" ]]; then
  echo "env file: $env_file ($([[ -f "$env_file" ]] && echo found || echo missing))"
  for key in OPENROUTER_API_KEY OPENROUTER_BASE_URL LLM_MODEL LLM_VISION_MODEL LLM_TIMEOUT_SECONDS \
             OPENROUTER_APP_TITLE APP_DATA_DIR SERVER_PORT; do
    if [[ -n "${!key:-}" ]]; then
      echo "$key: set (source: ${source_of[$key]:-environment})"
    else
      echo "$key: unset"
    fi
  done
  exit 0
fi

if [[ $# -eq 0 ]]; then
  echo "usage: with-env.sh <command> [args...] | env-check" >&2
  exit 2
fi

exec "$@"
