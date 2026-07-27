# PNL-002 — Outside-click vs. drag: notes

**Status:** ✅ Complete — 2026-07-27
**Spec:** [PNL-002-OUTSIDE-CLICK-GESTURE.md](./PNL-002-OUTSIDE-CLICK-GESTURE.md)
**Matrix:** [PNL-002-TEST-MATRIX.md](./PNL-002-TEST-MATRIX.md) — written and run *before* the change

## The mechanism, measured

The spec's diagnosis is right, and here it is off the live DOM. Press inside a Project Settings text
field, drag right past the panel edge, release over the node graph:

```
mousedown → INPUT.PropertyPanelBaseInput-module__Root
mouseup   → CANVAS
click     → DIV.FrameDivider-module__Root      ← the nearest common ancestor
```

`click` is dispatched to the common ancestor of the press and the release, and that ancestor is
outside every popup, popout and modal. Every "clicked outside → close" rule in the layer fired on
what was actually a text selection.

## But that was not what "kicks me out"

The report is *"I click drag text to the right in fields and it kicks me out."* After the gesture:

```
focus after the gesture: BODY      ← the field lost focus
```

Releasing over the **top bar** or over the **divider** kept focus; only releasing over the node graph
lost it. That isolates the cause, and it is not the popup layer:

[`InteractionController.mouse`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/canvas/InteractionController.ts)
cleared the node selection on **any** left `mouseup` over the canvas with nothing highlighted. The
canvas only ever sees the half of the gesture that happens over it, so a release that belongs to a
drag begun in a panel read as a click on empty canvas: selection cleared → the property panel rebuilt
→ the field you were editing ceased to exist.

Same class of bug as the popup layer's, different file. Both are fixed. Per the spec — *"If the repro
shows a different cause, fix the actual cause and record the correction in NOTES"* — this is the
correction: **the popup-layer dismissal was real but was not the felt symptom.**

## What changed

### 1. `popuplayer.ts` — dismissal is a gesture

Three `mousedown` + `click` pairs became one `pointerdown` / `pointerup` pair. `pointerdown` arms,
`pointerup` acts, and **both ends must be outside**. Starting inside and ending outside is a
selection; starting outside and ending inside is a mis-drag onto the popup. Neither dismisses.
`pointercancel` and window `blur` disarm, so a gesture that never completes cannot leave the layer
primed to dismiss on the next one. `isLocked`, `modals.length` and the Windows
`ignoreContextMenuEvent` guard are unchanged; the listener *order* (popup, popout, modal) is now
explicit in one handler rather than implied by registration order.

The `show*` methods disarm on the way in, so the gesture that opened something cannot also close it.

### 2. `popuplayer.ts` — the layer was blind to portalled popouts

`MenuDialog`/`BaseDialog` render through a React **portal** into `.dialog-layer-portal-target` on the
body. Measured: a context-menu popout's own element is a **0×0 box** at the attach point, and the
visible menu's parent chain is `BaseDialog .Root → .dialog-layer-portal-target → body`. It is not a
descendant of `popoutsEl` at all, so `isInside(target, popoutsEl)` could never be true for it.

Moving to `pointerup` turned that latent blindness into a **hard regression**, and the test caught it:
pressing a context-menu item armed the dismissal, `pointerup` hid the popout and unmounted its React
root, and the `click` never fired because the element was gone.

```
after pointerdown on the item: { menuStillThere: true }
after pointerup on the item  : { menuStillThere: false, clicks: [] }   ← the item got no click
```

So inside/outside now also asks whether the target is inside the dialog portal. `contains` is DOM
ancestry, not a hit test, so a click on the canvas *behind* an open dialog still targets the canvas
and still dismisses. After the fix the item receives its click and its action runs.

### 3. `BaseDialog.tsx` — the same bug, in React

The spec scoped out the React dialogs *"unless the repro implicates it — in which case extend the fix
there and say so"*. It is implicated, so: **saying so.**

`.Root` is a full-viewport catcher that carried `onClick={onClose}`, with the visible dialog stopping
propagation. But a click dispatched to the common ancestor lands on `.Root` itself, having never
passed through the inner `stopPropagation` — so pressing inside a menu and releasing outside it closed
the menu. Identical mechanism, identical fix: a pointerdown/pointerup pair on `.Root`, both ends
required outside the visible dialog.

### 4. `InteractionController.ts` — a release is only a click if the press was too

`leftButtonPressedOnCanvas`, set on a left `down` over the canvas and consumed on the matching `up`.
The selection is cleared only when the flag is set. The snapshot is taken before the early-return
paths so it cannot leak into the next gesture.

## Matrix results

Driven live over CDP against a **freshly booted** editor with the Agent Chat Example open, at
1400×900, using real `Input.dispatchMouseEvent` presses, moves and releases.

| Row | Result |
|---|---|
| A1 — drag out of a panel field keeps focus | ✅ `activeElement=INPUT` (was `BODY`) |
| A2 — drag out of a popout menu does not dismiss it | ✅ |
| A3 — drag out of a popup does not dismiss it | ✅ |
| A5 — losing the window disarms, next gesture normal | ✅ |
| B1 — a clean click outside closes a context menu | ✅ |
| B4 — a clean click outside closes a popout | ✅ |
| C1 — a mis-drag onto a popup / onto a menu does not dismiss | ✅ both |
| C2 — right-click opens a context menu | ✅ |
| **clicking a menu item still runs its action** | ✅ (added after the regression above) |

**Not verified live, and not claimed:** A4 and B5 (modals — driving a confirm modal headlessly means
triggering a destructive action), B2 (the node picker is a React surface rewritten by UIX-013, not
this layer), B3 (`MenuDialog` from a rail kebab), B6 (the popup-layer tooltip), and **D1 (Windows)** —
there is no Windows machine in this session, so the `ignoreContextMenuEvent` workaround was preserved
by inspection and is **untested on Windows**.

Gates: editor `tsc` clean; `npm run test:ci` 1441 specs / 0 failures.

## Traps

- **The preview is a different renderer.** Releasing a drag in the top half of the editor dispatches
  into the preview webview; its events never reach the editor document, so a repro that releases
  there silently measures nothing. Release over the node graph.
- **`pointerup` fires before `click`.** Any dismissal that unmounts React content on `pointerup` eats
  the `click` that would have run the content's own handler. This is the trap that bit here, and it
  is the reason the "does a menu item still work" check exists at all — the gesture fix looked
  perfect and had broken every context menu.
- **A long CDP session drifts.** Created components, HMR reloads and remembered panel widths move the
  component trail from the bottom of the canvas to the top and change which menu items exist. Two
  "failures" and one "the menu stopped opening" were session state, not code — all three passed on a
  clean boot. Restart before concluding anything.
- **`aria-label="New component"` matches two buttons** — the trail's and the top bar's. Scope the
  query to the trail.

## Recorded, not fixed

- `SheetSelector.tsx:61` and `Clippy.tsx:94` have their own `document` mousedown click-outside
  handlers. Audited: both decide on a single `mousedown` and act immediately, so they do not have the
  common-ancestor bug — a drag cannot dismiss them because they never look at `click`. They *can*
  dismiss on a press that begins a drag onto themselves, which is the milder half of C1. Left alone.
