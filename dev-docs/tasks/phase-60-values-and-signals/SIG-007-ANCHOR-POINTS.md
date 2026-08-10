# SIG-007 — Anchor points

**Status:** 📋 open · **Track SIG** · ⚠️ **the largest task in the phase, and the only speculative one**

> *"In another app he showed in his demo, you could click drag a connector line and create an 'anchor
> point' that would adjust the trajectory of the connector line — so like clicking near one end and
> dragging to make it curve more sharply before moving off to its destination, adding as many anchor
> points (and deleting with right click I guess) as you like."*

## §0 — Read this before committing to it

This is the only task in phase 60 that:

- **changes what a connection is on disk.** Every other task is paint, copy or grouping. This one adds
  persistent geometry to the model, which means the project format, the importer, the exporter, the
  undo stack, the diff annotations and the AI write path all acquire a new field.
- **was reported once, as an observation about a different tool**, rather than twice as a point of
  confusion. The other six tasks all trace to somebody being unable to do something.
- **is a workaround for a problem the phase's other tasks may remove.** Wires get routed by hand when
  you cannot tell what they are or where they go. SIG-005 and SIG-006 are about exactly that.

⚠️ **The honest sequencing is: ship SIG-001 through SIG-006, put the result in front of the same user,
and ask whether he still wants to bend wires.** If he does, this task is well-specified below and
worth doing. If the answer is that legible wires were the actual need, this is a large change to the
project format bought for a preference.

**That is a recommendation, not a refusal.** Manual routing is a real and much-loved feature in node
editors, and the argument for building it anyway is that graphs get dense enough that no amount of
endpoint clarity substitutes for moving a wire out of the way.

## What is on disk

- **Wires are cubic béziers with fixed control points**, drawn as a single
  `bezierCurveTo` from a four-element `curve` array
  ([`NodeGraphEditorConnection.ts:342-343`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L342-L343)).
  `curve[0]` and `curve[3]` are the endpoints; `curve[1]` and `curve[2]` are derived, not stored.
- **Hit-testing already exists and is already widened on purpose.**
  [`:196-207`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L196-L207) temporarily
  raises `ctx.lineWidth` to `hitStrokeWidth` because `isPointInStroke` reads it. A click-on-wire
  interaction has a working substrate.
- **Endpoints are already draggable handles** — `endpointAt(pos)` returns `'from' | 'to' | undefined`
  with a hit radius of 8 against a paint radius of 3
  ([`:213-222`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L213-L222), CAN-003).
  ⚠️ **Anchor dragging must not collide with this.** Grabbing near an end already means "re-target this
  wire", and the feature as described starts by *"clicking near one end and dragging"* — the two
  gestures are, as reported, the same gesture.
- **The wire already carries multiple visual meanings** — type, health, pulse, diff annotation, and
  selection-by-weight ([`:614-627`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L614-L627)).
  Anchor handles are a sixth thing on the same object.
- ⚠️ **Connections are model objects with an undo/redo contract.** See `NodeGraphModel`'s
  `do`/`undo` pairs around connection edits
  ([`NodeGraphModel.ts:478-490`](../../../packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphModel.ts#L478-L490)). Anchors
  are model state and inherit all of it.

## Build

1. **Decide the geometry, and write it down first.** A list of anchor points turns one cubic bézier
   into a spline. The choices — polyline with rounded corners, chained cubics with derived tangents,
   or Catmull-Rom through the anchors — differ in how the wire behaves when a node *moves*, which is
   the case that will make or break it. ⚠️ An anchor stored in absolute canvas coordinates on a wire
   whose endpoints then move produces a wire that loops back on itself. Decide relative-vs-absolute
   before writing the model field.
2. **Model and persistence.** Anchors on the connection model, in the project format, through import
   and export, with undo/redo. ⚠️ **A pure editor round trip is a fixed point for derived fields but
   not for new ones** — a field the exporter does not know about is dropped silently, and the loss
   shows up as "my routing disappeared when I reopened the project", not as an error.
3. **Interaction.** Drag on the wire body to mint an anchor; drag an anchor to move it; right-click to
   delete. ⚠️ Reconcile with `endpointAt` **before** building: define the radius inside which a drag
   re-targets rather than bends, and make it visible.
4. **Rendering.** Anchor handles appear on hover/selection only — the same argument that keeps
   endpoints as dots on unhovered wires ([`:632-636`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L632)):
   *"handles on every wire would be a hundred new hit targets competing with the node cards on a dense
   graph."* That argument applies with more force here, because there can be many per wire.
5. **Hit-testing follows the real path.** `isPointInStroke` tests the path last stroked, so a
   multi-segment wire must stroke its full path for the hit test. Verify rather than assume.
6. **An escape hatch.** *Reset routing* on the wire's context menu. A builder who has bent a wire into
   an unusable shape needs one click back, and a graph inheriting anchors from someone else's screen
   size needs it more.

## What else acquires a new field

Enumerate and check every one of these — this is the part that makes the task large, and none of it is
visible from the canvas:

- project format (v2) reader and writer, and the legacy importer
- the diff/annotation path (`model.annotation` — `Created`/`Changed`/`Deleted` on a wire that also has
  anchors)
- undo/redo
- the AI write path and MCP `addConnection` — ⚠️ which already **accepts wires to ports that don't
  exist**, so it is not a strict validator and will not reject a malformed anchor list either
- copy/paste and component duplication

## Acceptance

- [ ] ⚠️ §0 answered: the same user has seen SIG-001…006 and still wants this. Recorded before build.
- [ ] An anchor is created by dragging a wire body, moved, and deleted by right-click.
- [ ] Dragging **near an endpoint** still re-targets the wire, and the boundary between the two
      gestures is discoverable rather than a surprise.
- [ ] Moving either endpoint node leaves the routing sane — no loops, no wire crossing itself. Driven
      by dragging a node the full width of the canvas with three anchors set.
- [ ] Anchors survive save → close → reopen, **and** export → import. Both, separately.
- [ ] Undo restores the previous routing, including deletion of an anchor.
- [ ] A wire with anchors still hit-tests along its whole visible path.
- [ ] *Reset routing* returns the wire to its computed curve.
- [ ] Anchor handles do not paint on unhovered wires. Counted on a graph with 50+ connections.

## Register

| # | Finding | State |
|---|---|---|
| **R1** | ⚠️ **"Click near one end and drag" is already an interaction.** `endpointAt` grabs at 8px for CAN-003 endpoint re-targeting, and the feature as described begins with the same gesture. This is a design conflict, not an implementation detail, and it is unresolved. | **open — §3** |
