#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export CMAKE_POLICY_VERSION_MINIMUM="${CMAKE_POLICY_VERSION_MINIMUM:-3.5}"
exec bun run tauri dev "$@"
