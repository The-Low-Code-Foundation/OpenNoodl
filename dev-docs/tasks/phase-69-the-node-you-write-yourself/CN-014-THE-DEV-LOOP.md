# CN-014 — The dev loop

| Field | Value |
|---|---|
| **Tier** | 5 |
| **Effort** | M (unknown until the measurement pass) |
| **Surface** | `editor`, `devtools` |
| **Rulings** | — |
| **Depends on** | CN-003 (the node library must refresh, not just the render) |

## 🔴 Measure first — the answer may be "most of it already works"

Editing a kit and seeing the change should not require restarting the editor. **What happens today is
not established**, and there is concrete reason to think the two halves differ:

- **`noodl-preview` probably already works.** Its watcher (`watcher.ts:47`) watches the whole project
  directory and its `IGNORED` list is `.git`, `.DS_Store`, `node_modules`, `.nodegx-backup` and
  editor scratch files. **`noodl_modules` is not excluded**, so a kit edit should already trigger a
  rebuild. This was never confirmed — the 2026-08-15 proof ran with `--no-watch`.
- **The editor is a different story.** The preview reloads from HTML, so a module script re-executes
  on reload — but the **node library** is delivered once over `sendNodeLibrary`. Whether a changed
  kit's *ports* reach the property panel without a restart is exactly the sort of thing that quietly
  does not happen.

## The specific risk that makes this task worth doing properly

🔴 **HMR leaves the mounted editor on the old module**, and **HMR misses a mounted panel** — both
recorded. A kit dev loop that appears to work but leaves the *editor* holding the previous
definition is worse than no reload: the canvas and the preview disagree, and the author debugs a
node that no longer exists.

⚠️ The consequence to write down before driving: **after editing a port's name in a kit, the property
panel shows the new name.** Not "the preview updated" — the preview updating is equally true of a
broken implementation that never refreshed the library.

## What to establish, then build

1. Does a kit edit rebuild the `noodl-preview` render? (Probably yes — confirm.)
2. Does a kit edit reach the **editor's** preview? Does it reach the **node library**?
3. What happens to **nodes already on canvas** when a port they use disappears from a kit — dropped
   connection, ghost port, or a crash?
4. Build whatever closes the gap: at minimum, a reliable manual "reload kits" action; at best,
   automatic refresh of both the render and the library.

## Acceptance criteria

1. Rename a port in a kit; without restarting the editor, the property panel shows the new name and
   the old connection is handled predictably (dropped with a diagnostic, not silently retained).
2. Add a node to a kit; it appears in the picker without a restart.
3. A kit with a syntax error reports it (CN-015) rather than leaving the previous version silently in
   place — 🔴 **a stale module that still works is the worst outcome**, because the author's next
   twenty minutes are spent testing code that is not running.

## Traps

- ⚠️ **`cdp reload --target=viewer` reloaded the *editor*** (observed 2026-08-15) and sent it back to
  the launcher, losing the open project. If a drive of this task needs to reload the preview, verify
  which window actually reloaded before concluding anything about refresh behaviour.
- ⚠️ **A quiet dev stack does not mean a quiet checkout**, and a live stack contaminates a concurrent
  `test:ci`. This task involves a lot of editor restarts — coordinate.
