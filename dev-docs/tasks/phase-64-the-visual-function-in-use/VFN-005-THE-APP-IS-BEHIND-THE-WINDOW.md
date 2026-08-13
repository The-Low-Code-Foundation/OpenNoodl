# VFN-005 — The app is behind the window

**Status:** 📋 open · **Tier 2** · ~half a day · 🔴 **reproduce before building**

## The report

> *"When the editor is open, you can't click anything in the preview, making live testing tricky."*

## 🔴 First job: find out whether this is occlusion or interception. They need different fixes.

**The evidence says occlusion.** Two facts, both read in source:

1. The layer is `pointer-events: none`
   ([`nodegrapheditor.css:45-49`](../../../packages/noodl-editor/src/editor/src/styles/nodegrapheditor.css))
   with the window re-enabling them on itself
   ([`CanvasTabs.module.scss:25`](../../../packages/noodl-editor/src/editor/src/views/CanvasTabs/CanvasTabs.module.scss)),
   and LGC-010's drive **measured** an outside click reaching the preview without dismissing the
   window. That was one of its stated acceptance criteria.
2. The window opens at **82% of the viewport, centred**
   ([`logicOverlayGeometry.ts:74`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/logicOverlayGeometry.ts)):

   ```ts
   export const LOGIC_OVERLAY_DEFAULT_FRACTION = 0.82;
   ```

   Under the default `horizontal` layout the preview owns roughly half the document. An 82%-wide
   centred window covers most of it. There is nothing left to click *at*.

**That is a hypothesis and it is not yet a measurement of this report.** LGC-010's drive was run by
the person who built the window, on a window they had just placed. Richard's session was on a 13"
laptop with stored geometry. Reproduce first:

```js
// With the window open, over the preview's centre:
const el = document.elementFromPoint(x, y);
({ tag: el.tagName, id: el.id, cls: el.className, pe: getComputedStyle(el).pointerEvents })
```

- Answers the **preview frame** → occlusion. Build the parking affordances below.
- Answers `#canvas-tabs-root` or `.CanvasTabs` → interception, and the geometry work is secondary to
  finding what re-enabled pointer events. Check `.ResizeHandle` first: it is `pointer-events: all`,
  `position: absolute` with `left: 0; right: 0` or `top: 0; bottom: 0`, and it is *inside* the
  window — but a handle whose containing block is ever wrong spans the layer.

🔴 **`elementFromPoint`, not a bounding-box comparison.** Hit-testing and paint are different
questions, and this exact feature already produced a finding where they disagreed: `overflow: hidden`
on `.CanvasTabs` clips hit-testing, which made half of every resize handle inert while measuring
perfectly.

## What to build, once occlusion is confirmed

The window cannot simply be made smaller — its floor is **640 px** and that number is argued, not
chosen: 152 + 152 of interface rails plus ~90 of toolbox is spent before a block is drawn. The
remedy is not a smaller window, it is **getting it out of the way and back again in one gesture**.

### 1. Park it

A collapse control in the title bar that rolls the window down to just its tab bar, in place. Click
again and it returns to the exact box it left. Not a close: the tabs stay open, the workspaces stay
mounted, nothing is serialised, and coming back costs no reload.

This is the direct answer to the report — *"live testing"* is a loop of poke the app, look at the
blocks, poke the app — and it is the cheapest thing in this task.

⚠️ **A collapsed workspace measures 0×0 and Blockly caches that.** `svgResize` reads
`parentElement.offsetWidth/offsetHeight`, and a hidden workspace will cache the zero and set its SVG
to `0px`. The existing guard in
[`BlocklyWorkspace.tsx:216-221`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/BlocklyWorkspace.tsx)
already declines to resize a zero-size container — collapse must go through the same door, and
`resizeBlocklyWorkspaces()` must be called **synchronously** on expand. An occluded renderer fires
zero `ResizeObserver` callbacks, so anything deferred works while the window is focused and fails
where this is used.

### 2. Snap it

Two or three placements reachable in one action — left half, right half, restore. Each clamped by the
existing `clampLogicOverlayRect`, each written through `applyRect` so Blockly is re-measured on the
same tick.

Snapping to a half is the honest way to have both surfaces at once on a laptop, and it is the shape
LGC-008's splitter was reaching for without the splitter's fatal property: at 640 px the window
overhangs rather than compressing the app.

### 3. A better first placement

82% centred maximises the chance of covering the preview. Prefer opening over the **node graph
frame** — the window is still free-floating and still viewport-positioned, it just starts somewhere
that leaves the running app visible. First open only; stored geometry still wins after that.

🔴 **Do not reintroduce the frame as a containing block.** `position: fixed` escaping the frame's
clip is what makes the window possible at all on a 13" screen. Read the frame's box, place against
the viewport.

## Explicitly not in this task

**A detached preview window.** It is listed as open on LGC-010 and it is a bigger, better answer to
this report than any of the above — and it is a separate job with its own process and lifecycle
questions. If it is built, this task's parking and snapping remain useful and none of it is wasted.

## Acceptance criteria

1. The reproduce step above is run and its answer is written into this file before anything is built.
2. Collapse and restore return the window to the same box, with the workspace measuring non-zero and
   the blocks in the same place.
3. A snap places the window in a half of the viewport at ≥ 640 px, with the app clickable in the
   other half — proved with `elementFromPoint`, not a screenshot.
4. First open on a fresh profile leaves the preview visible under the default layout.
5. Stored geometry still restores exactly, and still clamps into a smaller viewport.

## How to prove it

Specs for the geometry: collapse/restore and each snap are pure `OverlayRect` functions and belong in
`logicOverlayGeometry.ts`'s existing plain-Node spec, beside `applyOverlayDrag`.

A drive for everything else, measuring `.injectionDiv` width and `elementFromPoint` at the preview's
centre before and after each gesture. A sweep that does not actually move the element proves nothing.
