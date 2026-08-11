#!/usr/bin/env bash
#
# Build a parallel-work git worktree for this repo, correctly.
#
# ## Why this exists as a script
#
# The recipe below was worked out over seven recurrences of the same failures
# and then ran clean 4/4 — and was recorded as "written down as a script" that
# lived in a session scratchpad and is gone. So it is in the repo this time.
#
# ## The three traps it exists to avoid
#
# 1. ⚠️ **Do not use the agent harness's `isolation: "worktree"`.** It creates the
#    branch from `origin/main` — literally, per `git reflog`: "Created from
#    origin/main" — which is hundreds of commits behind `cline-dev` and has no
#    `dev-docs/` at all. 7 batches out of 7. Building it yourself is deterministic
#    the first time, with no reset dance and no wasted launch.
#
# 2. ⚠️ **A fresh worktree has no `node_modules`, and the obvious fix arms a worse
#    trap.** Symlinking the whole `node_modules` directory makes `@noodl/runtime`
#    resolve through *primary's* relative symlink, so a worktree test loads
#    `collection.ts` twice — once per path — and its
#    `Object.defineProperty(Array.prototype, 'items')` throws
#    "Cannot redefine property: items" on the second. It presents as a whole suite
#    failing to run and reads exactly like a real defect on the branch.
#
#    So: `node_modules` is a **real directory** of symlinks to each of primary's
#    entries, and each workspace scope is a **real directory** whose entries point
#    at *this worktree's* `packages/*`.
#
#    ⚠️ There are **two** workspace scopes, `@noodl` and `@nodegx`. An earlier
#    version of this recipe knew only about `@noodl`, which left the dual-load
#    trap armed for `@nodegx/render-measure`.
#
# 3. ⚠️ **Never run `npm install` in a worktree.** The symlinks mean it would
#    mutate the primary tree's modules.
#
# ## What this does NOT fix
#
# ⚠️ `lerna exec` (so `npm run dev:debug`, `test:ci`) resolves the package root to
# the **primary** checkout even when launched from a worktree — the run exercises
# primary's code and reports a result unrelated to your diff. **Editor live
# verification and `test:ci` belong to the primary checkout**, after merging.
# Non-lerna scripts (`tsc -p ...`, `library:build`, and a package-local `npx jest`)
# do see the worktree and are safe here.
#
# Usage:
#   scripts/devtools/make-worktree.sh <name> [base] [parent-dir]
#
#   name        branch and directory name, e.g. bst-lane
#   base        commit/branch to fork from (default: cline-dev)
#   parent-dir  where to put it (default: <repo>/../OpenNoodl-worktrees)
#
# ⚠️ The default parent is a **sibling of the repo, not a session scratchpad**.
# `git worktree list` currently carries ~20 stale entries because they were cut
# into per-session temp directories that no longer exist.

set -euo pipefail

NAME="${1:?usage: make-worktree.sh <name> [base] [parent-dir]}"
BASE="${2:-cline-dev}"

PRIMARY="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PARENT="${3:-$(dirname "$PRIMARY")/OpenNoodl-worktrees}"
WT="$PARENT/$NAME"

if [ -e "$WT" ]; then
  echo "make-worktree: $WT already exists. Remove it or pick another name." >&2
  exit 1
fi

mkdir -p "$PARENT"
git -C "$PRIMARY" worktree add -b "$NAME" "$WT" "$BASE"

echo "make-worktree: linking modules (no npm install — see the header)"

link_modules() {
  local src="$1" dst="$2" wt_packages="$3"
  mkdir -p "$dst"
  for entry in "$src"/* "$src"/.bin; do
    [ -e "$entry" ] || continue
    local base; base="$(basename "$entry")"

    # A scope directory is rebuilt only when it actually holds workspace links;
    # @types, @babel and friends are ordinary packages and are linked whole.
    if [[ "$base" == @* ]] && [ -d "$entry" ] && ls "$entry" | while read -r e; do
        [ -L "$entry/$e" ] && readlink "$entry/$e" | grep -q '\.\./\.\./' && exit 0
      done; [ "$?" -eq 0 ]; then
      mkdir -p "$dst/$base"
      for scoped in "$entry"/*; do
        [ -e "$scoped" ] || continue
        local sname; sname="$(basename "$scoped")"
        local target=""
        if [ -L "$scoped" ]; then
          # e.g. ../../packages/noodl-runtime — point it at OUR copy if we have one.
          local rel; rel="$(readlink "$scoped")"
          local resolved; resolved="$(cd "$entry" && cd "$(dirname "$rel")" 2>/dev/null && pwd)/$(basename "$rel")" || resolved=""
          if [ -n "$resolved" ]; then
            local sub="${resolved#"$PRIMARY"/}"
            [ -e "$wt_packages/../$sub" ] && target="$wt_packages/../$sub"
          fi
        fi
        ln -s "${target:-$scoped}" "$dst/$base/$sname"
      done
    else
      ln -s "$entry" "$dst/$base"
    fi
  done
}

link_modules "$PRIMARY/node_modules" "$WT/node_modules" "$WT/packages"

# Per-package modules, which lerna installs separately.
for pkg in "$PRIMARY"/packages/*/node_modules; do
  [ -d "$pkg" ] || continue
  name="$(basename "$(dirname "$pkg")")"
  [ -d "$WT/packages/$name" ] || continue
  ln -s "$pkg" "$WT/packages/$name/node_modules"
done

# ⚠️ Build artifacts are gitignored, so a fresh worktree has none — and some
# suites gate themselves on one instead of failing. `noodl-mcp`'s provisioning
# and project-identity specs do `existsSync(nodegx-backend/dist/cli.js) ?
# describe : describe.skip`, so without this the worktree reports
# "1 failed, 356 passed" where primary reports "1 failed, 405 passed": 49 tests
# silently absent, and the number still looks like a pass.
#
# ⚠️ A lane that actually CHANGES `nodegx-backend` must rebuild in its own
# worktree rather than trust this link, which points at primary's output.
for artifact in packages/nodegx-backend/dist; do
  if [ -d "$PRIMARY/$artifact" ] && [ ! -e "$WT/$artifact" ]; then
    ln -s "$PRIMARY/$artifact" "$WT/$artifact"
    echo "make-worktree: linked $artifact from primary (gitignored build output)"
  elif [ ! -d "$PRIMARY/$artifact" ]; then
    echo "make-worktree: ⚠️  $artifact missing in primary too — suites gated on it will SKIP, not fail." >&2
  fi
done

echo "make-worktree: verifying resolution points INSIDE the worktree"
fail=0
for spec in '@noodl/runtime/package.json' '@nodegx/render-measure/package.json' '@noodl/mcp/package.json'; do
  resolved="$(node -e "try{console.log(require.resolve('$spec',{paths:['$WT']}))}catch(e){console.log('UNRESOLVED')}")"
  case "$resolved" in
    "$WT"/*) echo "  ok   $spec" ;;
    *) echo "  FAIL $spec -> $resolved"; fail=1 ;;
  esac
done

if [ "$fail" -ne 0 ]; then
  echo "make-worktree: ⚠️  resolution escapes to the primary checkout — the dual-load trap is ARMED." >&2
  echo "make-worktree: a whole suite will fail with 'Cannot redefine property: items' and it will look real." >&2
  exit 1
fi

echo "make-worktree: $WT ready on branch $NAME (from $BASE, $(git -C "$WT" rev-parse --short HEAD))"
