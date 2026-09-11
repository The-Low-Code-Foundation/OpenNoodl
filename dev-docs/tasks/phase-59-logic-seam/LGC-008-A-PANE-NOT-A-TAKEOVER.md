# LGC-008 — the workspace stops hiding everything else

**Status:** 🔨 **F3, F4 and §1 BUILT 2026-08-12** on branch `lgc008-pane`, three commits, 28
specs · **nothing seen in an editor** · **Track: the eyes** · prior art: MakeCode

> **Read §5, §6 and §8 before touching this.** The five decisions are answered and there are
> **eight** layers, not five. F3, F4 and L27 are fixed and specced; §1's pane is built. What is
> left is a **drive** (every criterion about pixels or about the saved file), the **A/B**, and
> 🔴 **L30 keystroke ownership, which now blocks shipping rather than merging** — two surfaces on
> screen means one Delete can mean two deletions. Build notes and the three places this file was
> wrong about our code: [NOTES-LGC-008.md](NOTES-LGC-008.md).

## ✅ F2 — RULED 2026-08-12: both panes on screen at once

**Richard's ruling: "opening a Visual Function no longer hides the canvas" means the canvas and
the blocks are visible *simultaneously*. The second splitter gets built.**

The literal reading of *"a pane, not a takeover"* wins over the canvas-as-a-tab reading that F2
below argues for on IwC grounds. **Do not re-litigate this** — the cheaper option was put up
beside it with its own diagram and was not chosen.

**What that means for the work, and it is the more expensive branch of the two:**

- A real second splitter, not a `Tab.type: 'canvas'` entry. F2's "smaller than it looked"
  paragraph below describes the option that was **not** taken; it is kept for the reasoning,
  not as the instruction.
- 🔴 **F3 stops being an edge case and becomes every drag.** `bindNodeGraphCanvas` reads
  `clientWidth`/`clientHeight`, which are 0 while hidden, and nothing re-binds when the canvas
  is shown again. In split mode the canvas is never hidden but is *continuously resized*, so
  the re-measure path is now load-bearing rather than a corner. Build it first.
- 🔴 **F4's remount trap becomes real.** `CanvasTabs.handleWorkspaceChange` writes to
  `activeTab` — the tab from the render that produced the callback — and is safe today only
  because switching tabs unmounts the old workspace without re-rendering it. **A pane that
  keeps several workspaces mounted at once breaks exactly that.** This is a correctness bug
  that eats a user's program, not a layout nit.
- The acceptance criterion *"the workspace is not remounted by a resize, a splitter drag or a
  pane swap"* is now the one that decides whether this task is done.

## What happened before this task (kept: it is the reasoning the fix retires)

Opening a Visual Function **hid the entire canvas**.
[`OverlayViews.ts:286-300`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/OverlayViews.ts)
sets `display: none` on the canvas, both comment layers, the highlight overlay, the recording overlay
and the canvas HUD, and the code comments say why: *"the Logic Builder takes the whole canvas over,
and a Record pill floating on top of a Blockly workspace is a control over a surface it has nothing
to say about."*

That reasoning is sound **given a takeover**. This task removes the takeover, which retires the
reasoning with it.

The consequence today is the round trip the video complained about: edit the blocks, leave, run,
guess, come back. Every question costs a context switch.

## §1 — The pane

A splitter, **maximum two panes**. Three is where these UIs die and Richard already ruled it out.

`CanvasTabs` already exists and already manages Logic Builder tabs
([`CanvasTabs.tsx`](../../../packages/noodl-editor/src/editor/src/views/CanvasTabs/CanvasTabs.tsx)).
Generalise it so it is the tab bar *inside* a pane, and you get **two panes × N tabs** from a system
that is already written. Do not build a second tab concept.

## §2 — What goes in the other pane, and why it is not what we first said

The first draft said: node graph left, blocks right.

**MakeCode says otherwise, and MakeCode is the most-loved implementation of this layout.** Its split
is simulator left, blocks right, recompiling as you type — the left pane earns its place by being
**the running thing**, not a second editor. There is also a Multi Editor with two editors side by
side, and it is a niche feature for a niche case, not the default.

So: **the app preview is the default companion pane.** The node graph is available in the pane's tab
bar for the people who want it, but it is not the default, because two editors side by side is
exactly the configuration the IwC study measured and found wanting.

⚠️ **This is the task where the phase's central warning bites hardest.** *Block-based or graph-based?
Why not both?* (IwC 38(1) 2026) built a dual-canvas hybrid — one canvas for flow, one for detailed
editing — and its users **underperformed** a pure block-based group on completion, comprehension and
usability, while saying they preferred the hybrid. This task is the closest thing in the phase to
that design.

**Therefore: measure it, do not assume it.** Half the testers get the pane, half get today's
takeover. If the pane group is not faster at a real task, we built a preference.

## §3 — The traps

⚠️ **Blockly sizes itself via `Blockly.svgResize`, and an occluded Electron renderer fires zero
`ResizeObserver` events** while clamping timers by roughly 1000×. Both are in the registers. A
splitter drag must call `svgResize` explicitly; a `ResizeObserver`-based implementation will appear
to work when the window is focused and fail exactly where this feature is used.

⚠️ **The workspace is injected once and never reloaded from props**
([`BlocklyWorkspace.tsx:29-38`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/BlocklyWorkspace.tsx)),
and `CanvasTabs` keys it by tab id for that reason. A pane implementation that remounts the workspace
on resize or on layout change **will show the wrong program and then save it over the right one** —
the file says so, in those words.

⚠️ **The HUD reasoning must be re-decided, not deleted.** `OverlayViews` hides the recording HUD
because a Record pill over a Blockly workspace controls nothing relevant. In a split, the canvas is
visible again and the HUD is meaningful again — but only over its own pane. Whoever removes the
`display: none` owes an answer for the HUD, the comment layers and the highlight overlay
individually, not one blanket change.

## §4 — Live values across the seam

Once LGC-003 lands, this pane is where it pays off: a value enters the node's input port on one side
and lands on the `Get input` block on the other. **Same trace, two altitudes** — which is the moment
the mental model clicks, and the reason this task is worth doing even though the IwC paper is
sceptical of the layout.

## §5 — L25 answered: the five decisions, decided

*Every line below was read in source on 2026-08-12. The spec's line numbers had drifted;
`setCanvasVisibility` is now `OverlayViews.ts:274-302`.*

First, the thing that makes this table necessary. **The blanket hide is doing almost no
occlusion work.** `canvasTabsRoot` is `position: absolute`, full size, `z-index: 100`
([`CanvasShell.ts:117-120`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/CanvasShell.ts)),
and `.TabContent` inside it is opaque (`--theme-color-bg-1`). Every hidden layer except one
paints at `z-index: auto` or below 100, so it is already covered. Deleting its `display: none`
would change nothing visible. That is why "five decisions, not one" is right in a way the
register did not quite say: the decisions are not *whether each layer is covered*, they are
**what each layer is for once it has its own rectangle**.

| Layer | Today, and the real reason | In split mode, and why |
|---|---|---|
| **Canvas** `#nodegraphcanvas` | Hidden. Not for occlusion (z auto, under an opaque 100) and not for hit-testing (the tabs root covers it) — hidden because the takeover's premise is that nothing is behind the blocks. | **Visible, and explicitly re-measured.** `bindNodeGraphCanvas` sets `canvas.width = canvas.clientWidth * ratio`, and a `display: none` canvas has `clientWidth === 0`; `ViewportActions.resize` calls `bindCanvas()` unconditionally, and nothing re-binds on reveal. So the canvas needs the same treatment as Blockly: **an explicit `editor.resize(currentLayout)` on every reveal and every pane geometry change.** Neither surface observes its container. (See finding F3 — this is already a defect today.) |
| **Comment layer, background** `#comment-layer-bg` | Hidden. Positioned in graph space via `setPanAndScale` → `commentLayer.setPanAndScale`. | **Visible whenever the canvas is** — not a separate decision. It is not decoration over the graph, it is the graph's labels; a canvas shown without them is the legibility failure the LEG track exists for. Bind its visibility to the canvas's, never to the tab state. |
| **Comment layer, foreground** `#comment-layer-fg` | Hidden. Same painting, but it carries `pointer-events: all` and hosts `<textarea>` comment editors. | **Visible with the canvas**, with one thing to get right: its clipping wrapper must clip to the **canvas pane**, not to the shell. A comment positioned right of the splitter must not draw over the blocks. Its textarea is `text-entry` under `getKeyboardFocusKind`, which is correct while the user is in it and is precisely why it must not survive under an opaque cover. |
| **Highlight overlay** `#highlight-overlay-layer` | Hidden — **and this is the one hide that is load-bearing today.** Its wrapper is the only one built without a `z-index` (compare execution `5`, recording `6`), so `HighlightedConnection` (999), `HighlightedNode` (1000) and `BoundaryIndicator` (1001) escape into the body-level stacking context and out-paint the tabs root's 100. `CanvasShell`'s FH-012 comment names this escape and calls it "not this task's". It is this task's now. | **Visible — but close the escape first.** Give the wrapper a `z-index` the way the other two got one: **7** keeps the documented order (execution 5 < recording 6 < highlight 7) and stays below `.popup-layer`'s 10. Then it competes as one number, clips to the canvas pane, and loses the ability to paint on a surface it knows nothing about. ⚠️ **Deleting this `display: none` without the z-index draws lesson and help highlights over the Blockly workspace.** |
| **Recording overlay** `#recording-overlay-layer` | Hidden, with the reasoning the spec quotes: a Record pill over a Blockly workspace is a control over a surface it has nothing to say about. | **Visible over its own pane, and only over its own pane.** The reasoning was never about the HUD — it was about *where the HUD was drawn*, and a split restores the premise it depended on. Its wrapper already carries `z-index: 6`, so it competes as one number already; it needs the pane clip and nothing else. Keep it rather than retire it: once LGC-003 lands, the badges and the block values are the same trace at two altitudes (§4), and that is also the moment they have to agree. |
| **Canvas HUD** `.canvas-hud-root` | Hidden. The AI pill and the zoom cluster; the cluster drives `ViewportActions.updateZoomLevel`, which means nothing with no canvas on screen. | **Visible over the canvas pane — and this is the one that is a design question, not a mechanical one.** Blockly draws its *own* zoom controls and trashcan bottom-right of its workspace (`zoom: { controls: true }, trashcan: true`). Two panes means two zoom clusters, bottom-right of adjacent rectangles, doing different things to different surfaces. The pill is fine. The cluster has to read as unmistakably *of* the canvas, or it must go. **Richard's call.** |

And the three the spec's list of five does not name, each of which is a decision too:

| Layer | Today | In split mode |
|---|---|---|
| **Component trail** `.nodegraph-component-trail-root` | Hidden (`display: flex`/`none`). **The most consequential hide, and it is not in the spec.** Nothing closes a Logic Builder tab when the active component changes — `switchToComponent` never touches `CanvasTabsContext`; only the *first* tab open and the *last* tab close move the canvas. So today you can open a Visual Function, navigate to a different component, and the editor shows you the same blocks with no trail, no canvas, and nothing saying you moved. | **Always visible.** It belongs to the pane, not to the canvas: it is the label that stops the pane lying about where you are, and the way back out. |
| **DOM layer** `#nodegraph-dom-layer` | Hidden. Hosts the DOM node views, the node toolbars and the wire-label `<textarea>`. The textarea is why this hide is load-bearing beyond paint — focused, it is `text-entry` and owns every keystroke from behind an opaque cover. | **Visible with the canvas, through the existing `setDOMLayerVisible`**, which already re-renders the inspectors on reveal. `setCanvasVisibility` currently sets the same style property by hand instead of calling it; two writers of one property is how they drift. |
| **Execution overlay** `#execution-overlay-layer` | **Not in the hide list at all.** CF11-007's pinned workflow run stays mounted and rendered right through the takeover, and is invisible only because its wrapper's `z-index: 5` loses to the tabs root's 100. | **Visible over the canvas pane, like the recording overlay.** Recorded here because it is the proof that the blanket hide is not a principled list — it is the set of layers whoever wrote it happened to touch, and the one layer drawing live execution data was left out. Reaching the right result by accident is not the same as having decided it. |

### The sixth decision, which is not about a layer

⚠️ **Keystroke ownership, and it is a blocker for the pane.** `KeyboardHandler` has no scope:
commands are global, and the only filter is what kind of element holds focus. A focused Blockly
workspace is an `<svg>` — not `INPUT`, not `contenteditable`, not inside `.cm-editor` — so
`getKeyboardFocusKind` returns `'none'` and **every editor shortcut runs**: Backspace and
Delete (`nodeGraph.delete()`), ⌘C/⌘X/⌘V, ⌘Z/⌘⇧Z, ⌘/ . (Typing into a *field* is safe —
Blockly's field editor is a real `<input>`, `.blocklyHtmlInput`, so it reads `'text-entry'`.
It is the block-selected case that is not.)

⚠️ Read from the predicate, not driven. **Confirm it before designing around it**: select a
block, press Delete, and see whether the Logic Builder node disappears from the graph
underneath. If it does not, find out what is actually stopping it before assuming this is
handled — the 200 ms guard says something already went wrong here once.

`EditorClipboard.delete()` already carries a 200 ms guard keyed off `lastBlocklyTabCloseTime`
— evidence this has bitten, and a guard a split makes useless, because it protects a tab
*close* rather than the whole time both surfaces are on screen. Put a node graph and a block
workspace side by side, with a node selected on one and a block selected on the other, and one
Delete means two deletions.

The shape of the answer is a **focus-owning pane**: commands registered by a surface run only
while focus is inside that surface's pane. Not built here, and it should not be built inside
LGC-008 either — it is a keyboard-scope task that the pane happens to force.

## §6 — Four findings that change the task

**F1 — the companion pane already exists, and the takeover never touched it.**
[`EditorDocument.tsx:466-479`](../../../packages/noodl-editor/src/editor/src/views/documents/EditorDocument/EditorDocument.tsx)
already puts the running app and the node graph either side of a `FrameDivider` — `canvasView`
(`VisualCanvas`) and `nodeGraph`, preview left and graph right in the default `horizontal`
layout, with the split size persisted per project. `setCanvasVisibility` only reaches elements
inside the node-graph shell, so **opening a Visual Function today already leaves the running
app on screen beside the blocks.** MakeCode's result | code split is, at the top level, what
this editor already does.

Two consequences. First, the acceptance line *"the companion pane defaults to the running
app"* is met by structure that exists — except under `documentLayout === 'detachedPreview'`,
where the preview is its own window and the node-graph frame is the whole document, and where
a Visual Function therefore really does take over the screen. Second, and less comfortably:
**a new splitter inside the node-graph pane would be graph | blocks — exactly the code | code
configuration §2 rules against as a default.** The thing the takeover destroys is the node
graph, not the preview.

**F2 — what §1 should therefore build, and it is smaller than it looked.**
`CanvasTabs` becomes the tab bar of the node-graph pane, and **the node graph becomes a tab in
it**: `Tab.type` gains `'canvas'`, always present, first, not closable, active by default.
That is "two panes × N tabs" with the two panes being the ones `FrameDivider` already draws,
and it is what §2 asks for in words — *"the node graph is available in the pane's tab bar"*.
The graph | blocks arrangement then exists as an **opt-in mode** of that pane rather than as
the default, which is the only way to honour §2 and acceptance criterion 1 at the same time.

⚠️ **Richard's call, because it decides whether a second splitter gets built at all:** is
"opening a Visual Function no longer hides the canvas" satisfied by the canvas being one
always-present tab away, or does it require the canvas and the blocks to be on screen
simultaneously? The IwC finding argues for the first. The phrase "a pane, not a takeover"
reads like the second.

**F3 — a `display: none` canvas cannot be measured, and this is already a defect.**
`bindNodeGraphCanvas` reads `canvas.clientWidth`/`clientHeight`, which are 0 while hidden, and
`ViewportActions.resize` calls `bindCanvas()` unconditionally. Nothing re-binds when the canvas
is shown again — `setCanvasVisibility(true)` does not resize, relayout or repaint. So: open a
Visual Function, resize the window or drag the divider, close the tab, and the graph returns on
a 0×0 canvas with zero viewport metrics (`getPanAndScale` then answers `{scale: 1, x: 0, y: 0}`
and clamping is skipped) until something else resizes it. **Reproducible today, before any of
this task is built.** In split mode it stops being an edge case and becomes every drag.

**F4 — the remount trap's real mechanism, which is not the one the warning describes.**
`CanvasTabs.handleWorkspaceChange` writes to `activeTab` — the tab from the render that
produced the callback — **not to the tab that owns the workspace that fired.** Today that is
safe by a single thread: switching tabs changes the `key`, so React unmounts the old
`BlocklyWorkspace` *without re-rendering it*, so its `onChangeRef.current` still holds the
closure from the render in which it was active, so its unmount flush writes to the right node.

**A pane that keeps several workspaces mounted at once breaks exactly that.** A background
workspace *does* re-render when its parent does, so `onChangeRef.current` is replaced with a
callback bound to the **new** active tab, and its next flush writes its JSON and its generated
code onto a different node's model. That is "show the wrong program and then save it over the
right one", arriving by a route `BlocklyWorkspace.tsx`'s own warning does not describe — the
key is not the defence people think it is.

The fix is not a key. **Bind the callback to the tab id at the call site** —
`onChange={(ws, json, code) => handleWorkspaceChange(tab.id, json, code)}` — after which
several mounted workspaces are safe, and the never-unmount structure a pane needs becomes
available at all. Do this **before** rendering more than one workspace, not after.

## §7 — What is built, 2026-08-12, and what deliberately is not

**Built: the `svgResize` seam.** `blocklyResize.ts` (new), a registration in
`BlocklyWorkspace.tsx` and a call from the `FrameDivider`'s `onDrag` in `EditorDocument.tsx`.

The premise was verified rather than assumed, by reading `blockly_compressed.js`: `inject`
binds exactly one listener — `window` `"resize"` — and that handler is the only caller of
`svgResize` the library ships. **Nothing in this editor called it.** So this is not only pane
groundwork; it is a present-day defect fixed — dragging the existing preview/graph divider with
a Logic Builder open left the workspace at its injected size until the whole window happened to
be resized.

Three constraints are baked into the shape and should not be undone:

- **No `blockly` import in the seam.** Blockly is a ~1.1 MB lazy chunk loaded on first tab
  open; the layout code that triggers a resize is in the eager bundle. A registry of plain
  closures is what keeps them apart, and it is why the specs run in plain Node.
- **`onDrag`, not `onResize`, and nothing deferred.** `FrameDivider.onDrag` is called
  synchronously from its `mousemove`, after the new container widths are written as CSS
  variables. `onResize` is fed by a `ResizeObserver`; an occluded Electron renderer fires zero
  of those and clamps timers ~1000×, so an observer-based or `requestAnimationFrame`-deferred
  version works whenever the window is focused and fails exactly where it is used.
- **A zero-size guard on the handler.** `svgResize` reads
  `parentElement.offsetWidth/offsetHeight` — 0 under `display: none` — and will cache the 0 and
  set the SVG to `0px`. This is what makes the seam safe for a pane where a workspace sits
  behind an inactive tab, and it is why a revealed tab must be resized again.

⚠️ **Wired but unverified.** No drive was run — the lane may not launch the editor. The specs
prove the dispatch, not the pixels. See *Deferred verification*.

**Not built at the time: the pane itself.** ✅ **Built 2026-08-12** — see §8. Of the three
reasons given for deferring it, the first was answered by Richard's ruling, the second still
stands (the screenshot is owed), and the third turned out to be **wrong in a useful way**:

1. F1 and F2 change what §1 should be, and F2 ends in a question only Richard can answer.
   Building the wrong one of two readings is worse than building neither. → ✅ **ruled**: both
   panes on screen, second splitter built.
2. The correct structure requires the canvas layers to be inset by a tab strip and
   **re-measured** (F3), and a `display: none` canvas reports zero — so the one thing that
   would prove it right is a screenshot, which this lane cannot take. → 🔴 **still true.** The
   screenshot is owed; see *Deferred verification* §1.
3. There is no React test runner in reach. `tests-unit`/`tests-main` are `testEnvironment:
   'node'` with no jsdom, and the jasmine suite needs a real Electron renderer. So the
   no-remount property (F4) **cannot be gated here** — only reasoned about, which is what §6
   does. → ⚠️ **half wrong (L32).** There is no *renderer*, but a React **element tree is plain
   objects**, and key, type and sibling position are precisely what React remounts on. Lifting
   the tree out of the component into a pure builder put most of the property behind a spec.
   What a drive still owes is whether React and Blockly behave as the tree implies.

## §8 — What was built on 2026-08-12, in build order

Three commits on `lgc008-pane`, each proved red by inverting it and naming which specs failed.

1. **F3 — a hidden canvas measures 0, and 0 is not a measurement.** `measureNodeGraphCanvas`
   answers `undefined` rather than zero and `bindNodeGraphCanvas` skips the write (the listeners
   are re-bound either way). `remeasureNodeGraphCanvas` is the canvas's equivalent of
   `resizeBlocklyWorkspaces()` — same rule, called **synchronously** from whatever moved the
   geometry, no-op when nothing moved. Wired to the reveal, the pane toggle and `EditorDocument`'s
   divider `onDrag`. 🔴 **The file understated this defect:** the drag path was broken by the same
   mechanism, because `Frame.onResize` is fed by a `ResizeObserver` and an occluded renderer fires
   none.
2. **F4 — an edit belongs to the tab that made it.** The tab is bound at the call site, in a new
   `tabWorkspaces.tsx` that builds the per-tab elements as a value. ⚠️ Landed **before** anything
   mounted two workspaces, which is the right order and also means the fix was unprovable when it
   was made: inverting it left every spec green until the pane arrived.
3. **§1 — the pane.** `#canvas-tabs-root` starts at a splitter instead of covering the shell; one
   custom property (`--logic-pane-canvas-width`) on the shell root drives every layer through
   `styles/nodegrapheditor.css`. The layers' box model moved out of `CanvasShell` into that
   stylesheet, because an inline `width: 100%` outranks every selector. Every open tab stays
   mounted, hidden rather than unmounted. L27's `z-index: 7` landed **first**, as it must.

Where the code is: `nodegrapheditor/LogicPane.ts` (open/close, drag, both re-measures),
`nodegrapheditor/logicPaneSplit.ts` (the clamp), `CanvasTabs/tabWorkspaces.tsx` (the mounted
workspaces), `CanvasTabs/PaneSplitter.tsx`, and the split rules at the end of
`styles/nodegrapheditor.css`. Specs: `tests-unit/lgc-008/` — 28 across three files, plus the
seven that already held `blocklyResize`.

Build notes, including the three places this file was wrong about our code and the four things
left open: [NOTES-LGC-008.md](NOTES-LGC-008.md).

## Acceptance

- ✅ **Built** — opening a Visual Function no longer hides the canvas; it opens a pane. There is no
  state in which `LogicPane.ts` hides a canvas layer, and a spec fails if one comes back.
- ✅ **Met by structure that already existed** (F1) — the running app is beside the node graph
  through `EditorDocument`'s `FrameDivider`, and `setCanvasVisibility` never reached it.
  ⚠️ Under `documentLayout: 'detachedPreview'` there is no such divider; the new pane splits the
  node-graph frame there too, undriven.
- 🔴 **Built, unverified — needs the screenshot.** The splitter calls `resizeBlocklyWorkspaces()`
  and `remeasureNodeGraphCanvas()` synchronously from `mousemove`, and specs prove the dispatch
  and the ordering. They cannot prove the pixels, and an occluded renderer will not report layout
  truthfully. See *Deferred verification* §1.
- 🟡 **Built and specced as far as a plain-Node runner reaches; the property itself is undriven.**
  Every open tab stays mounted, hidden rather than unmounted, and the element tree keeps its keys,
  types and sibling order across a switch — which is exactly what React remounts on. What no spec
  here can show is that React and Blockly then behave as the tree implies, or that the saved JSON
  is the edited one. **That is a drive, and it is the one that matters** (*Deferred verification*
  §2). Do not read the green suite as this criterion being met.
- ✅ **Built** — the blanket `display: none` is gone and each of the eight layers has a stated
  behaviour, in §5's table and in `LogicPane.ts`. ⚠️ One is a design question, not a mechanism:
  there are now two zoom clusters bottom-right of adjacent rectangles (Blockly draws its own).
  Richard's call, per §5.
- ⚠️ **Outstanding: A/B against the takeover on a real task**, per §2. Record the result whichever
  way it goes — a negative result here is more valuable than a positive one, because it is the one
  nobody expects.
- 🔴 **Added, and it gates shipping rather than merging: L30.** Both surfaces on screen means a
  node selection and a block selection coexist, and `KeyboardHandler` has no scope. One Delete can
  mean two deletions. Not fixed here; it is a keyboard-scope task the pane forces.

## Register

| # | Finding | State |
|---|---|---|
| L23 | MakeCode's split is **result \| code**, not code \| code. Our first draft put the node graph in the left pane; the loved design puts the running thing there | ✅ corrected 2026-08-09 |
| L24 | IwC 38(1) 2026 measured almost exactly this layout and the hybrid **lost while being preferred**. This task must be measured, not shipped on enthusiasm | ⚠️ standing |
| L25 | `OverlayViews`' blanket hide has a documented reason per layer. Removing it is five decisions, not one | ✅ answered 2026-08-12 — §5. It is **eight** layers, not five, and the hide is doing far less than it looks: everything except the highlight overlay is already covered by the tabs root's opaque `z-index: 100`, so the decisions are about what each layer is *for* once it has a rectangle, not about whether it shows |
| L26 | **The companion pane already exists.** `EditorDocument`'s `FrameDivider` already puts the running app beside the node graph, and `setCanvasVisibility` never reached it — so a Visual Function already opens with the app live beside the blocks. §2's default is met by structure that exists. What the takeover destroys is the *node graph*, and a new inner splitter would be graph \| blocks, the configuration §2 rules out | ⚠️ standing — decides §1 |
| L27 | **The highlight overlay is the only unsafe `display: none` to remove.** Its clipping wrapper is the one built without a `z-index`, so its 999/1000/1001 escape the tabs root's 100. Give it `z-index: 7` first (execution 5 < recording 6 < highlight 7, all below `.popup-layer`'s 10) | ✅ **fixed 2026-08-12, and before the hide was removed.** `HIGHLIGHT_OVERLAY_Z = '7'` in `CanvasShell.ts`; the ordering is specced (dropping it fails one spec, named). Unseen in an app — the drive step is §7's "trigger a lesson highlight with blocks open" |
| L28 | **The remount trap is not the one the file warns about.** `handleWorkspaceChange` writes to `activeTab`, and is correct today only because a key change stops the outgoing workspace re-rendering. Keep two workspaces mounted and a background one re-renders, picks up the *new* active tab's callback, and saves its blocks onto another node. Bind the callback to the tab id at the call site before mounting more than one | ✅ **fixed 2026-08-12**, in its own commit, *before* the pane mounted a second workspace. The tab is bound at the call site in `tabWorkspaces.tsx`. ⚠️ Worth keeping: the fix was **unprovable while it was made** — with one workspace mounted the two readings agree, so the inversion left every spec green. It only goes red once the pane mounts two, and it does |
| L29 | **A `display: none` canvas reports `clientWidth === 0`**, `bindCanvas` writes that straight into the viewport metrics, and nothing re-measures on reveal. Reproducible today: open blocks, resize, close, and the graph returns on a zero viewport. The canvas needs an explicit `resize` exactly as Blockly needs an explicit `svgResize` | ✅ **fixed 2026-08-12** — `measureNodeGraphCanvas` answers `undefined` rather than 0 and the write is skipped; `remeasureNodeGraphCanvas` is the canvas's `resizeBlocklyWorkspaces()` and is called synchronously from the reveal, the pane toggle and both dividers' `onDrag`. 🔴 **And the file understated it:** the *drag* path was broken by the same mechanism, because `Frame.onResize` is fed by a `ResizeObserver` |
| L30 | **Keystroke ownership is the sixth decision and a blocker.** `KeyboardHandler` has no scope and a focused Blockly `<svg>` reads as `'none'`, so Backspace, ⌘Z, ⌘C/⌘V all reach the node graph. The 200 ms `lastBlocklyTabCloseTime` guard is evidence it has bitten, and a split makes that guard useless | 🔴 **open, and now the thing that blocks shipping.** The pane is built and merged-ready; this is not fixed and is deliberately not fixable inside this task — it is a keyboard-scope change the pane forces rather than contains. With a node selected on one pane and a block on the other, **one Delete can mean two deletions**. ⚠️ Still read from the predicate, not driven |
| L31 | **`Blockly.svgResize` was never called anywhere in the editor.** Verified in `blockly_compressed.js`: `inject` binds one `window` `"resize"` listener and it is the library's only `svgResize` caller | ✅ fixed 2026-08-12, `83142881` — unverified in the app |
| L32 | **A React element tree can be gated without a renderer.** §7 concluded the no-remount property "cannot be gated here" because there is no jsdom and nothing may be installed. But an element tree is plain objects, and key/type/sibling-position are exactly what React remounts on — so lifting the tree into a pure builder (`buildTabWorkspaces`) puts most of the property behind a spec. What still needs a drive is whether React and Blockly then behave as the tree implies | ✅ used 2026-08-12 |

## Deferred verification

Nothing below could be run in the lane that wrote this: it may not launch the editor. All of it
needs someone driving a real one.

### 1. The splitter resizes the workspace (acceptance criterion 3) — **screenshot required**

⚠️ **An occluded renderer will not report layout truthfully**, which is the whole reason this
is a screenshot and not a `getBoundingClientRect`. Keep the editor window frontmost and
unoccluded for the whole sequence.

1. Open a project, select a **Logic Builder** node, press *Edit Logic Blocks*.
2. Drag two or three blocks out of the toolbox so the workspace has visible content near its
   right edge and near its bottom.
3. **Screenshot.**
4. Drag the preview/graph `FrameDivider` a long way — at least 200 px, both directions.
5. **Screenshot at each end.**

Passes if the Blockly grid, the trashcan and the zoom controls stay pinned to the workspace's
corners and the block content re-flows with it. Fails if a strip of dead space opens beside the
blocks, or blocks disappear past an edge that no longer moves — that is the SVG still carrying
its injected `width`/`height`.

Then confirm the mechanism rather than the appearance, over CDP:

```js
document.querySelector('.blocklyMainBackground')
        .ownerSVGElement.getAttribute('width')      // must track the container
document.querySelector('.injectionDiv').parentElement.offsetWidth
```

The two must agree after a drag. Before this change they did not.

⚠️ Also drive the **negative** case, because it is the one that hides: with the *preview
detached* (`documentLayout: 'detachedPreview'`) there is no divider, and with **no** Logic
Builder open `resizeBlocklyWorkspaces()` must be a no-op — drag the divider and confirm no
console noise and no regression in the node graph's own resize.

### 2. The no-remount proof (acceptance criterion 4)

This is the one that matters, because its failure mode is silent data loss, and F4/L28 says the
mechanism is not what the warning describes.

1. Open a Logic Builder on node **A**. Build something identifiable — say `set x to 7`.
2. Wait past the 300 ms save debounce.
3. Drag the splitter across its full range, both directions.
4. The blocks must still be there, in the same arrangement, **and the workspace must not have
   re-injected** — watch for the toolbox flashing or the workspace scroll position resetting.
5. Save the project. Read the node's `workspace` and `generatedCode` parameters **on disk** and
   confirm they are node A's edit. *The saved JSON is the assertion; what is on screen is not.*

Then the harder half, which today's single-mount structure cannot even express and any pane
must:

6. Open Logic Builders on **two** nodes, A and B, with visibly different programs.
7. Switch tabs, edit, switch back, drag the splitter, switch again.
8. Save. **Read both nodes' `workspace` on disk.** Neither may contain the other's blocks.

⚠️ Step 8 is the F4 defect's only visible symptom. It will not appear on screen; it appears in
the file.

### 3. The per-layer decisions (acceptance criterion 5)

Once §5 is built, each row is checked individually — a blanket look is what produced the
blanket hide:

- **Highlight overlay:** trigger a lesson highlight (or any `HighlightOverlay` consumer) with
  blocks open. Its outline must not cross the splitter. **This is the failing case if the
  `z-index: 7` from L27 was skipped.**
- **Recording HUD:** arm a recording with blocks open. The Record pill and the node badges stay
  over the canvas pane, never over the workspace.
- **Canvas HUD:** confirm there are not two zoom clusters competing bottom-right (Blockly draws
  its own). If there are, that is L25's open design question, not a bug to patch.
- **Component trail:** visible throughout, naming the component you are actually in — including
  after switching components with a Logic Builder tab open, which today shows the previous
  component's blocks with no label at all.
- **Comment layers:** a comment positioned beyond the splitter is clipped to the canvas pane,
  not drawn over the blocks.
- **Execution overlay:** pin a workflow run, then open blocks. It stays over the canvas pane.
  It has never been in the hide list, so it has never been decided — only covered.

### 4. The A/B, which nobody has run — **and it is the acceptance criterion**

⚠️ **Outstanding. Nothing in this lane, or any code lane, can meet it.**

§2 rules that this design is measured, not assumed, because
*Block-based or graph-based? Why not both?* (IwC 38(1) 2026) built almost exactly it and its
users **underperformed** a pure block-based group on completion, comprehension and usability
*while preferring it*. Preference and performance diverged, and preference is the signal this
task will generate on its own.

So: half the testers get the pane, half get today's takeover, both do a real task, and the
measurement is **completion time and comprehension** — not what anyone says they liked. If the
pane group is not faster, we built a preference.

Record the result **whichever way it goes**. A negative result is the more valuable one here,
because it is the one nobody expects — and because a positive one measured only by preference
is exactly the result the paper already got.

## ✅ DRIVEN 2026-08-12 — the acceptance criterion is met, and the pane has a missing floor

Merged into `cline-dev` and driven from the **primary** checkout (a worktree cannot: `lerna exec`
resolves to primary). Fixture: a throwaway copy of `lgc59-drive` carrying **two** Logic Builder
nodes, `c6` (7 blocks) and `c99` (1 block), because one node cannot exercise F4 at all.

| Claim | Result |
|---|---|
| **Both panes on screen at once** — F2's ruling | ✅ **Met.** `#nodegraphcanvas` is `display: block`, 518×356 css, with live nodes and wires drawn, while the block editor holds the right pane. The blanket hide is gone |
| **Every open tab stays mounted** | ✅ **Met.** Two `[data-tab-id]` containers, each with its own injected `blocklySvg`; the inactive one is `display: none`, `aria-hidden="true"`, **not unmounted**. Main workspaces carry 7 and 1 blocks — their own programs, not each other's |
| 🔴 **F4 — an edit belongs to the tab that made it** | ✅ **Met, and this is the one that matters.** With `c99` active, a block was moved in `c6`'s **background** workspace. The edit landed on **`c6`** (`x:71,y:47`, the exact move) and `c6`'s `generatedCode` regenerated from its own program. **`c99` was untouched** — same `workspace`, and `generatedCode` still `Outputs.second = 2;`. This is precisely the program-eating case, and it does not happen |
| **Not remounted by a splitter drag** — *the* criterion | ✅ **Met.** Splitter dragged 847 → **1077** px. Both Blockly workspace **object ids are identical** across the drag, containers identical, block counts identical (7, 1). A remount would have produced new ids |
| 🔴 **F3 — the canvas re-measures** | ✅ **Met, and measured.** The canvas backing store went **1036 → 1496** (css 518 → 748) as the splitter moved. Nothing re-bound before this task, so this is the fix working on the drag rather than only on the reveal |

### 🔴 The finding: the pane has no minimum width, and past ~304 px the block editor ceases to exist

Dragged to a **288 px** pane, the measurements are unambiguous:

| | |
|---|---|
| pane width | **288 px** |
| the two interface rails | **152 + 152 = 304 px** |
| `.injectionDiv` (the Blockly workspace) | **0 px** |

The rails alone are wider than the pane, and the workspace they frame is gone. Nothing clamps it,
and there is no message — the block editor simply is not there. **This also answers LGC-004's step
14**, which was blocked on this splitter existing: *"at some width this stops being usable; find that
width and say what should happen."* The floor is **not** a taste question — it is 304 px of rails
plus whatever a workspace needs, and below it the pane renders a feature that has vanished.

⚠️ **What should happen is a decision, not a bug fix**: clamp the splitter at a minimum, collapse the
rails below a threshold (they are DOM siblings, so they can), or let the pane collapse to a closed
state. Filed rather than chosen.

### One near-miss worth keeping

Sampled 8 s after opening both tabs, `c6` had **two flyout workspaces and no main workspace** — which
reads exactly like "the first tab's workspace was disposed when the second opened", a serious defect.
It was not. `BlocklyWorkspace.setup()` awaits the language bundle, so the injection was still in
flight; moments later `c6` had its main workspace and all 7 blocks. **`Blockly.Workspace.getAll()`
includes flyouts** (filter on `isFlyout`), and an async injection sampled too early looks like a
disposal. Third instance today of the same shape — see LGC-004's grab-point trap and LGC-007's
vacuous pass.

### Still not met

- **§2's A/B** — unchanged, needs human testers.
- **L30 keystroke ownership.** With both surfaces on screen a node selection and a block selection
  coexist and `KeyboardHandler` has no scope, so one Delete can mean two deletions. 🔴 The lane is
  right that this **blocks shipping, not merging** — it is a keyboard-scope task the pane forces
  rather than contains. Not driven; not fixed.
- The split is not persisted across restarts; `detachedPreview` undriven.
