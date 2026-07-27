# PNL-007: Node Label & Inline Rename

## Metadata

| Field | Value |
|-------|-------|
| **ID** | PNL-007 |
| **Phase** | Phase 25 — Side Panel (Track J) |
| **Tier** | 3 — surfaces |
| **Priority** | 🟡 Medium (small, visible, and a regression from the old editor) |
| **Difficulty** | 🟢 Easy |
| **Estimated Time** | 2 days |
| **Prerequisites** | none. Overlaps PNL-005 in the same header bar — see *Coordination*. |
| **Mock** | [`mocks/nodegx-side-panel-mock.html`](./mocks/nodegx-side-panel-mock.html) — the "Component name" before/after pair; the proposed side is interactive |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟢 **Sonnet 5** |

## Objective

Show the selected node's name as text until the user chooses to edit it, restoring the double-click
rename the old editor had and removing the field that looks editable but isn't.

## Background

Reported as: *"the component name at the top looks constantly like a field you can type in but you have
to click the pencil. In the old days, the top component name was not in a visible field, you could
double click it to rename it and hit return to finish, as well as the pencil and check icons."*

The report is accurate about the cause.
[`NodeLabel.tsx:171-184`](../../../packages/noodl-editor/src/editor/src/views/panels/propertyeditor/components/NodeLabel/NodeLabel.tsx#L171-L184)
renders a real core-ui `TextInput` at all times, with `isDisabled={!isEditingLabel}`. So at rest it is
a bordered field that refuses the caret. It also has a `TextInputVariant.Transparent` variant, which is
evidently not transparent enough in light mode to read as text.

Double-click **already works** — there's an `onDoubleClick` on the wrapper at lines 163-169, and
`Keybindings.PROPERTY_PANEL_EDIT_LABEL` is bound. Nothing communicates either. The check icon the
report remembers does not exist; commit is on blur or Enter.

## Current State

`NodeLabel` is 243 lines of otherwise sound React. Worth preserving as-is:

- The commit guard at lines 123-137 — it deliberately only commits when `isEditingLabel && label !== model.label`,
  because the input also blurs when a popout steals focus and `NodeGraphNodeRename` pushes an undo
  entry unconditionally. **Do not lose this.** Removing it fills the undo queue with phantom "change
  label" entries, which is a bug someone already fixed once.
- `ParameterValueResolver.toString(model.label)` defensiveness — labels can be expression objects.
- The `labelChanged` model subscription.
- The type chip (PAR-002) and its category glyph.

## Desired State

Per the mock:

**At rest** — a `<span>`, not an input: 14.5px / weight 650 / `fg-1`, single line, ellipsised. On hover,
a subtle bottom rule as an affordance, and a tooltip naming the gesture ("Double-click to rename · F2").
The action rail (docs / pencil / trash) sits to its right as today.

**Editing** — entered by double-click, the pencil, or the existing keybinding. Swaps in a real bordered
field, text pre-selected, with **check** and **cancel** buttons. `Enter` commits, `Escape` reverts,
blur commits (preserving the existing guard).

The type chip moves below the name, where it doesn't compete with the action rail. Keyboard: the span
is focusable and `Enter`/`F2` on it starts editing, so this is reachable without a mouse.

### The same defect elsewhere

Audit for other read-only-disabled-input-as-label instances and fix the ones in the sidebar. Known:

- **`AiAuthoringPanel` ("Build")** — the "Component" box reads as a filled field you can't type in
  (visible in the reported screenshots). Determine whether it is genuinely read-only; if so it should be
  text, and if it's meant to be editable it should be enabled.
- `NodePicker/components/ModuleCard.tsx:111` uses `isDisabled={!isCompatible}` — that is a legitimately
  disabled control, not a label. Leave it.

Do not turn this into a codebase-wide sweep; two panels and a note for anything else found.

## Coordination

PNL-005 changes the *bar* this label sits in (`property-header-bar` → the shared `PanelHeader`); this
task changes the label *inside* it. They touch adjacent CSS in the same files. Whichever lands second
must verify the other still holds — specifically that the label's ellipsis and the action rail still
work inside the 44px shared header. If both are in flight, the executors should agree who owns
`property-header-row`.

## Scope

### In scope
- `NodeLabel.tsx` and the `property-header-*` CSS it uses.
- The `AiAuthoringPanel` component field.

### Out of scope
- The rest of the property editor's contents (phase-9 / STYLE-004).
- The components tree's inline rename, which already behaves correctly (PNL-006 keeps it).
- Renaming *components* vs *nodes* — this is the node label; component rename lives in the tree.

## Acceptance

Live-verified via the `run-editor` skill, both themes:

1. Select a node. The name reads as text — no field border, no field background — and is legible on light.
2. Hover it: the affordance and tooltip appear.
3. **Double-click** it: it becomes an editable field with the text selected. Type, press `Enter` — the
   name changes on the node in the panel *and* on the canvas card.
4. Double-click, type, press `Escape` — the name reverts and no undo entry is created.
5. The pencil does the same as double-click; the check commits; cancel reverts.
6. `F2` (or whatever `PROPERTY_PANEL_EDIT_LABEL` resolves to) still starts editing.
7. **The phantom-undo guard still holds**: start editing, then open a popout (e.g. a colour picker) so
   focus leaves without a change. Check the undo queue — no "change label" entry. This is the regression
   test for the thing lines 123-137 exist to prevent.
8. A very long node name ellipsises at 240px panel width and does not push the action rail off.
9. Screenshots of rest and editing states, both themes, under `screenshots/pnl-007/`.

Gates: editor `tsc` clean; `npm run test:ci` for `noodl-editor` green.

## Notes for the executor

- Read the comment at `NodeLabel.tsx:123-127` before changing the commit path. It documents a real bug
  that was fixed; the acceptance list's item 7 is there to stop it coming back.
- Use the UndoQueue panel (dev mode) to check item 7 rather than inferring it.
- A disabled input and a span do not have the same event behaviour — the current `onDoubleClick` is on
  the *wrapper* precisely because disabled inputs don't receive events. Once the span is real, the
  handler can move onto it; make sure it still doesn't propagate to the canvas double-click handler
  (line 165's `stopPropagation` exists for that reason).
- Commit with a pathspec limited to your files.
