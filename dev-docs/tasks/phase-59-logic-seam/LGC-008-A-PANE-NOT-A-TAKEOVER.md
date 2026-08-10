# LGC-008 — the workspace stops hiding everything else

**Status:** 📋 open · **Track: the eyes** · prior art: MakeCode · last in the order, and deliberately

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
| L25 | `OverlayViews`' blanket hide has a documented reason per layer. Removing it is five decisions, not one | 📋 open |
