#!/usr/bin/env bash
#
# REL-001 — publish the members' area to the community shelf.
#
#   dev-docs/tasks/release-0.2.2/publish-members-area.sh          # writes a DRAFT row
#   dev-docs/tasks/release-0.2.2/publish-members-area.sh --publish # makes it visible
#
# Written 2026-09-06 because the credential turned out not to exist on this laptop.
#
# ── Why a tunnel, rather than a DATABASE_URL you paste ────────────────────────
#
# 🔴 The production Postgres is NOT reachable from outside the box. `ops/provision.sh`
# installs it as a system package and writes
# `DATABASE_URL=postgres://nodegx_community:<pass>@127.0.0.1:5432/nodegx_community`
# into /etc/nodegx-community/nodegx-community.env — that `127.0.0.1` is the server's own
# loopback, so no connection string typed on this laptop can reach it directly.
#
# 🔴 And the script CANNOT simply be run on the server: it reads the template bundle off
# local disk (`templates/members-area`, 100 files), and that directory is here.
#
# So: forward the server's 5432 to a local port, and point the publisher at the near end.
# The password is read over ssh into a shell variable and never written to this disk,
# never echoed, and never pasted into a chat window.
#
# ── The safety check this script refuses on ───────────────────────────────────
#
# 🔴 `readbundledirectory.ts` walks the template tree FULLY RECURSIVELY WITH NO SKIP LIST
# — no dotfile rule, no .git rule, no ignore file. Everything under the directory is read
# and shipped. Since FIX-008 B, *opening a v2 project in the editor writes three files into
# it*: `.mcp.json` (which carries absolute paths from the machine that opened it),
# `CLAUDE.md`, and a block appended to `.gitignore`. Publishing after an open would send all
# three to the shelf and install them into every person's project.
#
# The three were absent when this script was written. It re-checks, because the window
# between then and when you run it is exactly when somebody opens the project to look at it.
set -euo pipefail

SSH_KEY="${NODEGX_SSH_KEY:-$HOME/.ssh/nexus_hetzner}"
HOST="${NODEGX_HOST:-root@49.12.102.195}"
LOCAL_PORT="${NODEGX_TUNNEL_PORT:-15432}"
ENV_FILE=/etc/nodegx-community/nodegx-community.env
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TEMPLATE_DIR="$REPO_ROOT/templates/members-area"
COMMUNITY="${NODEGX_COMMUNITY_DIR:-$HOME/vscode_projects/nodegx-community}"

PUBLISH=0
for arg in "$@"; do
  case "$arg" in
    --publish) PUBLISH=1 ;;
    *) echo "usage: $(basename "$0") [--publish]" >&2; exit 1 ;;
  esac
done

# ── refusals, before anything is touched ─────────────────────────────────────

for f in .mcp.json CLAUDE.md .gitignore; do
  if [ -e "$TEMPLATE_DIR/$f" ]; then
    echo "REFUSING: $TEMPLATE_DIR/$f exists — the project has been opened in the editor." >&2
    echo "  Delete all three, then re-run 'npm run template:members' and confirm the" >&2
    echo "  artefact is byte-identical (TPL-001 AC7) before publishing." >&2
    exit 1
  fi
done

entries="$(ls -A "$TEMPLATE_DIR" | wc -l | tr -d ' ')"
files="$(find "$TEMPLATE_DIR" -type f | wc -l | tr -d ' ')"
if [ "$entries" != "4" ] || [ "$files" != "100" ]; then
  echo "REFUSING: expected 4 top-level entries and 100 files, found $entries and $files." >&2
  echo "  That is the figure tpl001Template.test.ts §1 asserts. Re-generate or re-check." >&2
  exit 1
fi

if lsof -nP -iTCP:"$LOCAL_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "REFUSING: something is already listening on $LOCAL_PORT." >&2
  echo "  Set NODEGX_TUNNEL_PORT to a free port and re-run." >&2
  exit 1
fi

echo "==> bundle checked: 4 entries, 100 files, none of the three editor-written files"

# ── the credential, and the tunnel ───────────────────────────────────────────

echo "==> reading DATABASE_URL from $HOST:$ENV_FILE"
DB_URL_REMOTE="$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$HOST" \
  "grep '^DATABASE_URL=' $ENV_FILE | cut -d= -f2-")"
if [ -z "$DB_URL_REMOTE" ]; then
  echo "REFUSING: no DATABASE_URL in $ENV_FILE on $HOST." >&2
  exit 1
fi

# The server's loopback becomes the tunnel's near end. Nothing else in the URL moves.
DB_URL_LOCAL="${DB_URL_REMOTE/@127.0.0.1:5432/@127.0.0.1:$LOCAL_PORT}"
if [ "$DB_URL_LOCAL" = "$DB_URL_REMOTE" ]; then
  echo "REFUSING: DATABASE_URL does not point at 127.0.0.1:5432 as provision.sh writes it." >&2
  echo "  Read it yourself and adapt this script rather than letting it guess." >&2
  exit 1
fi

echo "==> opening tunnel localhost:$LOCAL_PORT -> $HOST 127.0.0.1:5432"
ssh -i "$SSH_KEY" -N -L "$LOCAL_PORT:127.0.0.1:5432" "$HOST" &
TUNNEL_PID=$!
trap 'kill "$TUNNEL_PID" 2>/dev/null || true' EXIT

for _ in $(seq 1 20); do
  if lsof -nP -iTCP:"$LOCAL_PORT" -sTCP:LISTEN >/dev/null 2>&1; then break; fi
  sleep 0.5
done
if ! lsof -nP -iTCP:"$LOCAL_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "REFUSING: the tunnel never came up on $LOCAL_PORT." >&2
  exit 1
fi

# ── the write ────────────────────────────────────────────────────────────────
#
# ⚠️ --publish is opt-in, and a re-run WITHOUT it does not unpublish an already-published
# row — visibility is left where it was. `--unpublish` is the way to take one off.

ARGS=(
  members-area
  "$TEMPLATE_DIR"
  starter
  "members only site for a club, charity or church"
  --title "Members' area"
)
[ "$PUBLISH" = "1" ] && ARGS+=(--publish)

if [ "$PUBLISH" = "1" ]; then
  echo "==> publishing (the row becomes visible on the shelf)"
else
  echo "==> writing a DRAFT row (invisible until you re-run with --publish)"
fi

cd "$COMMUNITY"
DATABASE_URL="$DB_URL_LOCAL" npx tsx scripts/publish-project-template.ts "${ARGS[@]}"

echo
echo "==> done. Check it at https://community.nodegx.io/templates"
echo "    and in the editor: launcher -> Templates, or the create wizard's picker."
