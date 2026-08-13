# VFN-010 — The backpack, in the launcher

**Status:** ✅ **BUILT 2026-08-13 on `vfn-f-backpack`** (`618deb7e`; merged `3acf2941`) · ✅
**SPEC-PROVED** — 4 new suites / 44 tests · 🔴 **NOT DRIVEN — nothing here has been on screen** · 🔴
**OWED:** all seven items in [§ What is owed to a drive](#-what-is-owed-to-a-drive) · **Tier 3** ·
depends on VFN-009 (built and merged, `a5cab23e` / `00261768`, **and amended here** — see below)

> **Gates:** `npx tsc -p tsconfig.json --noEmit` clean · `npx jest` **179 suites / 2666 passing**,
> up from the 175 / 2622 baseline by exactly the four suites and 44 tests added here.
> Nothing in this section has been on screen — see *What is owed to a drive* at the foot.

## The report

> *"Then for backpack blocks (which should be marked in the block picker in a way you can tell which
> are backpack and which are project scoped), you should have a menu in the launcher I imagine, since
> they're saved to your NodeGX and not that one project, where you again can open the blockly editor
> and edit the saved blocks, with the warning 'this block is placed in 2 projects in 8 places, are
> you sure? Changes propagate everywhere'"*

Two halves. The marking is small and belongs wherever the picker is. The launcher manager is a second
instance of VFN-009's section against a different shelf — and it has one honest limitation that must
be stated in the UI rather than worked around.

## Where the backpack actually is

[`MyBlocksShelves.ts:35-38`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/MyBlocksShelves.ts):

```ts
export const PROJECT_LIBRARY_SETTING = 'myBlocks.library';   // ProjectModel settings → project.json
export const USER_LIBRARY_SETTING   = 'myBlocks.backpack';   // EditorSettings → the editor's own JSON
```

`EditorSettings` is the editor's own file on disk and follows the builder between projects — so the
backpack is already exactly what the report assumes it is. The launcher can read and write it with
the same `EditorSettings` instance.

⚠️ **`EditorSettings.set` debounces its disk write by 1000 ms**, and that is written down in the
shelf's own header as trap 2: *"A backpack save immediately before a quit can be lost."* A launcher
that writes the backpack and is then quit has the same window. Flush before the launcher closes, or
state the limit — do not silently inherit it.

⚠️ **`ProjectModel.setSetting` bails on reference equality**, trap 1 in the same header. Always write
a fresh clone. This bites the project shelf, not the backpack, but the manager touches both.

## Part 1 — mark the shelf in the picker

`callBlockJson` already carries the definition through to the flyout
([`MyBlocksBlocks.ts:121-133`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/MyBlocksBlocks.ts))
and `store.scopeOf(id)` already answers which shelf it is on. Group the My Blocks category under two
`kind: 'label'` headings — *This project* and *My backpack* — using the same mechanism VFN-008's shape
labels use.

Headings rather than a colour or a glyph on the block, for two reasons: the block's colour is already
the category's hue and carries meaning, and a per-block mark on an SVG block is the exact shape that
produced nine dark-on-dark glyphs in DSG-008.

**Why this matters more than it looks:** a block on the backpack works for its author and is missing
for a collaborator who opens the project. The picker is the moment that consequence is choosable, and
right now the two shelves are indistinguishable there.

⚠️ **Project wins on an id collision** — that rule is in `store.ts`'s header and the grouping must not
imply a block is on both shelves when `list()` deliberately returns only the resolving copy.

## Part 2 — the launcher manager

[`LauncherSettingsDialog.tsx`](../../../packages/noodl-editor/src/editor/src/pages/ProjectsPage/LauncherSettingsDialog.tsx)
is the existing app-wide settings surface and is where this goes.

Same rows as VFN-009's section — name, shape, description, usage, edit, rename, duplicate, delete,
export/import — against the **user shelf only**. Import/export matters more here than in the project:
a backpack is where a builder accumulates blocks worth sharing, and `exportDefinitions` already
closes over dependencies by default.

### 🔴 The usage count across projects, and what it can honestly say

The report asks for *"this block is placed in 2 projects in 8 places."* That number requires opening
and parsing every project the builder has, and the launcher only knows the ones in its recent-projects
store — which is a list of places it has been, not an inventory of everywhere the block is.

**Say what is true and no more:**

> Used in **8 places across 2 of your 4 recent projects**. It may be used in projects not listed here,
> and in projects on other machines. Changes apply everywhere this block is used.

Three properties, all deliberate: the number is real, its scope is stated, and the warning does not
depend on the number being complete. A count presented as total when it is a sample is a warning that
teaches the builder to distrust warnings.

⚠️ Scanning N projects off disk is I/O in a dialog. Compute it on demand behind an explicit *"check
where this is used"* action rather than on render, and show the answer with its timestamp.

### Editing a backpack block from the launcher

The launcher has no node graph and no Blockly window. Two options, in preference order:

1. **Open the editor on the definition.** The launcher's job becomes "hand this definition to an
   editor window and let VFN-009's definition tab do the work". One implementation of block editing,
   in one place, which is the whole reason VFN-009 comes first.
2. If that proves too heavy for a launcher-only session, the launcher manages metadata — rename,
   describe, delete, export, import — and *opening the blocks* is stated as something done from a
   project. That is a smaller, honest surface and is an acceptable first cut.

**Not acceptable:** a second Blockly host in the launcher with its own save path. Two writers to one
shelf is the one-fact-two-stores shape, and this shelf has a 1000 ms debounce in front of it.

## Acceptance criteria

1. The My Blocks category groups its entries by shelf, with headings, in a way that survives a
   screenshot in both themes.
2. The launcher lists every backpack definition with its shape and description.
3. The cross-project usage check names the projects it scanned and says so in the sentence.
4. Rename, delete and import/export behave identically to VFN-009's section, because they call the
   same store.
5. Deleting a backpack block that a scanned project uses is refused, naming the project.
6. A backpack write from the launcher survives a quit — or the 1000 ms window is flushed explicitly
   and that is proved.

## How to prove it

The grouping and the sentence builders go in the plain-Node runner.

The cross-project scan is a pure function of (list of project JSONs, definition id) if the disk read
is kept at the edge — write it that way and it is gradeable without a launcher.

A drive for the launcher surface itself, and for the quit-survival check: write a rename, quit within
a second, reopen, and read the shelf. That is the only way that trap has ever been visible.

---

# What was built — 2026-08-13, branch `vfn-f-backpack`

## 🔴 What was REUSED, which is the whole point

VFN-010's own instruction was that this is *"a second instance of VFN-009's section against a
different shelf"*, not a second implementation. That was held, and it is now held by a spec that
reads the directories and convicts a second component:

| Reused, unchanged | Where |
|---|---|
| **The manager itself** — `SavedBlocksSection` | mounted twice: `ProjectSettingsTab` (no prop) and `LauncherSettingsDialog` (`shelf="user"`) |
| Every write door — `renameDefinition`, `duplicateDefinition`, `removeDefinition`, `exportDefinition` | `MyBlocksLibrary.ts` |
| The store, the cycle guard, `remove`'s refusal, `importLibrary`'s id remapping | `myblocks/store.ts` |
| **`collectReferences` → `scanNodeUsage`** — one authority on what a reference *is* | `myblocks/usage.ts` |
| `distinctSites` — so "8 places" means eight *nodes*, not eight call blocks | `myblocks/usage.ts` |
| Every sentence, and `UNPROVABLE_CLAIM` | `myblocks/libraryIntent.ts` |
| `SHELF_LABEL` — the picker's headings are the section's words | `myblocks/libraryIntent.ts` |

The launcher writes nothing of its own. Its delete ends at the same `store.remove` the project
delete ends at; the only difference is where the list of referencing node ids came from.

## Genuinely new

**§1 — the picker marks the shelf.** `myblocks/shelfGrouping.ts` (pure) partitions definitions by
the shelf each one *resolves from*, and `myBlocksFlyout` prints a `kind: 'label'` heading over each
run. Headings rather than a colour or a per-block glyph, for the two reasons the task gives — the
block's hue is already the category's, and a mark on an SVG block is the shape that produced nine
dark-on-dark glyphs in DSG-008.

**Partition, not tag.** *Project wins on an id collision* and `list()` returns only the resolving
copy, so a definition appears under exactly one heading. A block shown under both would tell the
builder something false about which body their call blocks expand.

**§2 — the launcher manager.** `<SavedBlocksSection shelf="user" />` in `LauncherSettingsDialog`,
below Appearance and AI, on the same argument those two are there: the backpack is
`EditorSettings`' `myBlocks.backpack`, which is app-wide and not part of any project.

**The cross-project count.**

- `myblocks/projectFile.ts` (pure) — a project **on disk** reduced to the same `ProjectScan` a live
  project reduces to. **Both formats**: legacy `project.json` (`components[].graph.roots[]`, nodes
  nesting their children) and v2 (`components/<path>/nodes.json`, a **flat** array with children as
  ids). A converter pointed at the wrong format returns a well-formed scan with no nodes in it,
  which reads downstream as *"used nowhere"* — the input that turns a refusal into a deletion. Both
  directions have a watched control.
- `myblocks/crossProjectUsage.ts` (pure) — counts, and records `scanned`, `unreadable` and
  `checkedAt` beside the count.
- `MyBlocksRecentProjects.ts` (edge, I/O) — `LocalProjectsModel` → snapshots. The v2 walk goes over
  `components/` on disk rather than `_registry.json`, deliberately: a stale registry would make a
  component invisible, and invisible means "not used".

**The sentence, exactly as the report asked and no further:**

> *"Discount" is used in 8 places across 2 projects. 4 recent projects were checked: Alpha, Beta,
> Gamma, Delta. It may be used in projects not listed here, and in projects on other machines.
> Changes apply everywhere this block is used.*

Three properties, each with its own spec: the number is real, its **scope is named** (criterion 3),
and the propagation clause is present whether the count is eight or zero.

**"Not checked" is a third state.** `wasChecked()` keeps *checked, found nothing* apart from *never
asked*, and the row says `Where "Discount" is used has not been checked.` until the explicit button
is pressed. Branching on `siteCount === 0` alone would say "not used anywhere" about a question
nobody asked — a licence to delete.

**Import.** `importDefinitions` → `store.importLibrary`, `remapExisting` deliberately **off** so
re-importing your own export updates in place rather than minting a second copy of everything with
the call blocks split between them.

**Editing the blocks: VFN-010's option 2, stated in the UI.** The launcher has no canvas, so it
manages metadata and `BACKPACK_EDIT_NOTE` says the blocks are opened from a project. What was
explicitly *not* built is the thing the task refuses: a second Blockly host in the launcher with its
own save path.

## 🔴 Two defects found in VFN-009's merged manager, both fixed here

VFN-009 has never been driven, so its code was read sceptically. Two things were wrong, and both
would have been inherited by this second instance:

**1. The 1000 ms backpack window was inherited on five doors.** `MyBlocksShelves.ts`'s own header
names it as trap 2 and says *"not fixable from here"* — but `EditorSettings.store()` is public and
awaitable, and VFN-009's section offers Rename, Duplicate, Delete, Edit blocks and Detach on backpack
rows with nothing behind any of them. `flushShelves()` now exists and `flushIfBackpack()` fires it
from every mutating door in `MyBlocksLibrary.ts`; `LauncherSettingsDialog` awaits one more on its way
out. **This fixes both instances**, which is the argument for one manager rather than two.

**2. `handleExport` announced a success for a copy of nothing, and said "-1".** Reproduced against
the real store: `exportDefinitions(['gone-id'])` returns an empty library, and the section's inline
`its ${library.definitions.length - 1} dependencies` produced

> *Copied "Discount" and its **-1** dependencies to the clipboard.*

as a **success** toast. The window is real and this task widens it — the same shelf now has two
managers over it. Both halves fixed: `describeExportResult` / `exportSucceeded` moved the arithmetic
into `libraryIntent.ts` where a runner can grade it (VFN-009's own rule, which that one message
broke), and an empty export now reports as a failure and refreshes the list.

## Acceptance criteria

| # | | |
|---|---|---|
| 1 | Picker groups by shelf, with headings | ✅ headless; **the screenshot in both themes is owed to the drive** |
| 2 | Launcher lists every backpack definition with shape and description | ✅ built; owed to the drive |
| 3 | The check names the projects it scanned, in the sentence | ✅ `backpack-intent.spec.ts` |
| 4 | Rename / delete / import / export call the same store | ✅ `backpack-surface.spec.ts` |
| 5 | Deleting a block a scanned project uses is refused, naming the project | ✅ `cross-project-usage` + `backpack-intent` |
| 6 | A backpack write survives a quit | 🟡 **half**: the flush exists and is on every door (spec'd); the quit itself is owed to the drive |

## What was proved, and with which control

Every pass below was watched red first by injecting the pre-fix behaviour into the source, running,
and restoring.

| Claim | Control watched go red |
|---|---|
| The flyout prints a shelf heading over each run | `lookup = undefined` (the pre-fix flyout) → **3 of 9 red**, headings absent |
| The legacy walker descends into `children` | deleted the `children` push → **8 of 11 red** |
| `unreadable` is never folded into `scanned` | `unreadable: []` → red |
| `wasChecked` is not `siteCount > 0` | replaced it with exactly that → red |
| The caveat travels with every count | dropped it for `siteCount === 0` → red |
| An unchecked result is not rendered as a finding | removed the `wasChecked` guard → red |
| There is no second manager | added `LauncherBackpackSection.tsx` → red |
| The flush is on every door | emptied `flushIfBackpack` → red |
| The export message | restored VFN-009's `- 1` arithmetic verbatim → red |

Two more controls are permanent members of the suite rather than injections: each on-disk converter
is run over the *other* format and must find nothing **while the same instrument finds it in its own
format**; and `UNPROVABLE_CLAIM` is run over five sentences this surface is tempted to write
("Deleting this will break 8 flows across 2 of your projects") and must convict all five.

**Watched, not written:** VFN-009's `write-path.spec.ts` went red on its own when `importLibrary`
appeared in `MyBlocksLibrary.ts`, and VFN-008's flyout specs went red when the headings appeared.
Both were updated with the argument in the comment rather than relaxed.

## 🔴 What is owed to a drive

Nothing in this task has been on screen, and VFN-009's section beneath it never has either.

1. **The picker headings, screenshotted in both themes** — criterion 1 says "survives a screenshot",
   and a `kind: 'label'` in a Blockly flyout has never been rendered in this editor. DSG-008's
   register entry is about exactly this class of thing.
2. **The launcher section renders at all.** `SavedBlocksSection` reaches `ProjectModel.instance`
   (guarded with `?.`), `ToastLayer` and `DialogLayerModel` from a page that has never hosted it.
   A dialog inside a dialog is supported by `DialogLayerModel`'s ordering but has not been seen.
3. **⚠️ `BaseDialog` renders every dialog body twice.** Every button in the refusal and confirm
   dialogs has an invisible twin ahead of it in the tab order. Filter
   `:not([class*=MeasuringContainer])` when driving.
4. **The cross-project check against real folders.** The converters are graded against fixtures;
   `listDirectoryFiles` over a real v2 `components/` tree, and the relative-path arithmetic that
   turns a `nodes.json` path back into a registry path, are not.
5. **🔴 Criterion 6, the half that is owed.** *"Write a rename, quit within a second, reopen, and
   read the shelf."* The flush is proved to exist and to be called; whether the bytes reach
   `editorSettings.json` before the process dies is only visible this way.
6. **The delete refusal end to end** — a backpack block used by a recent project, deleted from the
   launcher, refused by name. The pieces are each graded; the gesture is not.
7. **Import from the clipboard** — `navigator.clipboard.readText()` in the launcher window.
