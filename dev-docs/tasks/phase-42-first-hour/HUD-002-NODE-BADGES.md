# HUD-002 — badges on the nodes as they fire

Out of [TALK-003](TALK-003-A-RECORDING-HUD.md), talked 2026-08-05. Follows
[HUD-001](HUD-001-THE-RECORDING-OVERLAY.md).

This is the demo: click a button in the preview, watch the graph light up.

## The join, and its exact shape

`getNodeBounds(nodeId)` → canvas-space bounds, or `null` when the node is not in the open graph
([OverlayViews.ts:103-113](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/OverlayViews.ts#L103-L113)).
Trace events carry the two ends of the edge that fired.

⚠️ **The fields are `from` and `to`, each an `EdgeRef` of `{node, port}`** —
[walkEngine.ts:68-77](../../../packages/noodl-editor/src/editor/src/utils/provenance/walkEngine.ts#L68-L77).
TALK-003 called them `fromNode`/`toNode`; nothing by that name exists.

So a badge is `getNodeBounds(event.to.node)` (and `event.from.node`), rendered in the canvas-space
transform container exactly as `ExecutionNodeBadge` is
([ExecutionOverlay.tsx:228-250](../../../packages/noodl-editor/src/editor/src/views/CanvasOverlays/ExecutionOverlay/ExecutionOverlay.tsx#L228-L250)).

## Q3's answer, and why it is not decoration

**Badges for this canvas; the counter app-wide and honest.** Events arrive for the whole app while
the canvas shows one component, and both silent alternatives are lies: badging only what is open
and counting only what is open makes a click that fires forty events elsewhere read as *nothing
happened*; counting app-wide with no explanation makes the user hunt for badges that were never
going to appear.

`ExecutionOverlay` already models the honest version — it counts what resolved and says
`Showing 3 of 5 steps — 2 are not in this graph`
([ExecutionOverlay.tsx:151-226](../../../packages/noodl-editor/src/editor/src/views/CanvasOverlays/ExecutionOverlay/ExecutionOverlay.tsx#L151-L226)),
computed in render rather than memoised because the open graph changes underneath. Same rule here.
The component *name* for the message comes from the trace dictionary, which carries `component`
per node — `describeNode(index, nodeId)` already returns it, so "12 on Checkout" needs no project
access.

## Slices

**Slice 1 — the badge set.** From the events the session holds, derive the set of node ids that
fired, most-recent-first, capped. An edge that fired 100 times is one badge saying `100×`, never
100 badges — the same rule `metaFor` applies to walk rows
([ProvenancePanel.tsx:566-571](../../../packages/noodl-editor/src/editor/src/views/panels/ProvenancePanel/ProvenancePanel.tsx#L566-L571)),
and a repeater over a collection produces this every time.

**Slice 2 — fade.** A badge fades N seconds after its node last fired (start with 3 s). Without a
fade, thirty seconds of clicking lights the entire graph and the display stops meaning "this just
happened". The fade is presentational only — the events stay in the session for the walk.

**Slice 3 — the off-canvas count.** In the header: `47 events · 12 on other components`, with the
component names when there are few enough to name. Derived at render from `getNodeBounds`
returning `null`, not cached.

**Slice 4 — click a badge.** Selects that node's most recent event as the walk target and hands
off — the mechanism is [HUD-003](HUD-003-EXPAND-TO-THE-WALK.md); this slice only needs the badge
to be a target.

## Criteria

1. Click a button in the preview → badges appear on the nodes that fired, within ~1.5 s (the poll).
2. Navigate to another component mid-recording → badges follow the open canvas; the header count
   does not drop.
3. A node that fired 40 times shows one badge reading `40×`.
4. Badges fade; a graph left alone for ten seconds shows none.
5. Recording on a component where nothing fires says so, rather than showing an empty canvas that
   is indistinguishable from a broken overlay.
6. Verified in the running editor with a real preview — a fixture cannot produce this.

## Traps

- **Delivery is queued, not a call stack** (OBS-001). Badge order is `seq` order, which is not
  wall-clock arrival order into the panel; do not sort by `t` and expect the causal story.
- Pan and zoom re-render the whole overlay; anything computed per badge must be cheap. The
  execution overlay's comment about a render-time comparison being deliberately free applies here
  with more force — a recording re-renders on every poll *and* every pan.
- `getNodeBounds` resolves against the **currently open graph** only, and a node deleted since it
  fired resolves to `null` too. That is the same condition as off-canvas and does not need its own
  message.
