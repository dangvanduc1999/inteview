#!/usr/bin/env bash
# Builds the TypeScript sources into dist/.
set -euo pipefail

SCRIPT_NAME="build"
# shellcheck source=lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
cd_repo_root

ensure_node
ensure_deps_installed

log "building"
pnpm run build

[ -f dist/server.js ] || die "build finished but dist/server.js is missing"
log "built dist/server.js (start with: NODE_ENV=<env> pnpm start)"
