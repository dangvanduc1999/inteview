#!/usr/bin/env bash
# Runs the Mocha tests: everything, one suite, specific files, or a single test by name.
set -euo pipefail

SCRIPT_NAME="test"
# shellcheck source=lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
cd_repo_root

usage() {
  cat <<'EOF'
Usage: scripts/test.sh [unit|integration] [spec files or globs] [mocha options]

  scripts/test.sh                                  run all tests
  scripts/test.sh unit                             run unit tests only
  scripts/test.sh integration                      run integration tests only (needs docker services)
  scripts/test.sh test/unit/logger.spec.ts         run specific files
  scripts/test.sh -g "redacts"                     run tests whose title matches
  scripts/test.sh unit -g "child"                  combine a suite with a title filter

Integration tests need the db and redis containers: run `pnpm run docker:up` first.
Set SKIP_SERVICE_CHECK=1 to skip the docker check (e.g. services run elsewhere).
EOF
}

DEFAULT_SPEC='test/**/*.spec.ts'
suite="all"
has_spec=false
needs_services=false
args=()
expect_value=false

# Mocha options that consume the next argument, so it is not mistaken for a spec path.
is_value_flag() {
  case "$1" in
    -g | --grep | -f | --fgrep | -t | --timeout | -R | --reporter | -s | --slow) return 0 ;;
    *) return 1 ;;
  esac
}

if [ $# -gt 0 ]; then
  case "$1" in
    -h | --help)
      usage
      exit 0
      ;;
    unit | integration)
      suite="$1"
      shift
      ;;
  esac
fi

for arg in "$@"; do
  if $expect_value; then
    expect_value=false
  elif is_value_flag "$arg"; then
    expect_value=true
  elif [[ "$arg" != -* ]]; then
    has_spec=true
    [[ "$arg" == *integration* ]] && needs_services=true
  fi
  args+=("$arg")
done

if ! $has_spec; then
  case "$suite" in
    unit) args+=('test/unit/**/*.spec.ts') ;;
    integration) args+=('test/integration/**/*.spec.ts') ;;
    *) args+=("$DEFAULT_SPEC") ;;
  esac
  [ "$suite" != "unit" ] && needs_services=true
fi

ensure_node
ensure_deps_installed

if $needs_services && [ "${SKIP_SERVICE_CHECK:-}" != "1" ]; then
  running="$(docker compose ps --status running --services 2>/dev/null || true)"
  for service in db redis; do
    grep -qx "$service" <<<"$running" ||
      die "$service is not running; start dependencies with 'pnpm run docker:up' (or SKIP_SERVICE_CHECK=1)"
  done
fi

log "mocha ${args[*]}"
NODE_ENV=test pnpm exec mocha "${args[@]}"
