#!/bin/sh
# NodeGX backend — container entrypoint (WF-003).
#
# Turns environment variables into the `nodegx-backend serve` command line, and
# does the two things a deploy must do that `serve` itself cannot:
#
#   1. Provisions a PRODUCTION security policy on first run. This is not a
#      convenience. `defaultSecurityConfig()` ships `devOpen: true`, and BAK-003's
#      deploy interlock refuses to start when devOpen is on and the bind is not
#      loopback — which a container always is. So a first run with no
#      security.json writes the dev default and then immediately refuses to
#      start. Left alone, the very first thing an operator meets is a hard error
#      about a file they have never heard of. We write the locked policy before
#      the service ever looks, so the interlock is a backstop rather than the
#      onboarding experience. It is never rewritten afterwards: the policy is
#      the operator's, and BAK-007 promotion is how it changes.
#
#   2. Reads credentials from *_FILE variables (Docker/Compose secrets) so the
#      admin credential can reach the service without being written into a
#      compose file, an .env, an image layer, or `docker inspect` output.
#
# Everything else is passed straight through to the CLI. This script adds no
# behaviour the CLI does not already have — deliberately, so what runs in a
# container and what runs from a shell on a VPS stay the same program.

set -eu

DATA_DIR="${NODEGX_DATA_DIR:-/data}"
PORT="${NODEGX_PORT:-8577}"
HOST="${NODEGX_HOST:-0.0.0.0}"
BACKEND_ID="${NODEGX_BACKEND_ID:-nodegx-backend}"
BACKEND_NAME="${NODEGX_BACKEND_NAME:-NodeGX Backend}"

log() { echo "[entrypoint] $*"; }
die() { echo "[entrypoint] FATAL: $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Secrets: <VAR>_FILE wins over <VAR>, and the file content never reaches env.
# ---------------------------------------------------------------------------
read_secret() {
  # $1 = variable name. Echoes the value, or nothing.
  file_var="${1}_FILE"
  file_path="$(eval "printf '%s' \"\${${file_var}:-}\"")"
  if [ -n "$file_path" ]; then
    [ -r "$file_path" ] || die "$file_var points at $file_path, which cannot be read."
    # Strip a trailing newline; `echo secret > file` adds one and a token with a
    # newline in it fails authentication in a way that looks like a wrong token.
    tr -d '\r\n' < "$file_path"
    return
  fi
  eval "printf '%s' \"\${$1:-}\""
}

ADMIN_TOKEN="$(read_secret NODEGX_ADMIN_TOKEN)"
READONLY_TOKEN="$(read_secret NODEGX_READONLY_TOKEN)"

# ---------------------------------------------------------------------------
# Data directory
# ---------------------------------------------------------------------------
mkdir -p "$DATA_DIR"
[ -w "$DATA_DIR" ] || die "$DATA_DIR is not writable by uid $(id -u). Check the volume's ownership."

# ---------------------------------------------------------------------------
# First-run security policy (see the header)
# ---------------------------------------------------------------------------
SECURITY_FILE="$DATA_DIR/security.json"
if [ ! -f "$SECURITY_FILE" ]; then
  log "first run: writing a production security policy to $SECURITY_FILE (devOpen: false)"
  cp /app/security.production.json "$SECURITY_FILE"
else
  # An existing policy is the operator's, and we do not edit it. But a data
  # directory promoted from a laptop carries devOpen: true, and the interlock's
  # refusal — while correct — does not say "this came from your dev machine".
  # Say it here, before the service speaks, because this is the single most
  # likely first-deploy failure after the baked-endpoint one.
  case "$HOST" in
    127.0.0.1|localhost|::1) ;;
    *)
      if grep -q '"devOpen"[[:space:]]*:[[:space:]]*true' "$SECURITY_FILE" 2>/dev/null; then
        echo "[entrypoint] ---------------------------------------------------------------" >&2
        echo "[entrypoint] $SECURITY_FILE has \"devOpen\": true." >&2
        echo "[entrypoint] Dev-open disables ALL access control and only ever applies to a" >&2
        echo "[entrypoint] loopback bind. This container binds $HOST, so the backend will" >&2
        echo "[entrypoint] refuse to start (BAK-003 deploy interlock) — it will not serve" >&2
        echo "[entrypoint] your data wide open." >&2
        echo "[entrypoint]" >&2
        echo "[entrypoint] This normally means the data directory was copied from a" >&2
        echo "[entrypoint] development machine. Set \"devOpen\": false in that file and" >&2
        echo "[entrypoint] configure collection permissions (docs/runtime/BACKEND-ACCESS-CONTROL.md)." >&2
        echo "[entrypoint] ---------------------------------------------------------------" >&2
      fi
      ;;
  esac
fi

# ---------------------------------------------------------------------------
# Command line
# ---------------------------------------------------------------------------
set -- serve --data-dir "$DATA_DIR" --port "$PORT" --host "$HOST" \
       --backend-id "$BACKEND_ID" --backend-name "$BACKEND_NAME"

if [ -n "$ADMIN_TOKEN" ]; then
  set -- "$@" --token "$ADMIN_TOKEN"
else
  log "no NODEGX_ADMIN_TOKEN set — the backend will mint one on first start and print where to find it."
fi
if [ -n "$READONLY_TOKEN" ]; then
  set -- "$@" --readonly-token "$READONLY_TOKEN"
fi
if [ "${NODEGX_ADMIN_DASHBOARD:-true}" = "false" ]; then
  set -- "$@" --no-admin
fi
if [ "${NODEGX_ALLOW_EPHEMERAL:-false}" = "true" ]; then
  # RUN-004: opting out of persistence. Loud, and never the default.
  log "WARNING: NODEGX_ALLOW_EPHEMERAL=true — if SQLite will not load, data is NOT persisted."
  set -- "$@" --ephemeral
fi

log "starting: node /app/cli.js serve --data-dir $DATA_DIR --port $PORT --host $HOST"
exec node /app/cli.js "$@"
