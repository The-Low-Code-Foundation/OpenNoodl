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

---

## 6. 🟢 **BUILT** — 2026-09-10 (session 5)

### What changed

**`canvas/CanvasViewport.ts`**
- **`fitTo(rects, screenPadding = FitPadding)`** — new. Bounding box via the existing
  `rectsAABB`, a *computed* scale, and the pan derived from `canvas = (graph + pan) * s`, so the
  pan terms divide by the scale. At scale 1 it collapses to the same shape as `centerOn`.
- **`minScale()`** — **extracted verbatim** from `zoomAtPoint`, which now calls it. The arithmetic
  is unchanged, including the negative number it returns for an unset (inverted) `graphAABB` — that
  is what makes it impose no floor before a layout, exactly as before. `hasGraphBounds()` is how a
  caller asks whether the number is real.
- `centerOn` is **untouched**. Its docstring now says what it is not.

**`ViewportActions.ts`**
- `centerToFit(AllNodes)` routes to `getFitPanAndScale()` and is now **clamped**, like every other
  viewport mutation. It was the only one that skipped `clampPanAndScale`.
- `allGraphRects()` feeds the fit the **same rect set `CanvasPainter.calculateAABB` feeds
  `updateGraphAABB`** — roots at `measuredSize` **plus comments**. A comment parked away from the
  nodes is part of the graph you asked to see, and using one rect set means the fit and the zoom
  floor cannot disagree about where the graph ends.

### The three decisions §3 asked to be made explicitly

1. **Padding is in screen space** — CSS pixels of the canvas, named in the signature as
   `screenPadding`, default `CanvasViewport.FitPadding = 40`. Graph-space padding would shrink the
   visible margin to nothing on a large graph.
2. **The initial camera is deliberately unchanged.** Only the `AllNodes` arm moved. `RootNodes` —
   the camera `getPanAndScale` falls back to, i.e. what **every project opens with** — still routes
   to `centerOn` at scale 1. Migrating it is a separate decision, not a side effect of this one.
   Asserted in both the characterisation spec (unchanged, still green) and AC5's own arm.
3. **The fit is floored at `minScale()`.** A fit below the floor is a zoom the +/− buttons snap away
   from on the very next click. When the requested 40px margin would need a scale under the floor,
   **the margin is reduced, not the floor breached** — and the floor still fits the box, because the
   floor is itself a fit (with `ScalePadding` = 200 graph units of margin). On a 400px pane the
   crossover is a graph about 1600 units wide.

**Empty component:** `fitTo([])` returns the identity camera. `centerOn([])` still divides by zero —
left alone, because nothing routes an empty graph to it (`getPanAndScale` guards on `roots.length`).

### Acceptance criteria

| AC | where | note |
|---|---|---|
| 1 (person) | `tests/nodegraph/fld-006-fit-view-fits.spec.js` — *puts every node inside the pane, below 100%* | real `NodeGraphEditor`, 400×800 pane, graph ~1600 units wide |
| 2 | `tests/canvas/CanvasViewport.test.ts` — *returns a scale below 1 and puts the whole box inside the pane* | + reverted arm |
| 3 | same file — *centres the bounding box, not the centroid* | 8-node cluster + 2 outliers; the centroid is >200 units off |
| 4 | same file — *never returns a scale below the floor the zoom buttons enforce* | asserts the unfloored value **is** below the floor first, so the floor is shown load-bearing |
| 5 | `fld-006-fit-view-fits.spec.js` — *the camera a project opens with is UNCHANGED* | plus the untouched characterisation test at `canvas-characterisation.spec.js:141` |

🔴 **The reverted arms are not patched copies of the source — the pre-fix behaviour is still
callable.** `centerOn` *is* what Fit view used to call, and `editor.getCenterPanAndScale()` *is* the
route `centerToFit(AllNodes)` used to take; both are still public. Every fit assertion is paired
with the same fixture through the old path, and the pair is what separates the **two** faults: the
literal `scale: 1`, and the centroid-instead-of-box. A fix for the scale alone passes AC2 and fails
AC3.

### Trap 5.1, resolved

`tests/canvas/CanvasViewport.test.ts` and `tests/nodegraph/canvas-characterisation.spec.js` pin the
current formulas — and **neither needed an assertion changed**. `centerOn`, `zoomAtPoint` and
`clamp` all behave identically; `minScale` was an extraction, not a rewrite. Nothing here turned a
red green.
