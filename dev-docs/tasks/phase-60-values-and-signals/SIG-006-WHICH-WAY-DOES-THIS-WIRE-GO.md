# SIG-006 — Which way does this wire go

**Status:** 📋 open · **Track SIG**

> *"The connector ends are hard to see, the circle and arrow ends, and it's true they're a bit small
> and hard to tell apart to know which direction the connector is going. We could also benefit from a
> hover animation when hovering a long connector to see which direction it's going."*

## ⚠️ Two premise corrections

### 1. The circle and the arrow are not on the wire

They are on the **node**, and they are a direction cue that is already correct
([`NodeGraphEditorNodePainter.ts:394-413`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNodePainter.ts#L394-L413)):

```ts
function arrow(side, color) {            function dot(side, color) {
  const dx = side === 'left' ? 4 : -4;     const radius = 3.5;  // mock: flat 7px port dots
  …moveTo(cx - dx, ty - 4)                 …arc(cx, ty, radius, 0, 2 * Math.PI)
     .lineTo(cx + dx, ty)
     .lineTo(cx - dx, ty + 4)
```

Selected at [`:471-475`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNodePainter.ts#L471) and
[`:498-502`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNodePainter.ts#L498):
`'from'` → **dot**, `'to'` or `'both'` → **arrow**.

**Dot = it leaves here. Arrow = it arrives here.** That is exactly the information he wanted, and it is
already painted. It fails because a **7px disc and an 8px triangle in the same colour** differ by one
pixel of extent — indistinguishable at 100% zoom, invisible as a distinction below it.

⚠️ `'both'` also paints an arrow, so *arrow* does not strictly mean *input*. Any redesign has to decide
what a both-ways port looks like rather than inheriting this by accident.

### 2. On the wire itself there is no direction cue at all

[`NodeGraphEditorConnection.ts:636-645`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L636-L645)
paints **both** ends as the same circle — radius 3, growing to 4 on hover — with the comment *"mock:
3px wire-coloured dots at both ends"*. There is no arrowhead anywhere on a finished connection;
`grep -i arrow` over the connection painter returns nothing.

### 3. The one wire that shows its direction is the one that doesn't exist yet

[`CanvasRenderer.ts:231-240`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/canvas/CanvasRenderer.ts#L231-L240) —
the **drag** line — draws a circle at the source and a real arrowhead at the target:

```ts
// Draw the circle at the source node and the arrow head at the target node
ctx.arc(from.x, from.y, 4, 0, 2 * Math.PI, false);
ctx.moveTo(to.x + d.x * 2, to.y + d.y * 2);
ctx.lineTo(to.x - d.x * 6 - n.x * 4, to.y - d.y * 6 - n.y * 4);
ctx.lineTo(to.x - d.x * 6 + n.x * 4, to.y - d.y * 6 + n.y * 4);
```

**The moment you drop the wire, that arrowhead is replaced by a second identical circle.** The editor
already knows how to draw the thing this task is asking for, in the same canvas, one interaction
earlier, and it throws it away on commit. Start here — the geometry is written.

## Build

1. **The wire's own ends carry the direction.** Adopt the drag line's vocabulary on committed wires:
   circle at the source, arrowhead at the target. This is the smallest change with the largest effect,
   and it makes the in-flight wire and the finished wire agree — which they currently do not.
2. **Make the node-side glyphs actually distinguishable**, since they carry the same fact at the point
   where wires converge. 7px vs 8px is not a distinction. Options: size separation, a filled/hollow
   contrast, or a shape pair with different silhouettes. ⚠️ Whatever is chosen must survive **zoom-out**
   and greyscale — the endpoint density on a real graph is the test, not a two-node example.
3. **Decide what `'both'` paints**, explicitly, rather than inheriting the arrow.
4. **Hover runs a mark along the wire, source → target.** The direction answer for a long connector
   that crosses the viewport, where both ends are off screen and the glyphs are unreachable.
   ✅ **SIG-005 built it — [`wirePulse.ts`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/wirePulse.ts), closed 2026-08-11. Call it; do not write a second one.**
   `travellingHeadRange(ageMs)` gives the head's `[from, to]` in bezier `t` and `samplePolyline` turns
   that into points off *any* point function — it takes the function as an argument precisely so a
   hover can drive it. All this task supplies is the age: for the runtime pulse that is
   `performance.now() - created`; for hover it is time since the pointer entered.
   ⚠️ **The mark travels source → target because `curve[0]` is the source**, which is the same array
   the endpoint dots are painted from — so item 1's arrowhead and this mark cannot disagree about
   which end is which. Hover already recolours the wire (`hoverConnection` at
   [`:604-605`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L604)) and already
   grows the endpoints, so the trigger exists; only the call is new.
   ⚠️ **Decide what a hovered *value* wire does.** SIG-005 gave a signal one travelling bead and a
   value a repeating dash, on purpose — a signal is a moment and a value is live along the whole
   wire. A hover asks a different question ("which way?"), so it may want the bead on both kinds; if
   it does, that is a third state on one painter and it needs saying out loud rather than inheriting.
5. **Do not spend colour.** Wire colour carries type, health, pulse and diff annotation, and
   [`:625-627`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L625) already refused to
   make selection a fifth meaning, using stroke weight instead. Direction goes in **shape and motion**.
6. ⚠️ **Read `portIcons.ts` first.** A complete `PORT_ICONS` table and a `drawPortIcon` helper exist and
   **nothing imports them** — verified by grep. Use it or delete it. Do not let a third glyph vocabulary
   start beside the painter's `dot`/`arrow` and this table.

## What must not regress

- **Hit targets.** `endpointHitRadius` is **8** against a painted radius of 3
  ([`:46-50`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L46-L50)) — deliberately
  larger than it paints, for CAN-003's endpoint dragging. Changing the paint must not silently change
  the grab.
- **Density.** The existing comment at `:632-636` explains why endpoints stay dots unless highlighted:
  *"handles on every wire would be a hundred new hit targets competing with the node cards on a dense
  graph."* An arrowhead is paint, not a target — keep it that way.
- **Annotation wires.** Diff annotations already use dash and weight
  ([`:614-623`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L614-L623)). A new
  shape must not collide with `Deleted`'s dash or `Created`'s 3px stroke.

## Acceptance

- [ ] A committed wire shows its direction **without hovering, without selecting, and without either
      node being visible** — captured on a wire whose ends are both off screen.
- [ ] Source and target glyphs are distinguishable in a **greyscale** screenshot at **50% zoom**.
      Both are stated as measurements, not impressions.
- [ ] The in-flight drag line and the committed wire use the same vocabulary.
- [ ] Hovering a long wire runs a mark from source to target, using SIG-005's implementation.
      Exactly one travelling-mark implementation exists in the painter.
- [ ] `endpointHitRadius` behaviour is unchanged; CAN-003 endpoint dragging still grabs at 8px.
- [ ] A `'both'` port paints something chosen on purpose, named in the register.
- [ ] `portIcons.ts` is either imported or deleted at the end of this task.

## Register

| # | Finding | State |
|---|---|---|
| **R2** | 🔴 **⚠️ Read SIG-005's R8 before measuring anything about wire colour.** The component a project *opens on* builds its connections before the node library can answer them, so `fromPort` is `undefined` on every one of them, `nameForPortType` returns undefined, and **a signal wire is painted in the data colour** until you navigate to another component and back. This task is about telling wires apart; a measurement taken on the first graph after an open is measuring the wrong colour. Reproduced deterministically on `lib21-qa`, 2026-08-11. ✅ **Fixed the same day as [ELO-001](../editor-load-ordering/ELO-001-A-PORT-LIST-CACHED-BEFORE-THE-LIBRARY.md)** — the cause was not load ordering but a port list memoised from an `UnknownNodeType`, and a cold open now paints 751 signal-cyan px and 0 data-green px where it painted 0 and 767. **Wire colour on a first-opened graph can now be measured.** | ✅ **closed — measure freely** |
| **R1** | ℹ️ **`portIcons.ts` is dead on disk** — `PORT_ICONS` (a `⚡` for signal, `T` for string, and eight more) plus `drawPortIcon`, imported by nothing in the editor source. Verified by grep, 2026-08-09. | **open** |
