# CN-014 — The dev loop

| Field | Value |
|---|---|
| **Tier** | 5 |
| **Effort** | M (unknown until the measurement pass) |
| **Surface** | `editor`, `devtools` |
| **Rulings** | — |
| **Depends on** | CN-003 (the node library must refresh, not just the render) |

## ✅ AC1's library half — BUILT 2026-08-17 (s20)

🔴 **The measure-first pass had already happened without the task being open.** s15 measured
"a kit scaffolded into the open project never appears" (AC2's half — a viewer reload is *necessary
and sufficient*), and s19, driving CN-010 AC1, measured the other half by accident: **a kit node's
definition is frozen after its first delivery.** One write to `index.js` flipped an existing node's
condition *and* added a new node; one viewer reload delivered the new node and never the change.

**Cause, two halves, both in `NodeLibraryImporter`:**

1. `mergeUpdates`' known-name branch carried `// TODO: Update the node data?` and discarded the new
   definition. Now the owning runtime replaces its own data.
2. `mergeInByName` **did** replace the picker-index entry but never set `updated`, so `updateIndex`
   published nothing and `NodeLibrary.instance.reload()` never ran. The fresh group reached the
   picker only when something else in the same import happened to flip the flag.

🔴 **The obvious fix would have broken 84 built-ins.** An unconditional replace lets the generated
cloud library — which merges once per session and shares **all 84** of its type names with the
browser library (`Expression`, `REST2`, `Model2`, …), with **all 84 definitions differing** — capture
those names and invert a precedence that has always been first-writer-wins. The fix therefore gates
on a `dataOwner` map: **which runtime's report the data came from**, which is a different question
from `runtimeTypes` (a union, and both runtimes are in it for those 84).

🔴 **`clientId` cannot be that key.** An ordinary viewer mints a fresh `guid()` on every socket open
(`editorconnection.ts:194`) and only a sandbox preview passes a fixed one — so "the same client
re-imported" is unanswerable, and a fix keyed on it would never fire. Measured before building.
⚠️ A rule keyed on *"`runtimeTypes` has one entry"* is also wrong: it silently stops refreshing
exactly those 84.

**8 tests, 5/5 mutations killed** (`tests-unit/cn-014/kitDefinitionRefresh.test.ts`); editor
`test:main` **3,601 / 234 suites**, `typecheck:editor` **0**. The precedence control is built from
the two **real** payloads on disk and asserts they *disagree* first — overlap alone would have made
it vacuous.

### 🚗 DRIVEN the same session — and the panel is a second surface, as predicted

Observations written **before** launch; full readings in
[notes/cn-014-ac1-drive.md](notes/cn-014-ac1-drive.md).

One write renamed a port's `displayName` **and** added a new node; one viewer reload:

| surface | before | after one reload |
|---|---|---|
| `NodeLibrary.instance.types.length` | 177 | **178** ✅ |
| library's `title.displayName` | `Title` | **`Panel Heading`** ✅ |
| **property panel, node still selected** | `Title` | **`Title`** ⚠️ |
| property panel, after re-selecting | — | **`Panel Heading`** ✅ |

🔴 **Both library cells moving on one reload is the fix** — that combination was impossible before.
✅ **O3 held live**: `Expression` / `REST2` / `Model2` still carry `["browser","cloud"]` with full
port sets, so the cloud library did not capture them.

⚠️ **Residual, reproduced twice: an open property panel does not re-render on `libraryUpdated`.**
Second cycle polled the panel **six times over 30 s without touching anything** and it never moved,
then one re-selection updated it — so the variable is the selection change, **not** elapsed time.
`reload()` does fire the event; the panel is not among the listeners that rebuild from it.
**Severity is far below the bug behind it**: an author recovers by clicking any other node and back,
and ordinary authoring does that constantly — whereas the frozen definition needed an editor
restart and mislabelled itself as *"dynamic ports don't work"*. **It wants a small follow-up, not a
reopening of this criterion.**

⚠️ **AC1's second clause — a connected port that disappears from a kit — is recorded as UNMEASURED,
not as working.**

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

---

## 🚗 s27 (2026-08-18) — AC2 met, AC1 nuanced, AC3 NOT met

Full readings: [notes/s27-drive-observations.md](notes/s27-drive-observations.md).

- ✅ **AC2 met.** A node added to a live kit reached the editor library after **one viewer reload,
  no restart** (`nodegx.grow.Beta`; 185 types).
- ⚠️ **AC1 second clause — flagged, but not dropped.** Removing a port a live connection used:
  the value stops flowing at runtime, and a diagnostic **is raised and rendered** —
  `nodegx.rename.Badge · #probe-badge · input: caption`, code `con-no-target-port`. But the wire is
  **retained** in `connections.json`. So "silently retained" is false; "dropped" is also false.
  ✅ `WarningsModel` proven firing first (11 warnings, ten unrelated) — the zero-trap did not bite.
- 🔴 **AC3 NOT met.** A syntax error is *reported* and the old version does **not** keep running
  (so not the worst outcome), and the other three kits survive with the viewer still mounted — but
  the message is `SyntaxError: Unexpected identifier 'Noodl'`, naming **neither the kit nor the
  file**. The editor surfaces only `nodelibrary-unknown-node` on the node; "Broken Kit" appears
  nowhere in the UI. With four kits installed the author cannot tell which file to open.
  ✅ The kit **recovers** once the error is fixed.

🔴 **A second, worse failure mode found by hitting it:** a logic node missing `category` throws
`Node must have a category` out of `registerModule` and the **whole viewer renders nothing**
(`reactMounted:false`). `nodedefinition.ts:248` has `opts.name` on the next line and does not use
it. Same authoring-mistake class as AC3, opposite blast radius. Belongs with CN-015.
