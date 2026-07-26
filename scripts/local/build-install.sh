#!/usr/bin/env bash
# Build marka.md locally and install to /Applications.
# Overrides createUpdaterArtifacts (needs upstream's signing key we don't have).
set -euo pipefail
cd "$(dirname "$0")/../.."
source "$HOME/.cargo/env" 2>/dev/null || true
bun install
bun tauri build --config '{"bundle":{"createUpdaterArtifacts":false}}'
APP="src-tauri/target/release/bundle/macos/marka.md.app"
[ -d "$APP" ] || { echo "Build output not found at $APP" >&2; exit 1; }
rm -rf "/Applications/marka.md.app"
cp -R "$APP" /Applications/
echo "Installed /Applications/marka.md.app"
