#!/usr/bin/env bash
#
# HLS-011 — the drive, as one command.
#
# On a machine with no display server, a shell creates an app, authors it, builds it and serves it —
# and what is served is what the editor would draw for the same project.
#
# The headless half runs in a linux container with node and nothing else: no DISPLAY, no X socket,
# no browser. The container asserts that about itself before it measures anything, because "a
# headless box" is a claim about the environment and a drive that assumes it measures something
# else.
#
# The comparison half runs HERE, because it needs Chrome and the viewer bundle — which is exactly
# what `nodegx render` exits 8 for inside the container. That refusal and this reading are the same
# fact seen from two sides.
#
#   ./run.sh [scratch-dir]        # default: a fresh mktemp -d
#   MUTANT=1 ./run.sh             # pack a deliberately broken exporter; the drive must go RED
#
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
PKG="$(cd "$HERE/../.." && pwd)"
REPO="$(cd "$PKG/../.." && pwd)"
WORK="${1:-$(mktemp -d -t hls011)}"
IMAGE="node:22-bookworm-slim"

echo "== HLS-011 drive =="
echo "   repo:    $REPO"
echo "   scratch: $WORK"

command -v docker >/dev/null || { echo "docker is not installed. The headless half needs a linux container — a Mac with the window closed is not a machine with no display server."; exit 1; }
docker info >/dev/null 2>&1 || { echo "The docker daemon is not running. Start Docker and re-run."; exit 1; }

rm -rf "$WORK/stage" "$WORK/container" "$WORK/host"
mkdir -p "$WORK/stage/mcp/dist" "$WORK/stage/mcp/bin" "$WORK/container" "$WORK/host"

echo "-- building and packing @nodegx/export"
(cd "$PKG" && npm run build >/dev/null && npm pack --pack-destination "$WORK/stage" >/dev/null)

# The MCP server goes in as the PACKAGED app's layout — the bundle and the catalog beside it, with
# no `packages/` above them. That is C72's lesson: in a checkout the in-repo catalog resolves by a
# depth coincidence, and the shipped bundle would have been dead.
echo "-- staging the MCP server the way the app ships it"
cp "$REPO/packages/noodl-mcp/dist/noodl-mcp.cjs" "$REPO/packages/noodl-mcp/dist/node-catalog.json" "$WORK/stage/mcp/dist/"
cp "$REPO/packages/noodl-mcp/bin/noodl-mcp.js" "$WORK/stage/mcp/bin/"
cp "$HERE/drive.mjs" "$HERE/app.mjs" "$HERE/mcpclient.mjs" "$WORK/stage/"

echo "-- the headless half, in $IMAGE"
set +e
docker run --rm -v "$WORK/stage":/stage:ro -v "$WORK/container":/work -w /work "$IMAGE" \
  bash -c "npm i -g /stage/$(cd "$WORK/stage" && ls *.tgz) >/dev/null 2>&1 && node /stage/drive.mjs"
CONTAINER_STATUS=$?
set -e
echo "   container exit: $CONTAINER_STATUS"

if [ "$CONTAINER_STATUS" -ne 0 ]; then
  echo "The headless half failed. $WORK/container/result.json has what each step measured."
  exit "$CONTAINER_STATUS"
fi

# 🔴 A COPY. Opening or booting a project writes into it, and the artefact the container produced is
# the evidence — measure a copy, keep the original.
echo "-- the comparison half, here, in a real browser"
cp -R "$WORK/container/kettle-log" "$WORK/host/kettle-log"
node "$HERE/host-compare.mjs" "$WORK/host/kettle-log" "$WORK/container/result.json" "file://$HERE/app.mjs"
echo
echo "== both halves agree =="
echo "   $WORK/container/result.json   what the headless box measured"
echo "   $WORK/host/viewer.json        what the viewer drew, beside it"
