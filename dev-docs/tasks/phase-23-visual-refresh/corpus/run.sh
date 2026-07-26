#!/usr/bin/env bash
# UIX-009 corpus — one command: bring up a clean dev editor, capture both themes,
# build the gallery. Run from the repo root. Idempotent: kills stale stacks first.
#
#   dev-docs/tasks/phase-23-visual-refresh/corpus/run.sh
#
# The editor must have a project OPEN for editor+panel captures. This script opens
# the launcher; open the fixture project (or any project) once, then it captures
# whatever state each window is in. See README.md for the fixture recipe and why
# project-open is left as a manual step (the open choreography is timing-flaky per
# RUN-003's traps — the harness itself stays deterministic).
set -euo pipefail
cd "$(dirname "$0")/../../../.."   # repo root
HERE="dev-docs/tasks/phase-23-visual-refresh/corpus"

echo "==> killing stale dev stacks"
pkill -f "OpenNoodl/node_modules/electron/dist" 2>/dev/null || true
pkill -f "lerna exec" 2>/dev/null || true
pkill -f "dev:debug" 2>/dev/null || true
sleep 3

echo "==> launching dev:debug (60-90s compile)"
nohup npm run dev:debug -- --quiet > /dev/null 2>&1 &
until grep -q "launching Electron" .logs/dev.log 2>/dev/null; do sleep 5; done
sleep 30
npm run cdp -- health || true

echo "==> capturing corpus"
node "$HERE/capture.mjs" "$@"

LATEST="$(ls -td "$HERE"/captures/*/ | head -1)"
echo "==> building gallery from $LATEST"
node "$HERE/gallery.mjs" "$LATEST"
echo "==> done: $HERE/gallery.html"
