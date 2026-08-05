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
