#!/usr/bin/env bash
# Shared helpers, sourced by the scripts in this directory. Do not execute directly.

SCRIPT_NAME="${SCRIPT_NAME:-$(basename "$0")}"

log() { printf '\033[32m[%s]\033[0m %s\n' "$SCRIPT_NAME" "$*"; }
warn() { printf '\033[33m[%s]\033[0m %s\n' "$SCRIPT_NAME" "$*" >&2; }
die() {
  printf '\033[31m[%s]\033[0m %s\n' "$SCRIPT_NAME" "$*" >&2
  exit 1
}

# Run from the repository root regardless of where the script was invoked.
cd_repo_root() {
  cd "$(dirname "${BASH_SOURCE[0]}")/../.." || die "cannot locate repository root"
}

# Required Node major version, taken from .nvmrc (e.g. "22").
required_node_major() {
  tr -d 'v \n' <.nvmrc | cut -d. -f1
}

# Fails unless the active node matches the required major version.
ensure_node() {
  command -v node >/dev/null 2>&1 || die "node not found; install Node $(required_node_major) and retry"
  local required actual
  required="$(required_node_major)"
  actual="$(node -p 'process.versions.node')"
  if [ "${actual%%.*}" != "$required" ]; then
    die "Node $required is required (found $actual). Activate Node $required and retry."
  fi
}

ensure_deps_installed() {
  [ -d node_modules ] || die "dependencies are not installed; run scripts/bootstrap.sh first"
}
