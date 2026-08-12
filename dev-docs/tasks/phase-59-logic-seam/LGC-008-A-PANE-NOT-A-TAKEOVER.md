# LGC-008 — the workspace stops hiding everything else

**Status:** 🔬 **§3 analysed, `svgResize` seam built, pane not built** (2026-08-12) ·
**Track: the eyes** · prior art: MakeCode · last in the order, and deliberately

> **Read §5, §6 and §7 before building anything here.** The five decisions are answered and
> there are **eight** layers, not five. Three of the findings are open defects that predate
> this task and one of them (L28) is the exact defect a pane would otherwise ship. §1 ends in a
> question for Richard, and the acceptance criterion nobody has met is the A/B, not the code.

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

## What happens today

Opening a Visual Function **hides the entire canvas**.
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

**Not built: the pane itself.** Deliberately, and for reasons that are about evidence, not
effort:

1. F1 and F2 change what §1 should be, and F2 ends in a question only Richard can answer.
   Building the wrong one of two readings is worse than building neither.
2. The correct structure requires the canvas layers to be inset by a tab strip and
   **re-measured** (F3), and a `display: none` canvas reports zero — so the one thing that
   would prove it right is a screenshot, which this lane cannot take.
3. There is no React test runner in reach. `tests-unit`/`tests-main` are `testEnvironment:
   'node'` with no jsdom, and the jasmine suite needs a real Electron renderer. So the
   no-remount property (F4) **cannot be gated here** — only reasoned about, which is what §6
   does.

## Acceptance

- Opening a Visual Function no longer hides the canvas; it opens a pane.
- The companion pane defaults to the running app, with the node graph available in its tab bar.
- Dragging the splitter resizes the workspace correctly — verified **with a screenshot**, because an
  occluded renderer will not report layout truthfully.
- The workspace is **not remounted** by a resize, a splitter drag or a pane swap. Proven by editing
  a program, dragging the splitter, and confirming the edit survives and the saved JSON is the edited
  one.
- The recording HUD, comment layers and highlight overlay each have a stated behaviour in split mode,
  and the blanket `display: none` is gone.
- ⚠️ **A/B against the takeover on a real task**, per §2. Record the result whichever way it goes —
  a negative result here is more valuable than a positive one, because it is the one nobody expects.

## Register

| # | Finding | State |
|---|---|---|
| L23 | MakeCode's split is **result \| code**, not code \| code. Our first draft put the node graph in the left pane; the loved design puts the running thing there | ✅ corrected 2026-08-09 |
| L24 | IwC 38(1) 2026 measured almost exactly this layout and the hybrid **lost while being preferred**. This task must be measured, not shipped on enthusiasm | ⚠️ standing |
| L25 | `OverlayViews`' blanket hide has a documented reason per layer. Removing it is five decisions, not one | ✅ answered 2026-08-12 — §5. It is **eight** layers, not five, and the hide is doing far less than it looks: everything except the highlight overlay is already covered by the tabs root's opaque `z-index: 100`, so the decisions are about what each layer is *for* once it has a rectangle, not about whether it shows |
| L26 | **The companion pane already exists.** `EditorDocument`'s `FrameDivider` already puts the running app beside the node graph, and `setCanvasVisibility` never reached it — so a Visual Function already opens with the app live beside the blocks. §2's default is met by structure that exists. What the takeover destroys is the *node graph*, and a new inner splitter would be graph \| blocks, the configuration §2 rules out | ⚠️ standing — decides §1 |
| L27 | **The highlight overlay is the only unsafe `display: none` to remove.** Its clipping wrapper is the one built without a `z-index`, so its 999/1000/1001 escape the tabs root's 100. Give it `z-index: 7` first (execution 5 < recording 6 < highlight 7, all below `.popup-layer`'s 10) | 📋 open — do before any hide is removed |
| L28 | **The remount trap is not the one the file warns about.** `handleWorkspaceChange` writes to `activeTab`, and is correct today only because a key change stops the outgoing workspace re-rendering. Keep two workspaces mounted and a background one re-renders, picks up the *new* active tab's callback, and saves its blocks onto another node. Bind the callback to the tab id at the call site before mounting more than one | 🔴 open — the defect a pane will otherwise ship |
| L29 | **A `display: none` canvas reports `clientWidth === 0`**, `bindCanvas` writes that straight into the viewport metrics, and nothing re-measures on reveal. Reproducible today: open blocks, resize, close, and the graph returns on a zero viewport. The canvas needs an explicit `resize` exactly as Blockly needs an explicit `svgResize` | 🔴 open — defect, predates this task |
| L30 | **Keystroke ownership is the sixth decision and a blocker.** `KeyboardHandler` has no scope and a focused Blockly `<svg>` reads as `'none'`, so Backspace, ⌘Z, ⌘C/⌘V all reach the node graph. The 200 ms `lastBlocklyTabCloseTime` guard is evidence it has bitten, and a split makes that guard useless | 🔴 open — decide before the pane ships |
| L31 | **`Blockly.svgResize` was never called anywhere in the editor.** Verified in `blockly_compressed.js`: `inject` binds one `window` `"resize"` listener and it is the library's only `svgResize` caller | ✅ fixed 2026-08-12, `83142881` — unverified in the app |

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
