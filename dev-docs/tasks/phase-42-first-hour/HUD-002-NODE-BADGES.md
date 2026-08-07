# HUD-002 — badges on the nodes as they fire

Out of [TALK-003](TALK-003-A-RECORDING-HUD.md), talked 2026-08-05. Follows
[HUD-001](HUD-001-THE-RECORDING-OVERLAY.md).

This is the demo: click a button in the preview, watch the graph light up.

**Status:** shipped 2026-08-06 — slices 1–3. **Slice 4 (click a badge) is deferred to
[HUD-003](HUD-003-EXPAND-TO-THE-WALK.md)**, which owns the only thing a click could hand off to;
the reason is below and it is not just sequencing. This doc had one wrong premise and one that
was right for the wrong reason; both are corrected below. **Criterion 6 (the live drive with a
real preview) is outstanding** — the recipe is at the foot of this doc.

## The join, and its exact shape

`getNodeBounds(nodeId)` → canvas-space bounds, or `null` when the node is not in the open graph
([OverlayViews.ts:103-113](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/OverlayViews.ts#L103-L113)).
Trace events carry the two ends of the edge that fired.

⚠️ **The fields are `from` and `to`, each an `EdgeRef` of `{node, port}`** —
[walkEngine.ts:68-77](../../../packages/noodl-editor/src/editor/src/utils/provenance/walkEngine.ts#L68-L77).
✅ verified, exactly at those lines.

⚠️ **Correction to the correction:** "nothing by that name exists" is not quite true, and the
almost-truth is the trap. `fromNode`/`toNode` *are* real — they are the fields of the runtime's
in-memory `TraceEvent`
([tracebuffer.ts:42-60](../../../packages/noodl-runtime/src/tracebuffer.ts)) — and `toWireEvent`
nests them into `from`/`to` on the way onto the wire. So a search for `fromNode` finds code,
reads as confirmation, and points at a struct the editor never sees. The editor only ever holds
`WireTraceEvent`, which `walkEngine`'s `TraceEventLike` mirrors structurally.

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

**Slice 1 — the badge set.** ✅ `foldEvents` in
[recordingHud.ts](../../../packages/noodl-editor/src/editor/src/utils/provenance/recordingHud.ts)
folds the session's buffer into one entry per node, ordered by `seq` and capped at 40 painted at
once. An edge that fired 40 times is one badge saying `40×` — the same rule `metaFor` applies to
walk rows, and a repeater over a collection produces it every time. Both ends of every edge get a
badge: an edge firing is two facts, and a user watching their graph light up is watching the
wire, not one of its ends.

**Slice 2 — fade.** ✅ 3s, then out over the last third.

⚠️ **Correction — the fade cannot be computed from `TraceEvent.t`, and the doc's phrasing ("N
seconds after its node last fired") invites exactly that.** `t` is `platform.getCurrentTime()`,
which in the browser viewer is `window.performance.now()`
([noodl-viewer-react.js:42](../../../packages/noodl-viewer-react/noodl-viewer-react.js)) —
milliseconds since the *preview page* loaded, not a wall clock. `now - event.t` against the
editor's `Date.now()` is about fifty-six years, so **every badge would be born already faded and
nothing would ever be drawn.** The fold stamps the editor's own clock instead, which is also the
better answer to the question a fade is asking: *how long since I saw this*. `tracebuffer.ts`
labels `t` "wall clock, for display only" and it is only the second half of that which is true.

> **Filed, not fixed:** `ProvenancePanel`'s walk rows do `new Date(row.event.t)` to print a time
> against each hop (`timeOf`). With `t` counting from page load, those read `01:00:04` and
> similar — a confident, wrong clock time on every row of a walk. Out of scope here; it wants
> either a relative render ("4.2s in") or a `t0` handshake at trace start.

**Slice 3 — the off-canvas count.** ✅ `47 events · 12 on other components`, with the component
names while there are ≤3 of them, plus a second line under the pill when *nothing* on this canvas
fired (criterion 5). Derived at render from `getNodeBounds` returning `null`, never cached — the
open graph changes underneath the overlay on every navigation.

⚠️ **The `12` counts events, and getting that exactly right needed a decision the doc does not
make.** Every event has two ends, so summing per-node counts over off-canvas nodes double-counts;
counting per event at render is O(250k) on a surface that repaints on every pan. The fold keeps
two numbers per node — `touches` (either end, for the `40×`) and `received` (deliveries only) —
and the off-canvas sum uses `received`, which attributes every event to exactly one node. So the
header's two numbers are the same currency, and `12 on other components` is a real count of
events, not of edge ends.

**Slice 4 — click a badge.** ⏸ **Deferred to [HUD-003](HUD-003-EXPAND-TO-THE-WALK.md).** Not
merely sequencing: the badges ship `pointer-events: none`, deliberately. This canvas is Canvas2D
and has **no port hit-testing at all** — every gesture over a node belongs to the canvas — so a
badge with `pointer-events: all` beside a node during a recording eats the drag, the marquee and
the right-click *Why is this empty?* at exactly the moment the user is reproducing a bug.
Enabling the click is one CSS line, and it should land in the same change as somewhere for the
click to go.

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
- `getNodeBounds` is an **O(graph) walk per call** (`HitTester.findNodeWithId` recurses the whole
  root list). The overlay asks about every node the recording has touched — once for the summary,
  once per badge — so it caches the answers in a `Map` for the life of one render pass and throws
  it away with the pass. Caching it across renders would be the stale-bounds bug the render-time
  rule exists to avoid.

## Live QA — the recipe

Not run: a dev launch rewrites the example project and this checkout is shared. A fixture cannot
produce this (criterion 6) — it needs a real preview. **Both themes** — the canvas repalettes on
`nodegx:themechanged` (UIX-005) and the badges sit on top of it. **Restart rather than trusting
HMR**: the overlay's subscription is a mount effect in a React root created once per editor.

1. Open a project with a button wired to something, and start the preview.
2. Press **Record** (the pill at the bottom centre of the canvas — HUD-001).
3. Click the button in the preview. Within ~1.5s (the poll) a blue `1×` badge appears to the
   right of **both** the button node and whatever it fired into.
4. Click it forty times. **One badge per node reading `40×`** — never forty badges (criterion 3).
5. Stop clicking and wait. The badges hold for ~2s, fade over the third, and are gone by 3s; a
   graph left alone for ten seconds shows none (criterion 4). Watch that the ticking stops with
   them — no repaint after the last badge goes.
6. Pan and zoom while badges are up: they stay pinned to their nodes (they are inside the
   transform container).
7. Navigate to another component mid-recording (criterion 2). The badges follow the open canvas;
   **the header count does not drop** — it stays app-wide and gains `· N on <component>`.
8. Sit on a component where nothing fires while clicking around elsewhere (criterion 5). The
   canvas is empty of badges but the HUD says *Nothing has fired on this component. Open
   /Whatever to watch it happen.* — never a bare empty canvas.
9. **Drag a node that has a badge on it.** The drag must work: the badge is `pointer-events:
   none` and must not intercept it. Right-click its port and choose *Why is this empty?* — that
   must work too.
10. Press **Stop**. Badges clear immediately; open Provenance and the walk still shows every one
    of those events as `fired N×` (the fade was presentational only).
