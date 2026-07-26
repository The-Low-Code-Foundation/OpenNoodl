#!/usr/bin/env bash
# NodeGX self-hosting driver (WF-003).
#
#   ./nodegx-deploy.sh build [--app <dir>] [--site-url <url>]
#   ./nodegx-deploy.sh up
#   ./nodegx-deploy.sh deploy [--app <dir>] [--site-url <url>]   # build + up
#   ./nodegx-deploy.sh versions
#   ./nodegx-deploy.sh rollback [<build-id>]
#   ./nodegx-deploy.sh status
#   ./nodegx-deploy.sh logs [service]
#   ./nodegx-deploy.sh down
#
# The point of this script is that a deploy is boring: the same command, the
# same artifact, the same result. Everything it does you could do by hand with
# `node ../scripts/package-deploy.js` and `docker compose`; what it adds is that
# the image tag is always the artifact's own content digest, and that the
# previous tag is written down before the new one takes over — which is what
# makes `rollback` a real operation rather than a paragraph in a document.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_ROOT="$(cd "$HERE/.." && pwd)"
ENV_FILE="$HERE/.env"
HISTORY_FILE="$HERE/.deploy-history"

cd "$HERE"

die() { echo "error: $*" >&2; exit 1; }
info() { echo "==> $*"; }

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
  else
    die "neither 'docker compose' nor 'docker-compose' is available."
  fi
}

ensure_env() {
  if [ ! -f "$ENV_FILE" ]; then
    info "no .env yet — creating one from env.example"
    cp "$HERE/env.example" "$ENV_FILE"
  fi
}

# Read one key from .env (empty if unset).
env_get() {
  [ -f "$ENV_FILE" ] || { echo ""; return; }
  sed -n "s/^$1=//p" "$ENV_FILE" | tail -n 1
}

# Set one key in .env, in place, creating it if absent.
env_set() {
  local key="$1" value="$2" tmp
  tmp="$(mktemp)"
  if grep -q "^$key=" "$ENV_FILE"; then
    # The value is a build id (hex) or a URL; no sed metacharacters to escape in
    # practice, but use a delimiter that cannot appear in either.
    sed "s|^$key=.*|$key=$value|" "$ENV_FILE" > "$tmp"
  else
    cat "$ENV_FILE" > "$tmp"
    echo "$key=$value" >> "$tmp"
  fi
  mv "$tmp" "$ENV_FILE"
}

# ---------------------------------------------------------------------------

cmd_build() {
  local app="" site_url=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --app) app="${2:-}"; shift 2 ;;
      --site-url) site_url="${2:-}"; shift 2 ;;
      *) die "unknown option for build: $1" ;;
    esac
  done

  ensure_env
  # Remember the app folder and site URL so `deploy` and `rollback` do not need
  # them repeated — a rollback that silently rebuilt from a different app folder
  # would be the worst possible surprise.
  if [ -n "$app" ]; then env_set NODEGX_APP_DIR "$app"; else app="$(env_get NODEGX_APP_DIR)"; fi
  if [ -n "$site_url" ]; then env_set NODEGX_SITE_URL "$site_url"; else site_url="$(env_get NODEGX_SITE_URL)"; fi

  # if-statements, not `[ … ] && args+=(…)`: under `set -e` a false test as the
  # last command of a list aborts the script.
  local args=()
  if [ -n "$app" ]; then args+=(--app "$app"); fi
  if [ -n "$site_url" ]; then args+=(--site-url "$site_url"); fi

  info "packaging artifact"
  # `"${args[@]}"` on an empty array is an unbound-variable error under `set -u`
  # in bash 3.2, which is what ships on macOS. The +expansion form is the
  # portable way to say "these arguments, if any".
  node "$PKG_ROOT/scripts/package-deploy.js" ${args[@]+"${args[@]}"}

  local build_id
  build_id="$(node -e "process.stdout.write(require('$HERE/artifact/MANIFEST.json').buildId)")"
  info "build id: $build_id"

  info "building images nodegx-backend:$build_id and nodegx-web:$build_id"
  NODEGX_TAG="$build_id" compose build

  # Record the outgoing tag BEFORE switching, so rollback has a target even if
  # the operator never ran `versions`.
  local previous
  previous="$(env_get NODEGX_TAG)"
  if [ -n "$previous" ] && [ "$previous" != "$build_id" ]; then
    echo "$previous" >> "$HISTORY_FILE"
  fi
  env_set NODEGX_TAG "$build_id"
  info "NODEGX_TAG=$build_id written to .env"
}

cmd_up() {
  ensure_env
  local tag
  tag="$(env_get NODEGX_TAG)"
  [ -n "$tag" ] || die "NODEGX_TAG is not set in .env — run './nodegx-deploy.sh build' first."
  info "starting stack at tag $tag"
  compose up -d
  cmd_status
}

cmd_deploy() {
  cmd_build "$@"
  cmd_up
}

cmd_versions() {
  echo "current: $(env_get NODEGX_TAG)"
  echo "previous (most recent last):"
  if [ -s "$HISTORY_FILE" ]; then sed 's/^/  /' "$HISTORY_FILE"; else echo "  (none recorded)"; fi
  echo "images built locally:"
  local images
  images="$(docker images --format '{{.Repository}}:{{.Tag}}  {{.CreatedSince}}' | grep -E '^nodegx-(backend|web):' | sort -u || true)"
  if [ -n "$images" ]; then echo "$images" | sed 's/^/  /'; else echo "  (none)"; fi
}

cmd_rollback() {
  ensure_env
  local target="${1:-}"
  local current
  current="$(env_get NODEGX_TAG)"

  if [ -z "$target" ]; then
    [ -f "$HISTORY_FILE" ] || die "no deploy history — pass a build id explicitly ('./nodegx-deploy.sh versions')."
    target="$(tail -n 1 "$HISTORY_FILE")"
    [ -n "$target" ] || die "deploy history is empty — pass a build id explicitly."
  fi
  [ "$target" != "$current" ] || die "already running $target."

  # Refuse to roll back to something that is not on this machine: the failure we
  # are avoiding is a compose 'up' that pulls nothing, finds nothing, and leaves
  # the stack down during an incident.
  docker image inspect "nodegx-backend:$target" >/dev/null 2>&1 \
    || die "image nodegx-backend:$target is not present locally. './nodegx-deploy.sh versions' lists what is."
  docker image inspect "nodegx-web:$target" >/dev/null 2>&1 \
    || die "image nodegx-web:$target is not present locally."

  info "rolling back $current -> $target"
  # Push the version we are leaving onto the history so a rollback is itself
  # reversible ("roll forward again" is the same command).
  echo "$current" >> "$HISTORY_FILE"
  env_set NODEGX_TAG "$target"
  compose up -d
  cmd_status
  echo
  echo "NOTE: this rolls back CODE, not data. The volume is untouched — which is"
  echo "      what you want unless a migration changed the schema. For that, see"
  echo "      packages/nodegx-backend/docs/BACKUP-RESTORE.md (restore the archive"
  echo "      taken before the deploy, with the service stopped)."
}

cmd_status() {
  ensure_env
  local tag port
  tag="$(env_get NODEGX_TAG)"
  port="$(env_get NODEGX_HTTP_PORT)"; port="${port:-8080}"
  echo
  echo "tag:  $tag"
  compose ps
  echo
  if curl -fsS --max-time 5 "http://127.0.0.1:$port/health" >/dev/null 2>&1; then
    echo "health: OK  ->  http://127.0.0.1:$port/  (admin: http://127.0.0.1:$port/_admin)"
  else
    echo "health: NOT ANSWERING on http://127.0.0.1:$port/health"
    echo "        './nodegx-deploy.sh logs backend' usually says why in the first 20 lines."
  fi
}

cmd_logs() { compose logs --tail 200 "${1:-}"; }
cmd_down() { compose down; }

# ---------------------------------------------------------------------------

case "${1:-}" in
  build)    shift; cmd_build "$@" ;;
  up)       shift; cmd_up ;;
  deploy)   shift; cmd_deploy "$@" ;;
  versions) shift; cmd_versions ;;
  rollback) shift; cmd_rollback "${1:-}" ;;
  status)   shift; cmd_status ;;
  logs)     shift; cmd_logs "${1:-}" ;;
  down)     shift; cmd_down ;;
  *)
    sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
    exit 2
    ;;
esac
