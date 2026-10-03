#!/usr/bin/env bash
# Prepares a working checkout: verifies Node, enables pnpm, installs dependencies, runs lint.
# Safe to run repeatedly. Node version management is out of scope: activate the version
# from .nvmrc yourself before running this.
set -euo pipefail

SCRIPT_NAME="bootstrap"
# shellcheck source=lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
cd_repo_root

log "checking Node version"
ensure_node
log "node $(node -v)"

log "enabling pnpm via Corepack"
command -v corepack >/dev/null 2>&1 || die "corepack not found; it ships with Node, reinstall Node $(required_node_major)"
corepack enable || warn "corepack enable failed; continuing with the pnpm already on PATH, if any"
command -v pnpm >/dev/null 2>&1 || die "pnpm not found after enabling Corepack"
log "pnpm $(pnpm -v)"

log "installing dependencies"
if [ -f pnpm-lock.yaml ]; then
  pnpm install --frozen-lockfile
else
  pnpm install
fi

if [ ! -f secrets.json ]; then
  cp secrets.example.json secrets.json
  log "created secrets.json from secrets.example.json (matches docker-compose; edit for other databases)"
fi

log "running lint"
pnpm run lint

log "done"
