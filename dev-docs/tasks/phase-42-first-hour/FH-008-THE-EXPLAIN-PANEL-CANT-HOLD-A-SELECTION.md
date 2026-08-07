# FH-008 — The Explain panel can't hold a node selection

Covers reported item **7**.

## What was reported

> I think the 'Explain' panel is a bit weird and should maybe be turned off. It's titled 'explain
> this node' but you can't select a node because it steals the focus to the node props left menu
> and when you go back to Explain the node focus is cleared.

## The mechanism — the panel doesn't steal focus; the editor punishes it twice

The panel is real AI (AIX-004): streams an explanation of the active component or a selected node,
with clickable node citations. The selection failure is three separate mechanisms:

1. **Clicking a node forcibly switches the sidebar to the property editor** —
   `SelectionActions.ts:137` calls `SidebarModel.switchToNode(...)` unconditionally. That's the
   "steals the focus" you saw, and it's by design for every panel.
2. **Switching back to Explain destroys the canvas selection** —
   [`EditorEventBindings.ts:170-181`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/EditorEventBindings.ts#L170-L181):
   on panel change, any panel not in the `PropertyEditor`/`PortEditor` allow-list gets
   `editor.deselect()`. `'explain'` is not in the list. Explain and a visibly-selected node are
   mutually exclusive **by construction**.
3. **The panel never re-reads when it becomes visible.** Sidebar panels are hidden-not-unmounted;
   `useCanvasSelection` reads once at mount and only updates on two events. `useIsActivePanel`
   exists for exactly this and is not used. The `explainTarget` memo workaround covers the
   single-click and context-menu paths only — multi-select is never remembered (the deselect in
   (2) runs before the panel's first read), and deselecting on empty canvas leaves a stale target.

Zero test coverage on `explainTarget`/`useCanvasSelection` — which is why this shipped. AIX-004's
own notes record that no live provider run was ever done on the panel.

## The decision, then the build

**Turn it off or fix it?** Turning it off needs no code — it's an experimental panel
(`experimental.panel.explain`, toggleable in Editor Settings; the context-menu entry self-disables
with the registration). But the fix is small and located, and "explain this node" is a good
capability to keep for alpha users with an AI key configured. **Recommendation: fix it** — if you
disagree, flag it and we flip the experimental default off instead, one line.

The fix:

1. Add `'explain'` to the allow-list at `EditorEventBindings.ts:174` — showing Explain no longer
   deselects.
2. Re-read the live selection when the panel becomes active (`useIsActivePanel` + a read of
   `nodeGraph.getSelectedNodes()`), replacing the mount-once read.
3. Wire `forgetTarget()` to empty-canvas deselection so a stale target can't be explained.
4. Multi-select: either remember it properly or scope v1 honestly to "one node or the whole
   component" and say so in the empty-state copy.
5. A jasmine spec for the target memo's remember/forget paths.

## Criteria

1. Select a node → sidebar switches to properties (unchanged) → click Explain in the rail → the
   node is still selected on canvas and the panel explains *that node*.
2. Click empty canvas → Explain offers the whole component, not the last node.
3. Navigate components → target and session reset (existing behaviour, kept).
4. With no AI key configured the panel still explains its disabled state (existing).
5. Verified in the running editor — panel visibility mechanics are exactly what jasmine can't see.
   Remember: HMR won't re-run effects in a mounted panel; restart before concluding a fix failed.
