# TALK-003 — Record as a live HUD, not a panel you have to be looking at

Covers reported item **10** (design half — the "records nothing" defect is
[FH-011](FH-011-RECORD-RECORDS-NOTHING.md) and stands alone; do it first regardless of this
conversation).

## Your idea, restated

> Maybe clicking record should create an editor overlay? Like a panel that floats at the top, a
> bit like what happens in the cloud workflows, where you see that it's recording and you can see
> when events fire, and you can expand the record panel to see what happened… a kind of live HUD
> of what's happening inside the node canvas when you're clicking buttons, the inputs and
> outputs, walking back through the nodes that fired, again like what's done in the cloud
> workflows which is very cool.

That's a coherent split: **Provenance panel = ask questions about wiring; Record = watch the app
run.** Today Record is a mode of the panel, which is why it feels vestigial.

## Why this is cheaper than it sounds — the machinery exists

The cloud-workflow experience you're pointing at is `ExecutionOverlay`, and the canvas overlay
infrastructure is general:

- **One mount mechanism**: `OverlayHost.renderSlot()` — named slots
  (`highlight-overlay-layer`, `execution-overlay-layer`, `canvas-hud-root`) created in
  `CanvasShell`, one React root each, re-rendered on pan/zoom with a
  `{viewport, getNodeBounds}` contract.
- **`ExecutionOverlay` is the template**: fixed header bar ("recording · Stop") + canvas-space
  per-node badges + canvas-space data popup + fixed timeline scrubber — driven entirely by
  EventDispatcher events, with POL-009's per-canvas scoping pattern.
- **`getNodeBounds` (node id → canvas bounds) is exactly the join a recording HUD needs** against
  `TraceEvent.fromNode`/`toNode`.
- The trace substrate already captures everything (every edge event, values and signals, with
  causal `cause` links) — FH-011 makes the pull path honest; the HUD is a second consumer of the
  same `TraceSession`.

So the build is: a `RecordingOverlay` in the execution-overlay slot, subscribed to
`TraceSession`, showing (a) an armed/recording header with a live event counter, (b) badges on
nodes as they fire (fade after N seconds), (c) expand → the root-interactions list, click one →
jump into the Provenance panel's walk for that root. The scrubber idea maps to replaying a root's
causal tree step by step — v2, the timeline component is reusable when we want it.

## The questions for the session

**Q1 — Is the HUD the *only* face of Record?** I.e., does the Record button move out of the
Provenance panel entirely (canvas HUD button or toolbar), with the panel keeping only the walk?
My lean: yes — your own framing ("record is a bit of a separate thing") is the right product
split, and it resolves the current weirdness where arming a recorder lives inside a
question-answering panel. The panel gets a "Recorded interactions" section fed by the same
session either way.

**Q2 — How live is live?** The trace pull is a 1.5s poll today (delivery is queued, not pushed).
For badge-as-it-fires the poll is probably fine (badges lag ≤1.5s); a push channel is more work
on the relay. Start with the poll; judge in use.

**Q3 — Scope per component or whole app?** Events arrive app-wide; the canvas shows one
component. POL-009's answer (show what's on this canvas, say "N events on other components"
honestly) is the right default. The counter in the header should be app-wide so nothing looks
lost.

**Q4 — Relationship to the observe MCP.** `nodegx-observe`'s `start_trace`/`stop_trace` share the
same global trace switch — an agent stopping a trace silently disarms your recording (noted in
FH-011). If Record becomes a HUD, the HUD should *show* who owns the trace ("recording (agent)")
rather than pretending it's alone. Small, but it prevents a whole class of "it stopped by
itself".

**Q5 — Alpha priority.** FH-011 makes Record work inside the existing panel. Is the HUD an alpha
feature or a fast-follow? It's the demo-able face of observability ("click your app, watch the
graph light up") — high wow-per-effort, but it competes with the workflow-audit fixes for the
same weeks. Your call; my lean is fast-follow immediately after FH-011 unless an alpha demo needs
the wow.

## If we proceed, the slices

1. `RecordingOverlay` header + counter, driven by `TraceSession` recording state (kills the
   "armed but dead" ambiguity visually — pairs with FH-011's re-arm work).
2. Node badges from polled events via `getNodeBounds`, POL-009-scoped.
3. Expand → roots list → hand off to the Provenance walk.
4. (v2) replay scrubber over a root's causal tree.

---

## ✅ Talked 2026-08-05 — the decisions

Every premise above was re-checked against the code before the conversation. The machinery is
where the doc said it was; three things it said were wrong or missing, and they are folded into
the tasks below.

| # | Question | Richard's decision |
|---|---|---|
| Q1 | Is the HUD the only face of Record? | **Yes — Record moves to the canvas.** The Provenance panel keeps the walk and a "Recorded interactions" section; it no longer arms anything. |
| Q2 | How live is live? | **Poll** (not asked — my call, stated and unopposed). The existing 1.5 s pull is invisible at click speed, and "the editor pulls, the runtime never pushes" is the constraint that keeps this out of the failure mode the shelved Data Lineage panel died of. |
| Q3 | Per component or app-wide? | **Badges for this canvas, counter app-wide and honest.** POL-009's rule, plus "N events on other components" spelled out so a click that fires elsewhere never reads as "nothing happened". |
| Q4 | The observe MCP shares the trace switch | **Separate the switches** — per-peer trace ownership, the expensive answer. An agent's `stop_trace` must not disarm a human's recording, and an agent's `start_trace` must not *destroy* one. |
| Q5 | Alpha or fast-follow? | **Alpha. Build it now.** |

### Three corrections to this doc

1. **The `execution-overlay` slot is taken.** `ExecutionOverlay` owns it
   ([OverlayViews.ts:163-181](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/OverlayViews.ts#L163-L181));
   a second `renderSlot` on the same name would unmount it. The HUD gets its own layer in
   [CanvasShell.ts:78-102](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/CanvasShell.ts#L78-L102)
   and its own render/update pair. ~15 lines, but not the free ride the doc implied.

2. **Q4 had no signal to show, and "separate the switches" is bigger than it sounds.** The editor
   only handles messages with `type === 'viewer'`
   ([ViewerConnection.ts:153-219](../../../packages/noodl-editor/src/editor/src/ViewerConnection.ts#L153-L219)),
   so another peer's `traceEnabled` is invisible to it. Worse, the relay forwards messages
   **verbatim** without stamping a sender
   ([relay-server.js:150-164](../../../packages/noodl-editor/src/main/src/relay-server.js#L150-L164)),
   and **neither editor peer registers a `clientId` at all** — the editor sends
   `{cmd:'register', type:'editor', token}` ([ViewerConnection.ts:103](../../../packages/noodl-editor/src/editor/src/ViewerConnection.ts#L103))
   and so does `nodegx-observe` ([relayClient.ts:136](../../../packages/nodegx-observe/src/relayClient.ts#L136)).
   There is no identity to own a switch with. That is [HUD-004](HUD-004-THE-TRACE-HAS-OWNERS.md),
   and it turned up a **live data-loss bug** on the way: `setTraceEnabled(true)` replaces the
   buffer unconditionally ([nodecontext.ts:684-690](../../../packages/noodl-runtime/src/nodecontext.ts#L684-L690)),
   so an agent calling `start_trace` today silently destroys a recording a human is in the middle of.

3. **Q1's decision moves FH-011's poll.** A sidebar panel's component is created only when the
   panel is **first opened** ([SidePanel.tsx:57-68](../../../packages/noodl-editor/src/editor/src/views/SidePanel/SidePanel.tsx#L57-L68))
   — not merely hidden, *never constructed*. With Record on the canvas, a user who has never
   opened the Provenance panel has nothing pulling the buffer, and the HUD would sit at `0 events`
   for the whole session while the runtime happily recorded. **The poll must move out of the panel
   and into `TraceSession`.** FH-011 slice 2 is amended accordingly, and it is the one change in
   that task this conversation actually alters.

### The HUD track

Build in this order. **[FH-011](FH-011-RECORD-RECORDS-NOTHING.md) gates all four** — a HUD over a
recorder that records nothing is a prettier version of the same defect.

| # | Task | Why |
|---|---|---|
| 1 | [HUD-001](HUD-001-THE-RECORDING-OVERLAY.md) — the overlay, the control, the counter | Record becomes one canvas control with two states (Q1). Kills the "armed but dead" ambiguity visually. |
| 2 | [HUD-002](HUD-002-NODE-BADGES.md) — badges as nodes fire | The wow. `getNodeBounds` × `TraceEvent.fromNode`, POL-009-scoped, honest about what is off-canvas (Q3). |
| 3 | [HUD-003](HUD-003-EXPAND-TO-THE-WALK.md) — expand → roots → walk | Joins the two halves: watch it run, then ask why. |
| 4 | [HUD-004](HUD-004-THE-TRACE-HAS-OWNERS.md) — per-peer trace ownership | Q4. Two peers, one global boolean, no identity — and today the second one to arm wipes the first one's buffer. |
| — | replay scrubber | Still v2, as the doc had it. `ExecutionTimeline` is reusable when we want it. |
