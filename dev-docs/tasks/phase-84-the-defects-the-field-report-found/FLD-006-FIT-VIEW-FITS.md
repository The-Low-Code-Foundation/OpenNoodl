# FLD-006 — Fit view fits

The button is wired to a function that centres at scale 1 and says so in its own docstring. It is
not a broken fit; **it was never a fit.**

## 1. The person sentence

**Someone with a 60-node page clicks Fit view and sees the whole graph.**

## 2. What was reported, and what the code says

[#33](https://github.com/The-Low-Code-Foundation/NodeGX/issues/33): on a 60-node page, Fit view
reports 100% and leaves most of the graph offscreen; clicking again changes nothing.

Call chain, measured 2026-09-09:
`CanvasHud.tsx:97` (`aria-label="Fit view"`) → `OverlayViews.ts:376-380` → `nodegrapheditor.ts:880`
→ `ViewportActions.ts:90-101` → **`CanvasViewport.ts:122-138` `centerOn()`**.

```js
centerOn(rects) {
  let centerX = 0, centerY = 0, count = 0;
  for (const r of rects) { centerX += r.x + r.width / 2; centerY += r.y + r.height / 2; count++; }
  return { x: this.cssWidth / 2 - centerX / count,
           y: this.cssHeight / 2 - centerY / count,
           scale: 1 };          // ← a literal
}
```

Three faults, all confirmed:

1. **`scale: 1` is a literal.** It is not clamped at a minimum — it is **never computed**. That is
   why the HUD reads exactly 100% (`OverlayViews.ts:369`) and why repeat clicks do nothing: the
   function is idempotent.
2. **It averages node centres**, not the bounding-box centre. On a graph with a dense cluster and a
   few outliers the camera lands on the cluster centroid, so even the *pan* is wrong.
3. **No bounding box is read.** `this.graphAABB` (`:30`) is never touched by `centerOn`.

⚠️ **One of the reporter's hypotheses is wrong and should not be chased:** the viewport dimensions
are correct. `cssWidth`/`cssHeight` (`:67-73`) derive from the canvas element's device pixels ÷ DPR,
not from the window.

🔴 **The docstring says "at scale 1".** The function is honest and correct for what it claims. The
defect is at the call site: `ViewportActions.ts` routes `CenterToFitMode.AllNodes` to a *centre*.
Fix it there, not by making `centerOn` lie differently.

Secondary: `centerToFit` calls `setPanAndScale` directly (`ViewportActions.ts:92,97`) and skips
`clampPanAndScale`, unlike every other viewport mutation.

## 3. Scope

- Add a real `fitTo(rects, padding)` using `CanvasViewport.rectsAABB` (`:100`) which **already
  exists**, and route `AllNodes` to it. Pan is applied in graph space — the transform is
  `scale(s) translate(x,y)` (`CanvasPainter.ts:65`) — so the pan terms divide by scale.
- Clamp the result the way every other mutation does.
- 🔴 **Decide explicitly what happens to the initial camera.** `getPanAndScale()`
  (`ViewportActions.ts:104-119`) falls back to `centerToFit(RootNodes)` for the camera a project
  opens with. Changing that changes what **every project looks like on open**. Either keep
  `RootNodes` on the old behaviour or migrate both deliberately — but say which, in the file.
- Reconcile with `zoomAtPoint` (`:146-168`), which derives its own `minScale` from `graphAABB` plus
  `ScalePadding = 200`. A fit below that floor puts the user at a zoom the +/− buttons immediately
  snap away from.

## 4. Acceptance criteria

1. **(person)** Open a page with ~60 nodes spread wider than the viewport. Click Fit view. Every node
   is inside the pane, with a margin, and the HUD reads **below 100%**.
2. A spec over a rect set wider than the pane asserts the returned scale is `< 1` and that the
   transformed bounding box fits within the pane. Reverted arm: restore `scale: 1` and the box does
   not fit.
3. An **asymmetric** fixture — a dense cluster plus two far outliers — asserts the camera centres the
   bounding box, not the centroid. This is the arm that distinguishes the two bugs; without it a fix
   for the scale alone reads green.
4. The fit result satisfies `zoomAtPoint`'s `minScale`, asserted directly: after a fit, a zoom-out
   step does not jump.
5. The initial-camera behaviour is asserted unchanged (or the deliberate change is asserted), so
   this task cannot silently alter how every project opens.

## 5. Traps

- 🔴 `tests/canvas/CanvasViewport.test.ts` and `tests/nodegraph/canvas-characterisation.spec.js`
  **pin the current formulas**. Expect to update them — and be certain you are changing an assertion
  because the behaviour is now correct, never to turn a red green.
- ⚠️ A fit with zero rects divides by zero in the current code. Decide what an empty component does
  before the bounding box maths meets it.
- ⚠️ Padding in graph space and padding in screen space are not the same number once scale ≠ 1.
  Pick one, name it in the signature.
