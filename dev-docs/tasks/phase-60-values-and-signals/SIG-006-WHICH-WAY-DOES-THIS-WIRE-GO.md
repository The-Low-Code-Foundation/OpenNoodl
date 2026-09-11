# SIG-006 — Which way does this wire go

**Status:** ✅ **CLOSED 2026-08-11 — all 7 acceptance criteria met** · **Track SIG**

**What shipped:** circle at the source and arrowhead at the target on every committed wire; the
node-side glyphs rebuilt so they differ by something that survives greyscale and zoom; `'both'` given
a diamond of its own; hover runs SIG-005's travelling mark source → target; `portIcons.ts` deleted.
The geometry is in [`wireEndpoints.ts`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/wireEndpoints.ts),
import-free and graded by 21 specs in `tests-unit/sig-006/`.

✅ **Criterion 1 is met, and the cue is on by default** — see the Register, **R7** and **R9**. An endpoint glyph is at
the endpoint, so a wire whose *ends are both off screen* needed a cue along its **length**. That was
refused in the first build as an unpriced density decision; it has since been priced, in the running
editor on real curve geometry, and built: a chevron repeated every 500 screen px, off by default and
on by default and switched off by **Always show wire direction**. The straight-line model that
justified the original refusal overstated the cost by ~3.5×; the live numbers are in R7. 🔴 **It
shipped off by default on a redundancy argument and Richard reversed that on sight** — the
measurement answered how much it cost, not whether it was what the canvas should look like (R9).

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

- [x] A committed wire shows its direction **without hovering, without selecting, and without either
      node being visible** — on a wire whose ends are both off screen. Met by the along-the-wire
      chevrons, **on by default** and switchable off by *Always show wire direction*. Only wires
      long enough to be hard to take in at a glance carry them — see **R7** for the measurement and
      **R9** for why the default was flipped after Richard saw it.
- [x] Source and target glyphs are distinguishable in a **greyscale** screenshot at **50% zoom**.
      Both are stated as measurements, not impressions. **See "What was measured" below.**
- [x] The in-flight drag line and the committed wire use the same vocabulary — circle at the source,
      arrowhead at the target, the arrowhead's tip *on* the endpoint.
- [x] Hovering a long wire runs a mark from source to target, using SIG-005's implementation.
      Exactly one travelling-mark implementation exists in the painter — `wireEndpoints.loopedAge` is
      an age transform feeding SIG-005's `travellingHeadRange`, not a second one.
- [x] `endpointHitRadius` behaviour is unchanged; CAN-003 endpoint dragging still grabs at 8px. The
      constant is untouched and the arrowhead is paint, never a target.
- [x] A `'both'` port paints something chosen on purpose, named in the register — **a diamond**, R2.
- [x] `portIcons.ts` is **deleted**. R1.

## What was measured

Driven on `lib21-qa` `/Table/Row`, five wires, 2026-08-11. Composited canvas pixels, selection and
highlight cleared first. Each endpoint's silhouette is taken as a **width profile across the wire** —
at the endpoint, and 3 and 7 graph px back along it — masked to the wire's own colour so the node card
underneath is excluded. **Both ends are the same colour**, so what is compared is only shape, which is
the point: a greyscale reader cannot use colour to tell a source from a target, and neither does this.

| zoom | glyph | width **at** the endpoint | 3 back | 7 back |
|---|---|---:|---:|---:|
| 100% | source circle | **5.5 px** | 1.5–2.5 | 1.5–2 |
| 100% | target arrowhead | **0 px** | 3.5 | 7.5–9.5 |
| 50% | source circle | **5.5–6 px** (screen) | — | — |
| 50% | target arrowhead | **0–0.5 px** (screen) | — | — |

The profiles are *opposite by construction*: a circle is widest exactly where the wire ends, an
arrowhead is a point there and widens behind it. That is a distinction no amount of zooming or
desaturating can collapse, and it is why the shapes were chosen this way rather than by making one
glyph bigger.

⚠️ **The screen-px row at 50% is the whole of item 2's difficulty.** Everything painted after
`CanvasRenderer` scales the context is in *graph* units, so the old 7px disc and 8px triangle were 3.5
and 4 screen px at half zoom — half a pixel apart. `glyphScaleFor` divides by the zoom down to a floor
of 0.5, which is why the two rows above read the same. **No choice of shape could have passed this
criterion while the glyphs scaled with the content.**

**The hover mark**, same session, sampled by walking `pointOnCurve` and looking for the mark's colour:

| age since the pointer entered | the bead spans, in bezier `t` |
|---|---|
| 0 ms | nothing — zero length, at the source |
| 150 ms | **0.12 → 0.36** |
| 380 ms | **0.68 → 0.92** |

Monotonic, source → target, and measured on a **value** wire — which is R4's decision working.

## Register

| # | Finding | State |
|---|---|---|
| **R2** | 🔴 **⚠️ Read SIG-005's R8 before measuring anything about wire colour.** The component a project *opens on* builds its connections before the node library can answer them, so `fromPort` is `undefined` on every one of them, `nameForPortType` returns undefined, and **a signal wire is painted in the data colour** until you navigate to another component and back. This task is about telling wires apart; a measurement taken on the first graph after an open is measuring the wrong colour. Reproduced deterministically on `lib21-qa`, 2026-08-11. ✅ **Fixed the same day as [ELO-001](../editor-load-ordering/ELO-001-A-PORT-LIST-CACHED-BEFORE-THE-LIBRARY.md)** — the cause was not load ordering but a port list memoised from an `UnknownNodeType`, and a cold open now paints 751 signal-cyan px and 0 data-green px where it painted 0 and 767. **Wire colour on a first-opened graph can now be measured.** | ✅ **closed — measure freely** |
| **R1** | ℹ️ **`portIcons.ts` is dead on disk** — `PORT_ICONS` (a `⚡` for signal, `T` for string, and eight more) plus `drawPortIcon`, imported by nothing in the editor source. Verified by grep, 2026-08-09. ✅ **Deleted 2026-08-11.** The standing constraint said "use it or delete it", and using it would have been wrong: it is a table of **port *type*** icons, and this task's glyphs say **direction**. Importing it to satisfy the letter of the acceptance would have started the third vocabulary the constraint exists to prevent. | ✅ **closed — deleted** |
| **R2** | 🔴 **`'both'` was not a variant of "arrives here", and painting it as one made the arrow a liar.** The branch read `leftIcon === 'to' \|\| leftIcon === 'both'`, so an arrowhead did *not* mean "input" — and it was wrong on exactly the ports where direction is hardest to read, the ones that are a source and a target at once. **Decided: a diamond.** Axis-aligned rather than oriented along a wire, because a both-ways port has no one direction to align to, which is the thing it is saying. The mapping now lives in one function (`glyphForPlugIcon`) that both painters call, so it cannot be re-derived wrongly a second time. ⚠️ **Graded by spec, not yet seen on a screen:** a sweep of every component in `lib21-qa` found **zero** `'both'` plugs — it needs a port that is the source of one wire *and* the target of another *on the same side of the same node*, which is rare. Whoever next builds one should look. | ✅ **decided — diamond unobserved live** |
| **R3** | 🔴 **Criterion 1 is unreachable with endpoint glyphs, and this task did not fake it.** "Direction without hovering, without selecting, and without either node visible" asks for a cue in the *middle* of a wire; an endpoint glyph is, by definition, at the end. Hover answers that case and is criterion 4. Painting an always-on mid-wire chevron would satisfy the letter, and it is a **density decision, not a detail**. **Left unbuilt and stated, rather than guessed at.** ✅ **Decided and built 2026-08-11 — see R7.** | ✅ **closed by R7** |
| **R7** | ✅ **R3's density decision, measured: the cue ships, off by default, behind `ALWAYS_SHOW_WIRE_DIRECTION`.** A chevron repeated every **500 screen px** along the wire, arc-length spaced, open and stroked against the endpoint arrowhead's closed fill — `DIRECTION_CHEVRON` in `wireEndpoints.ts`, 10 specs. 🔴 **Both halves of R3's argument were overestimates, in opposite directions, and a straight-line model is why.** Modelling wires as chords between node *origins* put the cost at 38 marks a viewport and the need at 40 wires in 54; measured in the running editor on real `pointOnCurve` geometry across the five densest components of a real 9,245-wire project, it is **~10 marks** and **~2 wires in 25** at 1400×900. ⚠️ **Node positions are not wire geometry** — the curve leaves and arrives horizontally through a mid-x, so both its length and its intersection with a viewport differ from the chord. 🔴 **A single midpoint mark answers under half the wires that need one**, because a long wire's middle is usually off screen too — it would have satisfied the criterion's letter and been a plausible lie. A cue readable from *any* slice must repeat, and repeating is the cost; they are the same requirement. **So the reason it stays off is not density — that turned out affordable — it is redundancy:** an end is visible on ~92% of the wires on screen, and hover answers the rest with a mark that travels. Same call CAN-001 made for labels, in the same painter. ⚠️ Marks **thin out** as you zoom away (22 → 15 → 6 chevrons at 100/50/25%) because a wire must be one spacing long to carry any — which is the right way round, since zooming out brings the ends on screen. | ✅ **decided and built** |
| **R8** | ✅ **The mark now arrives instead of stopping, and looks like a charge rather than a bar.** Richard on the shipped hover mark: *"it stopping abruptly is a bit weird, and the triangle at the end not lighting up white is inconsistent… I'd have expected something a bit more 'electric', rounded and faded, not a white rectangle."* 🔴 **All three are one omission: the mark modelled the *crossing* and nothing about landing.** `travellingHeadRange` clamps the head at `t = 1` and holds the tail `headSpan` behind it, so a full-length bar **parked** on the end of the wire for the rest of its life and then blinked out. Three changes, all in `wirePulse.ts` so the runtime pulse and the hover mark keep one implementation: **`beadRange`** runs the tail in after the head lands (170 ms) so the mark is consumed by the target; **`arrivalGlow`** lights the target arrowhead as it lands and decays it over 240 ms; **`beadTaper`** + a dim wide halo under a bright narrow core makes it fade and taper from tail to head. ⚠️ **One stroke can only be one width and one alpha** — that is *why* it was a uniform bar, and why the mark is now drawn in 14 segments. `shadowBlur` is the other way to get a glow and costs far more on a graph pulsing dozens of wires. Measured live at 100% zoom, peak luminance in a 3×3 on composited pixels: bead **222 → 229** at 120 ms and **220 → 241** at 380 ms (brighter toward the head, i.e. the fade works); target glyph **202 → 231** at landing, back to **202** by 700 ms; nothing on the wire after 560 ms. 12 specs. | ✅ **fixed** |
| **R9** | ✅ **The chevrons are ON by default — R7's measurement stood, the default it implied did not.** R7 shipped them off, reasoning from redundancy: an end is visible on ~92% of the wires on screen. Shown the result, Richard's judgement was the opposite — *"I like the chevron, especially that it only comes on after a certain distance. I think it should be on by default, with the option to turn it off"* — and *"it's like a wire diagram, which is a bit the inspiration for Noodl"*. 🔴 **The measurement answered "how much does this cost", which is not the same question as "is this what the canvas should look like".** The length threshold that R7 built for density reasons turns out to be the thing that makes it wanted always: short hops stay clean, and only wires you cannot take in at a glance get marked. ⚠️ The stored value is now only ever `false`, so `paintsDirectionChevrons()` reads `!== false` — an unset key means **on**. | ✅ **decided — default flipped** |
| **R4** | ⚠️ **The hover mark runs on a value wire too, and that is a decision rather than an inheritance.** SIG-005 gave a signal one travelling bead and a value a repeating dash *on purpose* — at runtime the mark says *what happened*, and a value connection is live everywhere at once with no one place for a moment to be. **Hover asks a different question.** "Which way" has the same answer shape for both kinds, so both get the bead. The two never collide: the hover branch is `else` to the pulse, so a wire genuinely carrying something keeps saying so. | ✅ **decided** |
| **R5** | 🔴 **`isHighlighted()` is not "the wire under the cursor".** It is also true when either endpoint's **node** is hovered or selected — so driving the hover mark off it would animate every wire touching a selected node, a dozen at once on a busy one. The mark reads `owner.highlightedConnection === this` instead. The question "which way does *this* wire go" is asked of one wire. | ✅ **fixed** |
| **R6** | 🔴 **`isPlayingNodeAnimations` was a bare boolean with one caller, and a second animated thing breaks it in both directions.** The AI assistant's spinning icons owned it; a pointer leaving a wire would have called `stopNodeAnimations()` and frozen those icons mid-spin, and the assistant finishing would have frozen the hover mark under the cursor. `CanvasPainter` now counts *reasons* (`'nodes'`, `'hover-direction'`) and runs while any are held. **Anything else in this codebase that animates the canvas must take a reason, not the boolean.** | ✅ **fixed** |
