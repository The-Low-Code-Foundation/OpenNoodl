# DEF-029 — a file cannot be dropped onto anything, because file drop was never authorable

**Registered from** phase 77 [D15](../phase-77-the-site-builder-rescue/DEFECTS-THE-SITE-BUILDER-FOUND.md#d15).
**Blocks** P77 SBR-007 AC3, whose TASKS.md row reads *"AC3 is unchanged and still blocked by D15 alone"*.
**Status** 🟢 built, specced, mutation-checked. ⬜ undriven in a real editor.

---

## 1. The person sentence

A builder puts a card on a screen and wants a photo dropped onto it. There is no way to say so.
Not a wire they got wrong, not a port they could not find — the runtime had no drag-and-drop API
at all, so *"drop a file here"* was a sentence the product could not be told.

## 2. The measurement, re-taken

The register's conclusion was right and one of its numbers was not, which s28 corrected. Re-taken
word-boundary against known-firing controls, on `packages/noodl-viewer-react/src`:

| probe | count |
| --- | --- |
| `onDrop`, `onDragOver`, `onDragEnter`, `onDragLeave`, `onDragStart`, `dataTransfer` | **0** each |
| `onClick` (control) | 37 |
| `onMouseDown` (control) | 8 |

⚠️ A *substring* `onDrop` reads **8**, every one of them `onDropped` — ERG-001's queue-discard
callback, nothing to do with files. That is what made the register's original `0` a true
conclusion resting on a false number. ⚠️ `draggable` = 7 is `react-draggable`, the `Drag` node's
pointer gesture: a different feature, not a partial implementation of this one.

## 3. What a dropped file is — a question that was already answered

The handoff scoped this row as needing *"a decision about what a dropped file is in this
runtime"*. It did not. The contract already exists and is written down:

- `Open File Picker` emits a browser `File` on a `type: '*'` port named `File`, beside
  `Name` / `Type` / `Size in bytes` / `Path`.
- `Upload File`'s `File` input describes itself as *"The file to upload, as an Open File Picker
  node produces it"*.

So the ports built here emit **that same shape under those same names**. A drop zone wires into
the upload path that already exists rather than beside it, and nothing new had to be invented.

🔴 This is the "ask the door whether the kit already can" lesson paying out in the useful
direction: the capability was genuinely absent, but the *vocabulary* for it was already shipped.

## 4. What was built

One shared port group on the five visual nodes that already share pointer events — `Group`,
`Text`, `Image`, `Circle`, `Video` — added through
`node-shared-port-definitions.ts:addFileDropPorts`, one call per node file.

**Inputs** — `Accept File Drops` (boolean, default `false`) and `Accepted file types` (string,
same vocabulary as `<input accept>` and as the picker's port of the same name).

**Outputs** — `Files Dropped` (signal), `Files Rejected` (signal), `File` (`*`), `Files` (array),
`File Name`, `File Type`, `File Size In Bytes`, `Is Dragging Over` (boolean).

### It is off by default, and that is the whole safety argument

`preventDefault` on `dragover` is what makes an element droppable **and** what stops the browser
navigating away to the dropped file. Installing it unconditionally would change what every
existing project does with a stray drop. So the handlers are installed on every node and return
immediately unless the author switched the port on — checked at *event* time, not render time,
for the reason `stopsClickPropagation` documents: a port set while the preview is running does
not re-render the node, so a render-time answer is stale exactly when someone is testing it.

Everything except that one checkbox is a **dynamic port**, so a node nobody enabled drops on
gains one row and no output clutter. Dynamic gating of *outputs* had no precedent in this
repo; it was verified end to end before being relied on — `PortsTab.buildRows(model, direction)`
passes both plugs through the filter, and the connection popup's `ConnectionBar` applies the
same one, so a gated output is hidden in every surface an author meets.

### Three details that are the difference between working and nearly working

1. **The drag-depth counter.** Dragging onto a child fires `dragleave` on the parent, so a plain
   boolean flickers off the moment the pointer crosses an inner edge — and every real drop zone
   has a child, because *"Drop files here"* is one.
2. **`dataTransfer.types` must contain `'Files'`.** Otherwise dragging selected text within the
   page lights the zone up and has its default suppressed.
3. **A drop with nothing acceptable in it fires `Files Rejected`, not `Files Dropped`.** The same
   Failure-Contract clause that makes `Open File Picker` report `Unchanged` on an empty
   `FileList`: a completion signal must not fire for an operation that produced nothing. Silence
   was not the alternative — an author who set `image/*` and dropped a PDF would have no way to
   tell the app from a broken one.

### The drag events are deliberately outside `blockTouch`

`blockTouch` installs a `stopPropagation` blocker on **every** event it covers, including ones
with no listener. Folding the drag events into that list would mean a child with "Block Pointer
Events" on silently kills the drop zone it sits inside: the parent's `dragover` never runs, so it
never calls `preventDefault`, so the browser refuses the drop over that region with no diagnosis
anywhere. Nesting is settled where it can be reasoned about instead — the innermost enabled zone
calls `stopPropagation` on the drop it handles, which is the rule `clickBubbling` already applies
to clicks.

## 5. Acceptance

`packages/noodl-viewer-react/tests/def029-file-drop.test.ts` — 26 rows, green.

⚠️ Graded against **`Text`**, not `Group`, and not by preference:
**`src/nodes/visual/group.ts` cannot be imported from a test in this package at all.** Its
component pulls in `Group/scroll-plugins/nested-scroll-plugin.js`, a plain `.js` file using ESM
`export`, and this package's jest preset is bare `ts-jest`, which transforms `.ts`/`.tsx` only.
The import throws `SyntaxError: Unexpected token 'export'` and the suite reports `Tests: 0
total` — which reads like a missing file rather than a broken import. Pre-existing, unrelated to
this build, and **registered as an unowned row**: the runtime's most-used visual node is
unreachable from a unit test. Group is covered here by a row driving `addFileDropPorts` directly,
which is the whole of what `group.ts` does for this feature.

### The mutation evidence

Eight mutants, each reddening a **different** row — no single row carries the file:

| mutant | row that went red |
| --- | --- |
| `dragover` no longer prevents default | *prevents the default on dragover* |
| the enabled check removed | *does not prevent the default…* + *ignores a drop entirely* |
| drag depth becomes a plain boolean | *stays true while the pointer crosses onto an inner element* |
| a rejected drop fires the completion signal | *says so rather than going silent* + the look-alike row |
| the outputs list emptied (gating removed) | *hides everything but the one checkbox* |
| drag events folded into `blockTouch` | *does not let Block Pointer Events kill a parent drop zone* |
| the innermost zone no longer owns the drop | *stops the drop at the innermost zone* |
| a non-file drag is acted on | *ignores a drag that carries no files* |

🔴 **A ninth mutant survived and was the session's most useful minute — because it had not.**
Renaming the dynamic `outputs:` key to `mutantOutputs:` is a *type error*, so ts-jest compiled
nothing and the suite never ran; the harness grepped for `✕`, found none, and read that as "the
mutant survived". A suite that fails to run and a suite with no failures are the same reading
through that instrument. Re-run type-validly (`outputs: []`), it reddens the gating row.
✅ **Report cardinality (`Tests:`) beside every mutant, never just the failure lines.**

## 6. What this row does not cover

- ⬜ **Undriven in a real editor.** Nobody has watched `Accept File Drops` appear in a property
  panel, ticked it, and dropped a file on a canvas. 🔴 A drive serves a **built bundle** —
  rebuild `noodl-viewer-react` first (~40s) or the ports are invisible.
- ⬜ **Directory drops.** `dataTransfer.items` / `webkitGetAsEntry` are untouched; dropping a
  folder yields whatever the browser puts in `files`, which is usually nothing.
- ⬜ **Paste.** `onPaste` with a file clipboard is the same capability through a different
  gesture and is not built.
- ⚠️ **`File Drop` is classified `plumbing` in `propertyPanelTiers.ts`**, so it folds into
  `Advanced CSS` beside `Pointer Events` rather than showing on the first screen. That is an
  appearance judgement and a **one-line revert** — deleting the entry puts `Accept File Drops` on
  the first screen of all five nodes. It is filed advanced because that is five nodes' basic tier
  taxed permanently for a port most screens never set. **Richard's call if he wants it promoted.**


---

## 6. Half a drive (session 35)

✅ **The ports are live in a running editor.** Read off
`NodeLibrary.instance.getNodeTypeWithName('Text')` in a real `dev:debug` renderer — the same
declaration the property panel builds from. All eight outputs and both inputs are present, grouped
and labelled:

| name | plug | group | label |
| --- | --- | --- | --- |
| `acceptFileDrops` | input | File Drop | Accept File Drops |
| `acceptedFileTypes` | input | File Drop | Accepted file types |
| `filesDropped` | output | File Drop | Files Dropped |
| `filesRejected` | output | File Drop | Files Rejected |
| `droppedFileName` / `droppedFileType` / `droppedFileSizeInBytes` | output | File Drop | File Name / File Type / File Size In Bytes |

⚠️ A peer reports these fold into **Advanced CSS** in the rendered panel — expand it or a drive
reports them missing. **Not verified here**: this reading is the node library, not the panel's DOM.

🔴 **Still owed, and it is the half that matters**: nobody has dragged a file onto a running
preview and watched `Files Dropped` fire, `Is Dragging Over` go true, or a rejected type take the
`Files Rejected` arm. That needs CDP's `Input.dispatchDragEvent` with a real `DataTransfer` —
`scripts/devtools/cdp.js` does not expose it today, and a synthetic DOM event would bypass exactly
the `preventDefault`-on-`dragover` behaviour this row is about.
