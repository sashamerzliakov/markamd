#!/usr/bin/env bash
# Pull the latest upstream markamd and merge it into the custom branch.
# Resolve any conflicts, then run scripts/local/build-install.sh to rebuild.
set -euo pipefail
cd "$(dirname "$0")/../.."
git fetch upstream
git checkout custom
git merge upstream/main
echo "Merged upstream/main into custom. Run scripts/local/build-install.sh to rebuild + reinstall."
