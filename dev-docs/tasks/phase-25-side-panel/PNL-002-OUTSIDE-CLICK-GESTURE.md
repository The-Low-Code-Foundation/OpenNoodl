# PNL-002: Outside-Click vs. Drag in the Popup Layer

## Metadata

| Field | Value |
|-------|-------|
| **ID** | PNL-002 |
| **Phase** | Phase 25 — Side Panel (Track J) |
| **Tier** | 1 — correctness |
| **Priority** | 🟠 High (reported as "drives me nuts"; affects every popup, popout and modal) |
| **Difficulty** | 🟡 Medium (the change is small; the file gates every dismissal in the editor) |
| **Estimated Time** | 2–3 days, most of it verification |
| **Prerequisites** | none |
| **Mock** | [`mocks/nodegx-side-panel-mock.html`](./mocks/nodegx-side-panel-mock.html) — finding 3; the divider drag in the prototype demonstrates the pointer-capture pattern |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔵 **Opus 5** — a load-bearing global event handler with no test coverage and five distinct dismissal behaviours to keep working |

## Objective

Stop a drag that begins inside a panel and ends outside it from being treated as a click outside,
so that drag-selecting text in a panel field no longer dismisses what you were working in.

## Background

Reported as: *"I click drag text to the right in fields and it kicks me out because I stop dragging
accidentally outside the side panel right limit."*

The mechanism is a DOM subtlety, not a Noodl bug per se. **A `click` event is dispatched to the
nearest common ancestor of the mousedown and mouseup targets.** Press inside a panel input, drag
right, release over the canvas, and the `click` that follows has `target === <body>`.

[`popuplayer.ts:320-341`](../../../packages/noodl-editor/src/editor/src/views/popuplayer.ts#L320-L341)
implements dismissal as a mousedown/click pair:

```ts
body.addEventListener('click', (e) => {
  if (!isInside(e.target, this.popupEl) && shouldClosePopup && !this.modals.length) {
    this.hidePopup(); this.hideTooltip();
  }
});
body.addEventListener('mousedown', (e) => {
  shouldClosePopup = !isInside(e.target, this.popupEl) && !this.isLocked;
});
```

`isInside` walks up from `e.target`, so `<body>` is never inside anything — the guard passes and the
dismissal fires. There are **three** such pairs (popup, popouts, modal), each with the same shape.
`popoutsEl` and `popupEl` are siblings under `this.el` (lines 242–254), which matters: a mousedown
inside a popout is *not* inside `popupEl`, so it arms `shouldClosePopup`.

### What to expect from the repro

The confirmed consequences of the gesture, from reading the code:

- Drag from **any panel field** → releasing outside fires `hidePopup()` + `hideTooltip()` and, if a
  popout is open, `hidePopouts()`.
- Drag from **inside a popout** (the styling/colour popouts, where most of this UI lives) → fires
  `hidePopup()`, because a popout is outside `popupEl`.
- Drag from **inside a popup** is already safe — the mousedown target is inside `popupEl`.

**Confirm which of these is the one Richard is hitting before building the fix.** The description
("fields in the side panel") is consistent with more than one of them, and it is possible the felt
symptom has a second cause on top of this one — a `blur`-commit path, for instance
([`BasicType.ts:197`](../../../packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataTypes/BasicType.ts#L197)
calls `el.blur()` on commit). If the repro shows a different cause, **fix the actual cause and record
the correction in NOTES** rather than implementing around this description.

## Current State

- Three `mousedown` + `click` dismissal pairs in `popuplayer.ts` (popup, popouts, modal).
- A Windows-specific `contextmenu`-after-`mousedown` workaround at lines 350–358 that must keep working.
- `this.isLocked` and `this.modals.length` guards that must keep working.
- No tests cover any of this.

## Desired State

Dismissal decides on **pointerdown** and acts on **pointerup**, and requires *both* ends of the
gesture to be outside. Concretely, for each of the three pairs:

- On `pointerdown`, record whether the target was outside (as today).
- On `pointerup`, dismiss only if the down target was outside **and** the up target is also outside.
- Do not key any of this off `click` at all.

A gesture that starts inside and ends outside is a text selection, not a dismissal. A gesture that
starts outside and ends inside is a mis-drag onto the popup — also not a dismissal.

Prefer pointer events over mouse events so a stylus or touch behaves the same; keep the existing
`isLocked` / `modals.length` / Windows-`contextmenu` guards exactly as they are.

### Second, smaller change

Panel fields that support drag-to-select should hold the pointer for the duration of the gesture
(`setPointerCapture` on pointerdown, release on pointerup) so that events during the drag are
delivered to the field regardless of what is under the cursor. The prototype's divider does this and
is worth reading as a reference. **Apply this only where a drag gesture is actually owned by the
element** — do not blanket-capture on every input, which would break native selection behaviour.

## Scope

### In scope
- `views/popuplayer.ts` — the three dismissal pairs.
- Pointer capture for genuinely drag-owning panel controls, if the repro shows it is needed.
- The manual test matrix below, written up in NOTES as a repeatable checklist.

### Out of scope
- Rewriting the popup layer. It is a legacy imperative view; this task changes ~15 lines inside it.
- The React-side `MenuDialog` / `BaseDialog` outside-click handling in core-ui, **unless** the repro
  implicates it — in which case extend the fix there and say so.
- `SheetSelector.tsx:61` and `Clippy.tsx:94`, which have their own `document.mousedown`
  click-outside handlers. Audit them for the same defect and **record findings**; fix them here only
  if they are trivially the same shape.

## Acceptance

Manually verified in a running editor — there is no automated coverage for this file and adding it is
out of proportion:

1. **The reported gesture.** Open a panel with a text field, press inside it, drag right past the
   panel edge over the canvas, release. The field keeps focus and its selection; nothing closes.
2. Same gesture starting inside a **popout** (a colour/style popout from the property editor).
3. Same gesture starting inside a **popup** and inside a **modal**.
4. **Dismissal still works** — for each of: context menu, node picker, `MenuDialog`, a property-editor
   popout, a confirm modal, a tooltip. Click cleanly outside each; it closes.
5. **Dismissal is not over-eager** — press outside a popup, drag onto it, release on it: it should
   *not* close (a mis-drag is not a dismissal), and it should not activate whatever is under the pointer.
6. On Windows, right-click still opens context menus without the `contextmenu`-after-`mousedown`
   workaround regressing. If a Windows machine isn't available, say so plainly in NOTES rather than
   claiming it was checked.

Gates: editor `tsc` clean; `npm run test:ci` for `noodl-editor` green.

## Notes for the executor

- This file dismisses everything in the editor. A regression here is worse than the bug being fixed,
  which is why item 4 of the acceptance list is longer than items 1–3.
- Write the test matrix down before you change the code, and run it once *before* the change so you
  know which behaviours were already broken.
- `pointerup` does not fire if the pointer is released outside the window entirely. Check what
  happens when the gesture ends outside the Electron window — `pointercancel` and window `blur` may
  need to count as "gesture over" so nothing gets stuck armed.
- Commit with a pathspec limited to your files.
