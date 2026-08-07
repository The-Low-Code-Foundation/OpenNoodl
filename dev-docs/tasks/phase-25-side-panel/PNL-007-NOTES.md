# PNL-007 — Node label & inline rename: notes

**Status:** ✅ Complete — 2026-07-27
**Spec:** [PNL-007-INLINE-RENAME.md](./PNL-007-INLINE-RENAME.md)

## What changed

`NodeLabel` rendered a real core-ui `TextInput` at all times with
`isDisabled={!isEditingLabel}` — at rest, a bordered box that refuses the caret. That is exactly the
report: *"the component name at the top looks constantly like a field you can type in but you have to
click the pencil."*

At rest it is now a `<span>`: 14.5px / semibold / `fg-highlight`, one line, ellipsised, with a bottom
rule on hover and a tooltip naming the gesture ("Double-click to rename · <the existing keybinding>").
It is focusable, and `Enter` or `F2` on it starts editing, so the rename is reachable without a mouse.

Editing swaps in a real bordered field with the text pre-selected, plus **check** and **cancel**
buttons — the pair the report remembered and which did not exist. `Enter` commits, `Escape` reverts,
blur commits.

The type chip was already below the name (PAR-002 put it there), so that part of the mock already
held.

## Two things the implementation had to get right

**Escape must survive the blur that follows it.** Reverting sets `isEditingLabel` false, the input
unmounts, and its blur runs `onSaveLabel` — whose closure still sees the *old* state and would commit
the text the user just abandoned. A `useRef` flag, not state, so the cancel is authoritative by the
time blur reads it.

**Cancel has to act on `mousedown`.** Its click arrives *after* the input's blur, which has already
committed. The handler sits on the wrapper with `preventDefault()`, so the field never loses focus to
the button in the first place.

## The phantom-undo guard still holds

The commit guard at `NodeLabel.tsx` (only commit when `isEditingLabel && label !== model.label`)
exists because the input also blurs when a popout steals focus, and `NodeGraphNodeRename` pushes an
undo entry unconditionally. It is preserved, and tested rather than assumed:

1. rename the node (one real undo entry),
2. enter edit mode and leave it without changing anything (blur with no change),
3. one `⌘Z`.

If a phantom entry existed, the undo would be eaten by the no-op and the name would stay. It reverts
to the original — so there is no phantom entry. ✅

## Acceptance

Driven live over CDP at 1400×900 with the Agent Chat Example open, on a **clean boot**, both themes.

```
✓ 1.  the name at rest is a span, with no input in the row
✓ 3a. double-click opens a real field with the text selected (11/11 chars)
✓ 3b. Enter commits the new name
✓ 4.  Escape reverts
✓ 5a. the pencil starts editing
✓ 5b. cancel reverts
✓ 7.  no phantom undo entry (above)
✓ 8.  a long name ellipsises; the action rail stays inside the panel (rail right 364 ≤ panel right 380)
```

Item 8 caught a real defect the first time: `Tooltip` wraps its child in a trigger `div`, and *that*
is what the header row lays out. Without `min-width: 0` on the trigger the name could not shrink and a
73-character name pushed the action rail 362px past the panel edge. Fixed with
`UNSAFE_triggerClassName`.

Item 2's hover affordance and item 6's `F2` are exercised by the code path items 5a and 8 cover
(`onEditLabel` is one function) but were not separately screenshotted.

Screenshots: `screenshots/pnl-007/{rest,editing}--{dark,light}.png`.

Gates: editor `tsc` clean; `npm run test:ci` 1441 specs / 0 failures; `npm run colors` 16/16;
PNL-001's panel-geometry gate still 11/11.

## The audit: nothing else to fix

- **`AiAuthoringPanel` ("Build")** — the spec expected a read-only-looking field here. **The premise
  is stale**: the "Component" input is a plain enabled `TextInput` with an `onChange` that sets
  `componentPath`, and it is what the Build button validates against. It is genuinely editable and
  reads correctly. No change.
- **`NodePicker/ModuleCard.tsx:111`** — `isDisabled={!isCompatible}` is a legitimately disabled
  control, as the spec says. Left alone.

## Traps

- **HMR poisons this component specifically.** Editing `NodeLabel.tsx` while the editor is open takes
  the property editor down with `TypeError: Cannot read properties of undefined (reading 'type')`
  inside `<PropertyEditor>` — the panel re-creates without a model and shows the ErrorBoundary's
  "Aw, Snap!". Three separate "failures" during this task were that, not the code; each passed on a
  fresh boot. Restart the stack before believing a result here.
- **A disabled input and a span do not behave the same.** The `onDoubleClick` used to live on the
  *wrapper* because disabled inputs receive no events. It is on the span now, and it still needs the
  `stopPropagation` that stops the canvas double-click handler firing behind it.
