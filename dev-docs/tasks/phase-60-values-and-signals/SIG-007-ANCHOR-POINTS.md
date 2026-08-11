# SIG-007 — Anchor points

**Status:** 📋 open, **§0 answered — build it** · **Track SIG** · ⚠️ **the largest task in the phase**

> *"In another app he showed in his demo, you could click drag a connector line and create an 'anchor
> point' that would adjust the trajectory of the connector line — so like clicking near one end and
> dragging to make it curve more sharply before moving off to its destination, adding as many anchor
> points (and deleting with right click I guess) as you like."*

## ✅ §0 is answered — 2026-08-11

**Richard, shown SIG-001…006 running:** *"Couple of observations before we move on to 007 (and yes I do
want the anchor points)."*

So the gate below is cleared and the acceptance's first box is ticked. ⚠️ **It is still worth reading
§0** — not to reopen the decision, but because it names what this task costs and what it touches, and
none of that changed by being approved.

Two things he said in the same breath are **design input for this task**, not just for SIG-006:

- *"I like the chevron, especially that it only comes on after a certain distance."* — the principle
  that earned it: **a cue that only appears where it is needed**. Anchor handles are the same problem
  with more force (there can be many per wire), and §4 below already says handles appear on
  hover/selection only. Treat that as confirmed by the user, not just inherited.
- *"I think the chevron looks good compared to the solid triangle anchor point, it's like a wire
  diagram, which is a bit the inspiration for Noodl."* — ⚠️ **an anchor handle is another solid mark
  on a wire that now also carries chevrons**, and "wire diagram" is the aesthetic to hold to. Whatever
  an anchor handle looks like has to be told apart from the endpoint circle, the endpoint arrowhead,
  the `'both'` diamond and the direction chevron — five marks on one wire. `wireEndpoints.ts` owns
  that vocabulary and its header carries the fill-ratio reasoning; a sixth mark goes through it.

## §0 — the argument that gate existed for

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

## §G — the geometry, decided (2026-08-11, before any code)

Build item 1 says write it down first. This is that. Six decisions, and the two the task called
load-bearing are **D2** and **D4**.

### D1 — the curve: chained cubics with derived tangents, and **zero anchors is not a special case of
anything**

An anchored wire is `n + 1` cubic segments through `P0, A₁ … Aₙ, P3`. The **end** tangents stay
exactly what they are today — horizontal, out of the source port and into the target port — which is
the idiom that makes this a wire diagram rather than a hairball, and which `arrivalDirection` already
reads at `t = 1`. **Interior** tangents are Catmull-Rom from each anchor's neighbours, so the wire
flows *through* an anchor along its direction of travel instead of stopping to be horizontal at it.
That is the difference between "adjust the trajectory" and "add a staircase".

🔴 **With zero anchors the painter returns today's four-point array from today's code, untouched** —
not a spline that happens to agree with it. The requirement is that every existing graph opens
byte-identically, and an argument that two constructions coincide is a weaker thing to rely on than
not running the new construction at all. Catmull-Rom through no interior points *would* reproduce the
cubic; it is still not what runs.

Rejected: **polyline with rounded corners** (a hard break from every existing wire, and the corner
radius becomes a second geometry decision), and **Catmull-Rom through the endpoints too** (it throws
away the horizontal leave/arrive, so wires stop meeting their ports square on).

### D2 — storage: the **chord frame**, `u` along it and `v` across it in graph px

⚠️ This is the decision the task warned about, and neither pure answer is right.

An anchor is `{ u, v }`, read against the frame the wire's own endpoints define:

```
d = P3 − P0 · L = |d| · t̂ = d/L · n̂ = (t̂.y, −t̂.x)      (the same normal convention as wireEndpoints)
position = P0 + u·d + v·n̂
```

- **`u` is dimensionless.** Move a node and the routing stretches with the wire, keeping its
  proportions. This is what stops the loop the task predicted for absolute coordinates.
- **`v` is graph px.** Normalising it too would make the frame a similarity transform — shape
  preserved *exactly*, which sounds better and is worse: drag a node ten times further away and the
  40px nudge you drew becomes a 400px detour. A detour is a fixed-size thing you drew, so it stays
  the size you drew it.

That mix has one failure mode, and it is the opposite one: as `L` **shrinks**, a fixed `v` becomes
huge relative to the wire and spikes. So `v` is clamped to `L × maxOffsetRatio` at paint time. At real
lengths (the measured median wire is 3,451 graph px, offsets are tens) the clamp never binds; it
exists for the case where someone drags two nodes on top of each other.

**And `u` is clamped between its neighbours**, epsilon apart, and inside `(0, 1)` at the ends. That —
not the tangent scheme — is what actually delivers *"no wire crossing itself"*: anchors cannot swap
order, so the sequence stays monotonic along the chord however the nodes are dragged.

### D3 — the field: `anchors?: { u, v }[]`, **absent when empty**

Never `[]`. Same rule as `label`: a wire that was bent and then reset has to be indistinguishable from
one that never was, or every wire anyone ever touched churns `project.json`. `updateConnection` already
deletes a key set to `undefined`, so the model verb needs nothing new. ⚠️ And `[]` is truthy — the
mistake ELO-001 was, one file over.

### D4 — R1, resolved: the boundary is **where the ghost appears**

`endpointHitRadius` (8) is **unchanged**, and a grab inside it still re-targets. CAN-003's gesture is
older, is reachable from muscle memory, and does not get quietly narrowed by a feature that arrived
later.

What changes is that the boundary stops being invisible. Hovering a wire paints a **ghost anchor** —
the handle glyph at reduced alpha — at the closest point on the curve to the pointer, tracking it. It
is the preview of what a drag would mint, and 🔴 **it is not drawn inside the endpoint zones**. So the
two gestures are told apart by watching: run the pointer down the wire and the ghost rides along, then
vanishes as the endpoint handle grows under it. The absence *is* the boundary, and it is animated,
which is the only kind of boundary anyone reads.

This is also the honest answer to *"paint is not a target"*: the task is right that SIG-007 is where
that gets contested, and the resolution is not to paint an 8px ring on every hovered wire — it is to
paint the thing the pointer would actually get.

### D5 — the sixth mark: a **hollow ring**

`wireEndpoints.ts` separates its glyphs on **fill ratio**, so the sixth mark joins that table rather
than starting a second scheme:

| glyph | fill of bbox | where |
|---|---:|---|
| circle | 0.79 | wire end, source |
| arrowhead | 0.50 | wire end, target |
| diamond | 0.50 | node plug, `'both'` |
| chevron | — *open stroke*, V | along the wire |
| **anchor ring** | **0.00** — *open stroke*, closed and radially symmetric | **along the wire** |

A ring is as far from every filled glyph as the axis goes, and it separates from the chevron — the
only other open mark, and the only other one that lives mid-wire — by being closed and having no
direction. ⚠️ A filled square was the other candidate and is rejected: at any rotation it is the
diamond.

Rings paint on **hover or selection only**, which is the argument the endpoint dots were already kept
small for, and which Richard confirmed unprompted about the chevron: *a cue only appears where it is
needed*. There can be many per wire, so it applies with more force here.

### D6 — what is *not* decided here

Anchors are per-connection and screen-size-independent by construction (D2), so **there is no
migration and no version bump** — an old `connections.json` has no `anchors` key and reads as a wire
with none.

## Build

1. **Decide the geometry, and write it down first.** ✅ **Done — §G above.** A list of anchor points turns one cubic bézier
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
visible from the canvas.

✅ **Enumerated 2026-08-11 by tracing `labelT`, which is the exact precedent**: the last per-connection
field anyone added (CAN-001), so every seam that had to learn about it is every seam that has to learn
about `anchors`. Ten call sites, all read in source:

| Seam | File | What it does with `labelT` |
|---|---|---|
| the model | `NodeGraphModel.ts:14` | the `Connection` type; `updateConnection` is the verb |
| v2 **writer** | `ProjectExporter.ts:48,351` | `LegacyConnection` type + the `ConnectionV2` map |
| v2 **reader** | `ProjectImporter.ts:194-208` | the other half of the same carry |
| the storage schema | `schemas/connections.schema.json` | a declared property |
| the schema type | `schemas/index.ts:180` | `ConnectionV2` |
| snapshot | `versioning/GraphSnapshot.ts:48,111,282` | `CONNECTION_KNOWN_KEYS`, read **and** write |
| diff | `versioning/GraphDiff.ts:359` | deliberately *not* compared — moving a label is not a change |
| merge | `versioning/GraphMerge.ts:714` | a per-field three-way rule |
| versioning type | `versioning/types.ts:43` | |
| interaction + undo | `canvas/InteractionController.ts:418` | `updateConnection(..., { undo: true })` |

⚠️ **Two of the listed seams do not carry `labelT` today, and both are defects this task inherits
rather than causes.** Found by the same trace, filed as **R2** and **R3** below:

- **copy/paste and component duplication** — `NodeGraphNodeSet.clone()` rebuilds each connection from
  **four fields** ([`:46-55`](../../../packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphNodeSet.ts#L46-L55)),
  so duplicating a component already loses every wire label. Anchors would be lost the same way, in
  the same four lines.
- **the AI write path** — `AUTHORED_CONNECTION_FIELDS` is exactly those four fields
  ([`authoringVocabulary.ts:212-227`](../../../packages/noodl-editor/src/editor/src/validation/authoringVocabulary.ts#L212-L227)),
  `connectionSchema` is a plain `z.object` over them (zod's default is **strip**, not reject), and
  MCP's `add_connection` re-emits four fields explicitly
  ([`graph.ts:281`](../../../packages/noodl-mcp/src/graph.ts#L281)). ⚠️ `vocabulary.ts:22-28`
  states the four-field rule as a *decision* — "a connection has exactly four fields and an unknown
  fifth is a mistake worth reporting" — so this is a stale premise to correct, not an oversight to
  patch quietly. And strip-not-reject means it does not report anything.

🔴 **That second one is the `update_node.set.children` shape from P58**, one object over: a field the
schema does not name is dropped by zod between a valid request and the disk, and every instrument says
clean. It is the reason this task's acceptance asks for export → import **separately** from save →
reopen.

## Acceptance

- [x] ⚠️ §0 answered: the same user has seen SIG-001…006 and still wants this. **Recorded above,
      2026-08-11, before any build.**
- [x] An anchor is created by dragging a wire body, moved, and deleted by right-click. **Driven
      through the interaction controller in the running editor**: a press leaves the model untouched,
      a 1px move still leaves it untouched, a real drag mints, and the anchor lands **0.0 px** from
      the pointer. Delete and *Reset routing* are graded through `updateConnection` below.
- [x] Dragging **near an endpoint** still re-targets the wire, and the boundary between the two
      gestures is discoverable rather than a surprise. `endpointHitRadius` is untouched and tested
      first; the ghost ring is what makes the boundary visible. Traced at paint time by intercepting
      `ctx.stroke`: **mid-wire 6 strokes, two of them the ghost at α 0.45; inside the endpoint zone 4
      strokes and no ghost.**
- [x] Moving either endpoint node leaves the routing sane — no loops, no wire crossing itself. Driven
      by dragging a node the full width of the canvas with three anchors set. **21,300 sweeps**; see
      `wireAnchors.ts` for the 8 that cross and why they are all overlapping node cards.
- [x] Anchors survive save → close → reopen, **and** export → import. Both, separately. Save →
      reopen driven in the editor against a real project on disk; the v2 `buildComponentV2Files` →
      `reconstructLegacyComponent` round trip run separately, with an unbent wire confirmed to carry
      **no `anchors` key** either way.
- [x] Undo restores the previous routing, including deletion of an anchor. Bend/undo/redo,
      delete/undo, reset/undo — all driven live; reset leaves the key **absent**, not `[]`.
- [x] A wire with anchors still hit-tests along its whole visible path. **10/10 probes** on a
      3-segment bent wire, and a probe 200px off it misses.
- [x] *Reset routing* returns the wire to its computed curve. And a zero-anchor wire is today's array
      **by identity**, verified live on every connection in the graph.
- [x] Anchor handles do not paint on unhovered wires. **0 changed pixels** with all 10 wires bent and
      nothing hovered, against a 0-pixel control — and 955 px the moment one is hovered. ⚠️ Counted on
      10 connections, not the 50+ the criterion asks for; the claim is exact-zero rather than
      statistical, so the count does not weaken it, but it has not been run on a dense graph.

## Register

| # | Finding | State |
|---|---|---|
| **R1** | ⚠️ **"Click near one end and drag" is already an interaction.** `endpointAt` grabs at 8px for CAN-003 endpoint re-targeting, and the feature as described begins with the same gesture. This is a design conflict, not an implementation detail. | ✅ **resolved — §G D4.** The 8px zone is untouched; the boundary is made visible by a **ghost anchor** that tracks the pointer along the wire and is not drawn inside it |
| **R2** | 🔴 **Copy/paste already loses wire labels.** `NodeGraphNodeSet.clone()` rebuilds every connection from four fields, so duplicating a component drops `label` and `labelT` — a live CAN-001/CAN-002 defect, found by tracing the precedent rather than by anyone hitting it. Anchors would go the same way. | **open — fix with this task** |
| **R6** | 🔴 **The point-anchor model was replaced wholesale, and the reason was a gesture.** Richard, on square routing: *"my instinct would be that grabbing a vertical line and dragging it left or right would just move it left or right, not create an anchor"*. A run's position has to be a **stored number** for that to be possible, so a square wire stores its **runs** (`{xs, ys}`) rather than points. ⚠️ **§G D1/D2/D5 above describe the deleted model** — read them as history. Curved wires are now unbendable: a curve is a *look*, square is the mode you route in. | ✅ **built** — `wireRouting.ts`, 25 specs |
| **R7** | 🔴 **A control nobody can see is not a control.** Shipped R6, the first thing reported was *"there's no way to add an anchor that I can see"* — and it was not broken: *Add anchor here* was on the right-click menu and worked. Adding now has a painted `+` at each run's midpoint that splits and hands over the drag, and a run says it is draggable with the cursor. | ✅ **built** |
| **R8** | ⚠️ **A port run can be split even though it cannot be moved.** Richard: *"I'm not 100% convinced by the system of not being able to break a line in the middle of a starting or finishing line towards the node, that should be possible too."* The constraint is that the piece still *touching* the port keeps the port's row — not that the whole stub is untouchable. | **open** |
| **R9** | ⚠️ **Chevrons go wrong at a corner.** Richard: *"they should probably just jump to the next line segment rather than smoothly bending round the corner and looking weirdly offset."* One cause, two faults: `chevronPlacements` samples 48 points across the **whole** wire, so a sample pair straddling a corner points the mark diagonally, and the painted path's fillet is not where the sharp sampled path is. Place them **per run** instead. | **open** |
| **R4** | 🔴 **The clamp that looked obviously right put the anchor where the user did not click.** `u` was bounded to `(0, 1)` because an anchor "belongs between the endpoints" — but `u` runs along the **chord**, and the `'inline'` and `'right'` layouts route the wire out to a mid-x *left of both nodes*. A press on the middle of such a wire projects to `u = 1.96` and was thrown to `0.99`, the far end. ⚠️ **The round-trip spec that should have caught it passed** — `anchorFromPoint` → `anchorPoint` is exact, and it was `normaliseAnchors` in between that moved the point. Only driving the real gesture found it. | ✅ **fixed** — `minU`/`maxU` are -1/2; ordering, not the endpoint clamp, is what prevents a crossing. 0.0 px error, measured |
| **R5** | ⚠️ **A live re-test can fail because HMR left the mounted editor on the old module.** After fixing R4 the editor still reported the old `0.99`, while a freshly `require`d copy of the same module reported the new bounds and the correct `1.96`. Restarting the dev stack was the difference between "the fix does not work" and "the fix works". | **noted — restart before disbelieving a fix** |
| **R3** | 🔴 **The AI write path drops per-connection fields silently.** `AUTHORED_CONNECTION_FIELDS` declares four; `connectionSchema` is a plain `z.object`, and zod's default is **strip**. So an agent doing read-modify-write on a component returns it with every wire label gone, and nothing errors. ⚠️ The four-field rule is written down as a decision in `vocabulary.ts`, so correcting it means correcting that text too. **Same shape as P58's `update_node.set.children`.** | **open — fix with this task** |
