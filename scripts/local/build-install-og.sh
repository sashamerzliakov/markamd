#!/usr/bin/env bash
# Build stock upstream marka.md side by side with our fork.
#
# Installs to /Applications/marka.md-OG.app with its own bundle identifier so it
# cannot collide with our build. Three things are overridden at build time; each
# one is load-bearing:
#
#   identifier        Tauri bakes this in at compile time. It keys the
#                     single-instance lock and the webview data store, so
#                     sharing it would mean the two apps focus each other
#                     instead of launching, and OG would read and overwrite our
#                     zoom / favourites / recent files.
#   fileAssociations  Emptied so LaunchServices never hands OG the .md default.
#                     Our fork stays the handler for double-clicked markdown.
#   updater           Disabled — OG must not replace itself behind our back.
#
# productName is overridden too (that names the .app); mainBinaryName is left
# alone so the bundler still finds the `marka.md` binary cargo produces.
#
# Usage: scripts/local/build-install-og.sh [git-ref]   (default: v1.7.1)
set -euo pipefail

REF="${1:-v1.7.1}"
WORKTREE="$HOME/work/ykeo/marka-og"
APP_NAME="marka.md-OG"
DEST="/Applications/${APP_NAME}.app"

cd "$(dirname "$0")/../.."
source "$HOME/.cargo/env" 2>/dev/null || true

if [ ! -d "$WORKTREE" ]; then
  echo "Creating worktree at $WORKTREE ($REF)"
  git worktree add "$WORKTREE" "$REF"
else
  echo "Updating worktree to $REF"
  git -C "$WORKTREE" checkout --detach "$REF"
fi

cd "$WORKTREE"
bun install

bun tauri build --config '{
  "productName": "'"$APP_NAME"'",
  "identifier": "com.mattenarle.markamd.og",
  "plugins": { "updater": { "active": false } },
  "bundle": {
    "targets": ["app"],
    "createUpdaterArtifacts": false,
    "fileAssociations": []
  }
}'

APP="src-tauri/target/release/bundle/macos/${APP_NAME}.app"
[ -d "$APP" ] || { echo "Build output not found at $APP" >&2; exit 1; }

rm -rf "$DEST"
cp -R "$APP" /Applications/
echo "Installed $DEST ($REF)"
