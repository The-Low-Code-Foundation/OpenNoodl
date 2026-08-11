# Phase 60 — the tasks (SIG: values flow, signals fire)

**Created:** 2026-08-09, out of [README.md](README.md) and a new user’s feedback.
**4 of 7 closed 2026-08-11.** SIG-001, 002 and 004 went together because they share one popup, one
`if (d)` guard and one vocabulary (`portCopy.ts`); **SIG-003 closed later the same day**, all three
sections, with §2's vocabulary answered by Richard before the first rename.
**Remaining: 005, 006, 007** — the whole of "what a wire *looks* like". The first half of the phase,
"what a wire *means*", is done.

⚠️ **Driving found six defects that no gate could express**, four of them in the first build of
SIG-001 and two in the specs themselves — including the spec's own worked copy being the one sentence
the phase forbids, and the redirect promising a wire it did not draw. Read SIG-001's Register before
starting 005/006, and read **§"Where the work lands" below, corrected**.

⚠️ **Button cannot host this phase's canonical scenario.** "Drop a String on a Button" appears in the
README, in this file and in SIG-001, and a Button has **no signal inputs at all** — so the refusal the
phase is named for does not occur on it. Use a **Text Input** (`Set`, `Clear`, `Focus`, `Blur`).

**Every claim about existing code in these files was read in source on 2026-08-09.** Claims that could
not be read are marked ⚠️ **unverified** and must be confirmed before the task that depends on them is
worked — this phase already caught **four** wrong premises about our own code in one sitting, including
one where the feature being asked for turned out to be built and enabled by default.

## The one-line premise

A wire has a **kind** and a **direction**, and the editor draws neither legibly. The refusal sentence
that would explain the kind is computed in full and deleted before it renders; the arrowhead that would
show the direction is drawn only while the wire is still being dragged.

| Task | File | One line | State |
|---|---|---|---|
| SIG-001 ⭐ | [SIG-001-THE-REFUSED-PORT-SAYS-WHY.md](SIG-001-THE-REFUSED-PORT-SAYS-WHY.md) | **the flagship** — stop deleting the explanation; show the refused port, greyed, with the reason, and offer the wire they meant | ✅ **closed 08-11** |
| SIG-002 | [SIG-002-THE-VALUE-IS-ALREADY-LIVE.md](SIG-002-THE-VALUE-IS-ALREADY-LIVE.md) | the other edge of the sword — "where is the Set?" answered where it is asked | ✅ **closed 08-11** |
| SIG-003 ⭐ | [SIG-003-GROUPS-THAT-MEAN-SOMETHING.md](SIG-003-GROUPS-THAT-MEAN-SOMETHING.md) | **the second flagship** — one heading vocabulary, ordered by use; the ungrouped-port audit | ✅ **closed 08-11** |
| SIG-004 | [SIG-004-EVERY-SIGNAL-SAYS-WHAT-IT-DOES.md](SIG-004-EVERY-SIGNAL-SAYS-WHAT-IT-DOES.md) | one sentence at the render seam, true of every signal port in the library | ✅ **closed 08-11** |
| SIG-005 | [SIG-005-THE-SIGNAL-TRAVELS.md](SIG-005-THE-SIGNAL-TRAVELS.md) | the travelling pulse — it fired all along and measured **1.48:1** against the wire it was painted on | ✅ **closed 08-11** |
| SIG-006 | [SIG-006-WHICH-WAY-DOES-THIS-WIRE-GO.md](SIG-006-WHICH-WAY-DOES-THIS-WIRE-GO.md) | endpoint glyphs you can tell apart, and a hover that runs the length of a long wire | ✅ **closed 08-11 — 7/7; R3 priced and built** |
| SIG-007 | [SIG-007-ANCHOR-POINTS.md](SIG-007-ANCHOR-POINTS.md) | drag a wire to bend it; anchor points, added and removed | 📋 open |

## Suggested order, and why

1. **SIG-001 first, alone if necessary.** It is the only task addressing the exact moment the user
   described, it is the cheapest thing in the phase (a `continue` that should be a render, and copy),
   and the entire refusal UI it needs is already built and unreachable. Everything else improves a
   surface the builder reaches *after* they have already been confused.
2. **SIG-002 next** — same file, same popup, the opposite half of the same misunderstanding. Doing it
   apart from SIG-001 means writing the value/signal copy twice and risking two vocabularies.
3. **SIG-004 third.** One line in `DocsPopup`, covering the whole library, and it is what makes
   SIG-001's and SIG-002's short copy affordable — the long explanation lives here, once.
4. **SIG-003** — real work (an audit of every port in the library), high payoff, and it is the task
   most likely to reveal further defects. Do it when there is a session to give it, not in the tail of
   another one. ⚠️ Its rename half is a **decision for Richard**, recorded in SIG-003 §2.
5. **SIG-005** before SIG-006, because SIG-006's hover animation and SIG-005's runtime pulse are the
   same travelling mark on the same painter. **SIG-005 owns the mechanism; SIG-006 consumes it.**
   Building them the other way round mints two animation paths on one wire.
6. **SIG-006** — the endpoint glyphs are a contained fix with a known correct answer already in the
   codebase (the drag line's arrowhead).
7. **SIG-007 last.** It is the largest, the only one that changes what a connection *is* on disk, and
   the only one nobody has complained about twice. See its §0 before committing to it.

## The dependency that is not obvious

**SIG-003 changes the strings SIG-001 and SIG-002 quote.** If SIG-001 ships copy that says *"connect it
to **Label**, under **Values**"* and SIG-003 then renames that heading, the copy lies. Either keep
SIG-001's copy free of heading names, or do SIG-003 first. **The former is recommended** — a sentence
that names a port is more useful than one that names a heading.

## Where the work lands

| Area | Files | Tasks |
|---|---|---|
| Connection popup | [`ConnectionPopup/`](../../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/) — `ConnectionBar.tsx`, `PortItem.tsx`, `PortGroup.tsx`, `DocsPopup.tsx`, `ConnectionPopup.module.scss`, and (new, 08-11) `portCopy.ts`, `refusalPlan.ts`, `searchIntent.ts`, `components/RefusedPorts.tsx` | 001, 002, 004 |
| Node library port declarations | [`noodl-viewer-react/src/nodes/`](../../../packages/noodl-viewer-react/src/nodes/), [`noodl-runtime/src/nodes/`](../../../packages/noodl-runtime/src/nodes/) | 003 |
| Canvas painters | [`nodegrapheditor/`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/) — `NodeGraphEditorConnection.ts`, `NodeGraphEditorNodePainter.ts`, `canvas/CanvasRenderer.ts` | 005, 006, 007 |
| Connection model | [`NodeGraphModel.ts`](../../../packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphModel.ts) | 007 only |

## Standing constraints

Repeated from [README.md](README.md) because they are the ones that will be forgotten:

- ⚠️ **`opacity` cannot dim and stay legible.** Light mode is the binding constraint. SIG-001 inherits
  an `opacity: 0.3` on a row it is about to make visible for the first time.
- **Wire colour already carries four meanings.** New information goes in shape, weight or motion.
- **Red is danger only.** A refused connection is not the builder's error.
- ⚠️ **`portIcons.ts` is dead on disk** — a whole glyph table nothing imports. Use it or delete it; do
  not start a third vocabulary beside it. *(Still true after 001/002/004: they added no glyphs, and
  the only icons they render are core-ui `Lightning` and `Caret*`.)*

## What SIG-003 settled, and what it left

- ✅ **The vocabulary is normative and written down**, in
  [`dev-docs/reference/PORT-GROUP-VOCABULARY.md`](../../reference/PORT-GROUP-VOCABULARY.md). `Values`
  (a thing that is) / `Actions` (a signal input you cause) / `Events` (a signal output that happened)
  are **kind** headings and are gated pure. Everything else is a **subject** heading and may hold
  mixed kinds on purpose. Retired: `Value`, `Signals`, `Changed Events`.
- ✅ **`npm run catalog:groups:check`** is the gate, in the `node-catalog` CI job. 167 ungrouped static
  ports → 0; 3,056 connectable ports swept live in the running editor, 0 ungrouped.
- 🔴 **The gate's first version was a check that could never go red** — it read `groupPriority` off the
  catalog, which carries `connectionPanel` on none of its 175 entries. It now reads source, and it was
  verified by *injecting* one violation of each class rather than by reading its own green line.
  **Anything SIG-005/006/007 adds as a gate should be proved red the same way.**
- 📋 **`Other` is now empty in practice but is still rendered as a heading** if a third-party or
  project-local node ships an ungrouped port — the CI gate covers this repo's library, not a user's.
  Worth a thought if a later task revisits the popup chrome.
- ✅ **`portIcons.ts` is gone.** SIG-006 deleted it rather than importing it: it is a **port *type***
  icon table (`⚡`, `T`, `#`), and SIG-006's glyphs say **direction**. Importing it to satisfy the
  letter of "use it or delete it" would have started the third vocabulary the constraint exists to
  prevent.

## What SIG-006 settled, and what it left

- ✅ **The endpoint vocabulary is one module** —
  [`wireEndpoints.ts`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/wireEndpoints.ts),
  import-free like `wirePulse.ts` and `portCopy.ts`, 21 specs in `tests-unit/sig-006/`. **Both the
  wire's own ends and the node-side plugs read it**, so the two statements of one fact cannot drift.
  Circle = it leaves here · arrowhead = it arrives here · **diamond = both**.
- 🔴 **Glyphs on a zooming canvas must be painted at constant *screen* size, or no choice of shape can
  survive a zoom-out acceptance.** Everything after `CanvasRenderer` scales the context is in graph
  units, so the old 7px disc and 8px triangle were 3.5 and 4 screen px at 50% — half a pixel apart.
  `glyphScaleFor` divides by the zoom down to a 0.5 floor, and only below that do the glyphs recede
  again, where the ground grid has already gone.
- ✅ **Criterion 1 was refused, then priced, then built.** Direction on a wire whose ends are *both
  off screen* needs a cue along the wire's **length**, and the first build declined to guess at the
  density. SIG-006 **R7** measured it in the running editor and shipped it as a chevron every 500
  screen px, **off by default**, behind *Always show wire direction*.
- 🔴 **A straight-line density model overstated both the cost and the need, by ~3.5× and more.**
  Wires modelled as chords between node *origins* said 38 marks a viewport and 40 wires in 54 needing
  the cue; the real `pointOnCurve` geometry says ~10 marks and ~2 in 25. ⚠️ **Node positions are not
  wire geometry** — anything reasoning about wire density has to sample the curve.
- 🔴 **The reason it stays off is redundancy, not density.** An end is visible on ~92% of the wires on
  screen. A single *midpoint* mark, the obvious cheap version, answers under half the wires that need
  one — the criterion's letter, satisfied by a lie.
- 🔴 **The canvas animation flag is now reason-counted.** `isPlayingNodeAnimations` was a bare boolean
  owned by the AI assistant's spinning icons; a second animated thing breaks it in both directions.
  **Anything that animates the canvas from here takes a reason** (SIG-006 R6).

## What SIG-005 settled, and what it left

- ✅ **The pulse was never broken; it was invisible.** Measured on composited canvas pixels in the
  running editor: **1.48:1** against a dark-theme signal wire, 1.43:1 against a value wire, 3.25/3.09
  in light. ⚠️ **Dark is the binding theme for anything painted ON a wire** — the opposite of this
  phase's standing constraint, which is about text on a panel. A wire is already a bright saturated
  colour at 9.3:1 against the ground, so in dark there is nowhere lighter for a mark to go.
- ✅ **`wirePulse.ts` is the one travelling-mark implementation** and it takes the point function as
  an argument. **SIG-006 §"Build" item 4 calls it.** Writing a second one is the failure this
  ordering existed to prevent.
- ✅ **A signal and a value no longer render identically**, and it cost no protocol change: the
  runtime cannot tell them apart (`connectionSentSignal` wraps `connectionSentValue`) but the editor
  already resolves the source port's type one line above the pulse. One bead that travels versus a
  dash along the whole wire.
- 🔴 **The 3:1-against-the-wire criterion is unreachable in dark, and the task says so.** Getting
  there needs a mark darker than the wire, which on a near-black ground reads as a gap — and a gap is
  what an unhealthy wire's dash already means. The mark is legible by **weight**: 17.19:1 against the
  ground on its flanks, dark. **Anything else in this phase that wants to say something on a wire
  should reach for weight or shape first and check the dark number, not the light one.**
- ✅ **R8 — the component a project OPENS ON had every wire unresolved**, so a signal wire painted in
  the **data** colour until you navigated away and back. Found by SIG-005, **fixed the next session as
  [ELO-001](../editor-load-ordering/ELO-001-A-PORT-LIST-CACHED-BEFORE-THE-LIBRARY.md)**, with three
  specs proved red by reverting the fix. 🔴 **It was not load ordering, which is what it looked like
  and what SIG-005 filed.** The `libraryUpdated` re-resolve fires on time; it finds a port list
  `getPorts()` memoised from an `UnknownNodeType` during the window before the viewer delivers the
  library — and `[]` is truthy, so the `if (!this._ports)` guard never re-derives. **SIG-006 may now
  measure wire colour on a first-opened graph**: 0 signal-cyan px / 767 data-green px before, 751 / 0
  after.
- 📋 **Discoverability is still open** and belongs to onboarding. There is now something to discover;
  it needs a **running preview** and lasts ~600 ms.

## What 001/002/004 left for the rest of the phase

- ⚠️ **Three import-free modules now own the popup's decisions**, graded in
  `tests-unit/connection-popup/` (58 new specs): `portCopy.ts` (every sentence — **all copy goes here,
  including SIG-003's and SIG-005's**), `refusalPlan.ts` (the ranking and the confidence rule),
  `searchIntent.ts`. They are in `tsconfig.tests-main.json`'s allowlist.
- ⚠️ **SIG-003 will change strings SIG-002 quotes.** The timing-intent answer names **Variable**'s
  `Set` and **Run On Value Change** by heading. Both live in `portCopy.ts` — one edit, not a grep.
- ⚠️ **`usePortAsLabel` is now load-bearing for the redirect.** SIG-003's audit should treat it as a
  declaration to preserve, not incidental metadata: it is what makes "connect it to Label" right
  instead of "connect it to Variant".
- 📋 **The offer banner scrolls with the list.** It is a header for the port list, not a sticky bar.
  Acceptable — the per-group refusal line carries the reason where it is needed — but worth a look if
  SIG-006 revisits the popup chrome.
