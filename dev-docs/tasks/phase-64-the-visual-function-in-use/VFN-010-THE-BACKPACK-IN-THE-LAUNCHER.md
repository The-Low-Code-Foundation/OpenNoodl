# VFN-010 — The backpack, in the launcher

**Status:** 📋 open · **Tier 3** · ~1 day · depends on VFN-009

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
