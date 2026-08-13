# VFN-005 — The app is behind the window

**Status:** 🟡 **BUILT 2026-08-13 on `vfn-e-place` (`3c37ca71`) — criteria 1, 2, 4, 5 answered in
code and graded headlessly; criterion 3 REWRITTEN and its proof, plus criterion 4's fresh-profile
reading, owed to a drive.** · **Tier 2** · ✅ **REPRODUCED 2026-08-13 — it is OCCLUSION**

> ## 🔴 The ruling — read this before the proposals below, which it supersedes in part
>
> **Two controls were built: Park and Home. Snap-to-halves was rejected.** The full argument,
> the rejected alternatives and what each one costs are in
> [§ The decision](#-the-decision-2026-08-13) at the foot of this file. **Acceptance criterion 3
> has been rewritten** to match; the original is preserved there with the reason it was replaced.
>
> 🔴 **This change invalidates every coordinate in `DRIVE-2026-08-13-C.md` and
> `DRIVE-2026-08-13-D.md`.** Those drives were written against a window that opens at 82% of the
> viewport, centred. It now opens over the node graph frame, and the title bar has two new
> buttons to the left of *Done*. Re-read the window's box before reusing any click point from
> either file.

> ## ✅ Criterion 1 is answered: occlusion, not interception
>
> Driven 2026-08-13 on `lgc010-drive` (a throwaway copy), one Logic Builder node, window open.
> `elementFromPoint` at five points across the preview:
>
> | point | resolves to | verdict |
> |---|---|---|
> | preview **centre** (880,269) | `rect.blocklyMainBackground` `pointer-events: all` | 🔴 the window |
> | top-left+40 (432,152) | `WEBVIEW.VisualCanvas-module__Webview` | ✅ preview |
> | top-right−40 (1328,152) | `WEBVIEW.VisualCanvas-module__Webview` | ✅ preview |
> | bottom-left (432,385) | `DIV.blocklyToolboxCategory` | 🔴 the window |
> | bottom-right (1328,385) | `WEBVIEW.VisualCanvas-module__Webview` | ✅ preview |
>
> **Geometry measured:** viewport `1368×781`; preview `x=392 y=112 w=976 h=313`; window
> `x=140 y=214 w=1014 h=543`.
>
> 🔴 **The result is decisive because the two sets separate exactly on the window rect.** Every
> blocked point is geometrically inside `140..1154 × 214..757`; every reachable point is outside it.
> Nothing is intercepting: where the window is not, the preview answers, and it answers with
> `pointer-events: auto`. **Do not go hunting for what re-enabled pointer events, and do not touch
> `.ResizeHandle`** — build the parking and snapping affordances below.
>
> ⚠️ **The window measured 74.1% × 69.5% of the viewport, not 82%.** `LOGIC_OVERLAY_DEFAULT_FRACTION`
> is 0.82 but this fixture had *stored* geometry, which is the case Richard's report came from. The
> report reproduces at 74% just as well, so criterion 4's "fresh profile" case is a **separate**
> reading and is still owed — a fresh profile will be *worse*, not better.
>
> ⚠️ Three of five sampled points were reachable, so the preview is not entirely unusable — it is
> the **middle** of it that is gone, which is where anything worth clicking usually is.

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

## What was proposed, before the decision below

⚠️ The three sections that follow are the task as it was **written**, kept because the decision
argues against two of them and an argument with its opposition deleted is not an argument. What
was actually built is § The decision.

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

1. ✅ **DONE 2026-08-13.** The reproduce step was run and its answer is written at the top of this
   file: **occlusion**. The geometry work is the task; there is no pointer-events hunt.
2. 🟡 **Built; the DOM half owed to a drive.** Collapse and restore return the window to the same
   box — held **structurally**, not by a remembered rect: parking never touches the four custom
   properties, so *"the same box"* is the only box there ever was, and while parked nothing can
   write geometry at all (the drag and the eight handles are refused). What a headless runner
   cannot see is the workspace measuring non-zero afterwards and the blocks landing in the same
   place. Owed.
3. ✏️ **REWRITTEN — see the decision.** *Was:* "A snap places the window in a half of the
   viewport at ≥ 640 px, with the app clickable in the other half." *Now:* **Home places the
   window over the node graph frame at ≥ 640 × 320, with the running app's preview clickable at
   its centre — proved with `elementFromPoint`, not a screenshot.** The geometry half is graded;
   the `elementFromPoint` half is owed.
4. 🟡 **Built; the fresh-profile reading owed.** First open with nothing stored places the window
   over the node graph frame, which under the default `horizontal` layout leaves the preview band
   and the side panel column whole. Graded against the drive's measured boxes. A fresh profile on
   a real 13" screen is a separate reading and is still owed — the note at the top of this file
   already says a fresh profile will be *worse*, not better, than the 74% case that was measured.
5. ✅ **Built and graded.** Stored geometry beats the frame placement on every open after the
   first, and still clamps into a smaller viewport. Both held by spec, the first with the frame
   placement asserted to be a *different* rect so the spec cannot pass by the two agreeing.

## How to prove it

Specs for the geometry: the placements are pure `OverlayRect` functions and live in
`logicOverlayGeometry.ts`'s plain-Node spec beside `applyOverlayDrag`, with the seam that *writes*
them graded next door in `logic-overlay.test.ts`.

A drive for everything else, measuring `.injectionDiv` width and `elementFromPoint` at the preview's
centre before and after each gesture. A sweep that does not actually move the element proves nothing.

---

## 🔴 The decision (2026-08-13)

### What was built

**Park** and **Home**. Two title-bar controls, to the left of *Done*, plus one automatic
behaviour that neither of them is.

#### 1. Park — `▴` / `▾`, `data-test="logic-builder-park"`

Rolls the window down to its title bar, in place. Click again and it comes back. Not a close: the
tabs stay open, the workspaces stay mounted, nothing is serialised.

🔴 **It is a presentation state, not a geometry state, and that is the whole design.** The four
custom properties on the shell root are left exactly as they are; parking is one class that gives
the window `height: auto` and takes `.TabContent` out of the flow. Consequences, all of them the
point:

- *"restore returns the window to the same box"* is true **by construction**. There is no
  remembered rect that a drag, a viewport resize or a reopen could put out of step with the
  window. The alternative — park writes a short height and remembers the tall one — needs
  `reflowLogicOverlay`, `applyOverlayDrag` and `fromFractions` all taught about parking, and every
  one of them is a place for the two copies to drift.
- `reflowLogicOverlay` keeps working on a parked window with no change at all: it reads the
  properties, not the element, so a parked window on a shrunken viewport is still clamped
  correctly and still restores to a box that fits.
- **A parked window cannot be dragged or resized.** A drag reads its origin from
  `getBoundingClientRect`, and a parked window's box *is* its title bar — so any drag would write
  ~40 px back through `clampLogicOverlayRect`, which floors it at 320, and restoring would return
  a window nobody ever placed. Refusing the gesture is the narrow fix. The wide one (teach the
  drag to read the written height instead of the measured one) was **tried and reverted**: it
  changed the contract for every drag in order to serve one state, and it turned four existing
  LGC-010 specs red because the element is the authority on its own edges in all the others.
- Blockly: `.BlocklyContainer` measures 0×0 while parked, which is exactly what
  `BlocklyWorkspace`'s existing zero-size guard declines to resize — so the collapse goes through
  the same door the task named. `resizeBlocklyWorkspaces()` is called from a `useLayoutEffect`
  keyed on the parked flag, **synchronously**, after the DOM mutation and before paint. Not a
  timer, not a `ResizeObserver`: an occluded renderer fires zero observer callbacks and clamps
  timers ~1000×, so a deferred version works while focused and fails exactly where this is used.

#### 2. Home — `⌂`, `data-test="logic-builder-home"`

Places the window over the **node graph frame**: `editor.shell.root.getBoundingClientRect()`,
inset 12 px, centred on the frame, floored at 640 × 320, clamped to the viewport. It is both the
first-open placement (criterion 4) and the *"put it back"* gesture.

The frame is what is left of the viewport after the side panel has taken its column and the
running app its band, so a window that fills it covers neither. On the geometry the drive actually
measured — viewport 1368 × 781, preview 392,112 976×313, frame 392,425 976×356 — Home lands at
**404, 437, 952 × 332**: clear of both, and 312 px over the width floor.

🔴 **The frame is read as four numbers and never becomes a containing block.** `position: fixed`
escaping the frame's `overflow: hidden` is what makes a 640 px window possible on a 13" screen at
all, and the constraint is restated in `LogicOverlay.frameRectOf`, in `OverlayViews` and in
`logicOverlayGeometry`'s section header so it cannot be undone by someone reading only one of them.

When the frame is smaller than the floor, the window **overhangs** it symmetrically rather than
shrinking — 640 × 320 is argued (152 + 152 of interface rails plus ~90 of toolbox before a block
is drawn) and a window below it is not small, it is empty.

#### 3. The yield — automatic, no control

🔴 **The argument this task file predates, and the one that decided the shape of everything
above.** VFN-012's App Config flyout has a button labelled *Open app settings*. It works — and the
settings panel it opens renders in the side dock, **behind** the Logic Builder window the builder
pressed it from. A feature's own call to action landing exactly where the feature is hiding.

A better first placement does not fix this on its own, because by the time anyone presses that
button they have a stored geometry of their own, and **stored geometry wins** (criterion 5, which
is correct and is not being traded away). So the window yields:
`BlocklyWorkspace` emits `LogicBuilder.SidePanelOpened` immediately after `openSettingsPanel`, and
`yieldLogicOverlayToSidePanel` answers one of three things:

| answer | what happens | when |
|---|---|---|
| `'clear'` | nothing moves | the window was never over the dock — which is what a window in its Home placement is |
| `'moved'` | translated the shortest distance that clears the dock, **at the size the builder chose**, and stored | the ordinary case |
| `'park'` | `LogicBuilder.ParkRequested`, and the window collapses | nowhere on this viewport to move to |

Size is preserved on a move rather than shrunk: a builder who sized this window sized it for the
blocks in it, and shrinking to make room is how a 640 px floor gets quietly violated. The move is
**permanent**, not a temporary shift, because a temporary shift needs an answer to *"when do I put
it back?"* and every answer to that is wrong — on panel close? the builder may have liked it there.

⚠️ It runs **synchronously, on the click's own tick**, so the panel has not been laid out yet when
the frame is measured. That is why `sidePanelRegion` carries a floor of 380 px
(`RAIL_WIDTH` 52 + `DEFAULT_PANEL_WIDTH` 328) and uses the frame's live left edge only when it is
*larger*. Deferring the read a tick to see the real panel is not an option that survives an
occluded renderer.

### Rejected: snap to halves

The task proposed left half / right half / restore, and it is not built. Three reasons, in order
of weight:

1. 🔴 **The drive measured the running app as a full-width *band*, not a half.** Preview at
   392,112 976×313 on a 1368×781 viewport: it spans the whole document width and sits across the
   top. A left/right snap on that layout frees *half a preview* — the window still covers 684 px
   of it. The proposal was written before the reproduce step ran, and the reproduce step is what
   overturns it. **Home is what a half-snap was reaching for, measured rather than guessed:** on
   the same fixture it frees the preview entirely.
2. **The title bar cannot afford four controls at 640 px.** The floor is argued and the bar must
   also hold the tabs, whose own labels are already truncating (`TabComponent` gives way first —
   VFN-004). Two 24 px controls plus *Done* is what fits without the tab labels paying for it.
3. **It is not lost work.** `moveLogicOverlayClearOf` and `clampLogicOverlayRect` are the whole of
   a snap's arithmetic; `snapLogicOverlayRect(side, viewport)` would be about eight lines against
   them, and adding it later needs no redesign. It is being *declined for now*, not designed out.

Where a snap would genuinely beat Home is a `vertical` document layout on a wide external display,
where the preview is a column rather than a band. That is a real case and it is the one to
reconsider this on — with a measurement, not a proposal.

### Rejected: a smaller window

Ruled out by the task and not revisited. 640 px is 152 + 152 of interface rails plus ~90 of toolbox
before a block is drawn.

### Rejected: shrinking the window to make room for the panel

Considered for the yield and rejected: see above. Moving is the cheaper thing to undo and the
overhang the clamp already allows is a supported placement.

### Rejected: a detached preview window

Out of scope by the task's own statement. Everything above survives it if it is ever built.

### What was proved, and how

`packages/noodl-editor/tests-unit/lgc-010/logic-overlay-geometry.test.ts` (the arithmetic) and
`.../logic-overlay.test.ts` (the seam that writes it). Every fixture is the geometry the
2026-08-13 drive actually measured, not an invented one.

🔴 **Seven negative controls, each injected, WATCHED red with its live symptom, then restored.**
Not written — watched:

| control | injected | watched symptom |
|---|---|---|
| the post-clamp re-test in `moveLogicOverlayClearOf` | accept a candidate on its **pre-clamp** coordinates | returned `{ left: 100, top: 704, … }` as a clearance from a band 750 tall; the yield answered `'moved'` where it must answer `'park'` |
| the first-open placement | reverted to `defaultLogicOverlayRect` | the placement spec red **and** the *"already clear"* yield spec red — proving that one is not vacuous |
| `frameRectOf`'s remaining guard | assume the root can be measured | `root.getBoundingClientRect is not a function` — a Logic Builder tab opening onto a throw |
| `rectsIntersect` | `<` → `<=` (a shared edge counts) | 5 specs red, including both *"moves a window that is over the dock"* |
| `sidePanelRegion` | dropped the 380 px reserve floor | the closed-panel spec red, and the `'park'` outcome became `'moved'` |
| `placeLogicOverlayInFrame` | trust every frame | the nullability spec red, plus two LGC-010 specs that depend on the fallback |
| Home | replaced by the old centred default | 8 specs red, including *"leaves the running app and the side panel whole"* |

The *"leaves the running app and the side panel whole"* spec also carries its control **inline**,
in the same test: `defaultLogicOverlayRect` is asserted to intersect *both* regions two lines
below the assertion that Home intersects neither. A suite of absences is indistinguishable from an
`rectsIntersect` that always answers `false`.

🔴 **One guard was proved to be decoration and removed rather than kept.** `frameRectOf` also
rejected 0×0 and `NaN` boxes; injecting a control that deleted that check changed **no spec's
answer**, because `placeLogicOverlayInFrame` already holds exactly that property and both paths
produce the same rect. One property, one guard, in the module with a spec around it — and the
remaining guard (no element to measure) now has a spec of its own, listed above.

**Gates:** `npx tsc -p tsconfig.json --noEmit` clean. Package-local `npx jest`: **175 suites /
2649 passing** against a baseline of 175 / 2622 — nothing lost, +27 added.

### 🔴 What is owed to a drive

Headless geometry cannot answer any of these, and none of them is implied by the specs above.

1. **Criterion 3 — `elementFromPoint` at the preview's centre, after Home.** Open a Logic Builder
   tab on a project with a running preview; drag the window so it covers the preview (the control:
   the centre must answer `rect.blocklyMainBackground`); press `[data-test="logic-builder-home"]`;
   read `elementFromPoint` at the preview's centre again. It must answer the `WEBVIEW`, with
   `pointer-events: auto`. Read `.injectionDiv`'s width in the same breath: Home must not have
   bought clearance by shrinking the window below 640.
2. **Criterion 2 — park and restore, with a workspace measurement.** Record
   `--logic-overlay-height` and `.injectionDiv`'s width and height. Press
   `[data-test="logic-builder-park"]`. The window's `data-parked` must be `"true"`, its
   `offsetHeight` must be the tab bar's, and `elementFromPoint` at the preview's centre must
   answer the `WEBVIEW`. Press it again: `--logic-overlay-height` must be **the same number**, and
   `.injectionDiv` must measure **non-zero and the same as before** — that last one is the whole
   Blockly-caches-the-zero risk and it is the only part of this task a headless runner is blind
   to. A block's position on screen before and after is the second reading.
3. **Criterion 4 — a fresh profile.** Clear `logic_overlay_rect` from `localStorage`, open a Logic
   Builder tab on the default `horizontal` layout, and read `elementFromPoint` at the preview's
   centre **before touching anything**. It must answer the `WEBVIEW`.
4. **The yield, end to end.** With the window dragged over the side dock, open the App Config
   toolbox category and press *Open app settings*. The settings panel must be readable: read
   `elementFromPoint` inside the panel's box. The control is the same gesture on the window's
   pre-VFN-005 placement, where the answer is the window.
5. **The title bar at 640 px.** Resize the window to its floor with two tabs open and confirm the
   two new controls and *Done* have not pushed the tab labels out — `scrollLeft` on the bar, not
   `scrollWidth > clientWidth`, which is integer-rounded and reports a false 1 px overflow.

⚠️ Both `DRIVE-2026-08-13-C.md` and `DRIVE-2026-08-13-D.md` were written against the old placement
and the old title bar. Every click coordinate in them is stale.
