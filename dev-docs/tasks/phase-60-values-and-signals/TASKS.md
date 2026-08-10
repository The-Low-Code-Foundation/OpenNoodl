# Phase 60 — the tasks (SIG: values flow, signals fire)

**Created:** 2026-08-09, out of [README.md](README.md) and a new user's feedback.
**3 of 7 closed 2026-08-11** — SIG-001, 002 and 004, built together because they share one popup, one
`if (d)` guard and one vocabulary (`portCopy.ts`). Remaining: **003, 005, 006, 007**.

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
| SIG-003 ⭐ | [SIG-003-GROUPS-THAT-MEAN-SOMETHING.md](SIG-003-GROUPS-THAT-MEAN-SOMETHING.md) | **the second flagship** — one heading vocabulary, ordered by use; the ungrouped-port audit | 📋 open |
| SIG-004 | [SIG-004-EVERY-SIGNAL-SAYS-WHAT-IT-DOES.md](SIG-004-EVERY-SIGNAL-SAYS-WHAT-IT-DOES.md) | one sentence at the render seam, true of every signal port in the library | ✅ **closed 08-11** |
| SIG-005 | [SIG-005-THE-SIGNAL-TRAVELS.md](SIG-005-THE-SIGNAL-TRAVELS.md) | the travelling pulse — **already built and on by default**; find out why nobody sees it | 📋 open |
| SIG-006 | [SIG-006-WHICH-WAY-DOES-THIS-WIRE-GO.md](SIG-006-WHICH-WAY-DOES-THIS-WIRE-GO.md) | endpoint glyphs you can tell apart, and a hover that runs the length of a long wire | 📋 open |
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
