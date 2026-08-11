# Phase 60 — square wire routing, and the two things Richard is not sold on

**Written 2026-08-11.** SIG-001…007 are built. **SIG-007 was then reworked twice, both times because
Richard looked at it and neither time because anything measured wrong** — that is the single most
important thing on this page, and §"How this went" says why.

His verdict on the current build: ***"Other than that it's awesome."*** Two things are open, in his
words, and they are the first work of the next session.

---

## Paste this into a fresh session

Work on **SIG-007 follow-ups** in **phase 60** for OpenNoodl/NodeGX. Work on `cline-dev`, commit
straight to it, no branches and no PRs.

**Check for a second live session first** (`git log --since="3 hours ago"`, and read untracked files
rather than assuming they are yours). There has been one throughout the last seven sessions. It leaves
uncommitted work in `packages/noodl-core-ui/` and
`packages/noodl-editor/src/editor/src/{utils/ExtractToComponent.ts,
views/nodegrapheditor/{EditorClipboard.ts,ExtractToComponentPopup.*}, views/ConnectionPopup/,
views/panels/ComponentsPanelNew/, pages/ProjectsPage/, models/template/}`,
`packages/noodl-editor/tests/`, and now `dev-docs/tasks/phase-62-cold-start/`.
⚠️ **`views/nodegrapheditor/` holds both their untracked files and yours — never pathspec that
directory, name the files.** Pathspec-scope every `git add` **and** every `git commit`, and **never
stash**.

Read first, in this order:

1. `packages/noodl-editor/src/editor/src/views/nodegrapheditor/wireRouting.ts` — **its header is the
   model**. A square wire is stored as the positions of its **runs**, not as points.
2. `dev-docs/tasks/phase-60-values-and-signals/SIG-007-ANCHOR-POINTS.md` — §G is the original geometry
   decision. ⚠️ **§G D1/D2/D5 describe the point-anchor model that was replaced**; the register (R4,
   R6, R7) records why. Do not build from §G without reading the register.
3. This file's **§"How this went"**, which is about judgement rather than code.

### The two open items — Richard's words, 2026-08-11

> **1.** *"I'm not 100% convinced by the system of not being able to break a line in the middle of a
> starting or finishing line towards the node, that should be possible too."*

The first and last runs of every wire are the horizontal stubs into the ports, and `runCoordinate`
deliberately returns `undefined` for both — they are excluded from dragging *and* from splitting, so
they get no `+` either. His point is that **splitting one should be allowed even though moving it is
not**, and he is right: the constraint is that the piece still *touching the port* keeps the port's
row, not that the whole stub is untouchable.

Sketch: allow `addMarks`/`splitRun` on run `0` and run `2n`. Splitting the first horizontal at `x = c`
inserts a vertical at `c` and a horizontal at the port's own row (`ys` entry of `0`), so the wire does
not move and the new interior runs are movable. The port-adjacent piece stays fixed by construction —
it is still run `0`. ⚠️ Watch the invariant: `xs.length === ys.length + 1` must survive, and
`isDefaultRoute` must still recognise an untouched wire.

> **2.** *"The chevrons on longer lines go funky when on the corner of a line, they should probably
> just jump to the next line segment rather than smoothly bending round the corner and looking weirdly
> offset."*

He is describing two faults with one cause. `chevronPlacements` walks a **polyline sampled from
`pointOnCurve` at 48 points across the whole wire** and takes each mark's direction from the segment
between two samples. On a square route that means a sample pair can straddle a corner, so the chevron
points **diagonally** on a right-angle wire; and because the painted path has a rounded corner
(`arcTo`) while the sampled path has a sharp one, a mark near a corner sits **off the wire**.

Sketch: in square mode, place chevrons **per run** — walk each run's own length, use that run's exact
axis direction, and skip `cornerRadiusAt` worth of each end so nothing lands in a fillet. That is
also what "jump to the next line segment" means literally.
⚠️ `DIRECTION_CHEVRON.spacing` is a **screen** distance and deliberately unfloored; keep that.

### Also owed

🔴 **`test:ci` has not run against any of today's rework.** `test:main` is **118 suites / 1703 tests
green** and `noodl-mcp` is **336 green**, but the Electron suite is the one that caught the last
regression (a spec pinning `openConnectionRightClickMenu`'s old signature), and it has seen none of
the square-routing rework. **Run it first, at a pinned seed.**

`dev:stop` **before** `test:ci`; only the `Jasmine:` line counts; match failures **by name** — the
baseline is **6** (4 × `AIX-006 style vocabulary`, 2 × `AI model registry`), reaching 12 when the
order-dependent BEN-001 cluster fires. `NOODL_SPEC_SEED=91848 npm run test:ci` is the pinned run used
today. ⚠️ It takes 10–15 min and its output is large — redirect to a file and grep, or a truncated
tail loses the `Jasmine:` line.

---

## What square routing is, in one paragraph

Every wire in this editor is built as `[P0, {mid, fy}, {mid, ty}, P3]` and drawn as a cubic *through*
those control points — so **the control polygon of every wire has always been the orthogonal route**.
Square mode draws it, with a small fillet at each corner. A wire nobody has touched is
`{ xs: [mid], ys: [] }` and comes out as those four points exactly, including the `'inline'` layout's
hook out to the left of both nodes, which is *not* a midpoint and would be lost by recomputing one.
`xs` are fractions of the horizontal gap between the ports (so routing stretches when a node moves);
`ys` are graph px from the source port's row (so a detour stays the size it was drawn). Neither is
clamped to `[0, 1]` — see R4.

**Gestures, in the order they are asked:** the `+` on a run's midpoint (splits it and hands the drag
straight to the run that appeared), a corner (moves both runs meeting there), a run (slides along its
one axis). Adding is also on the right-click menu, with *Delete anchor* and *Reset routing*.
**Curved wires are unbendable** — a curve is a *look*, square is the mode you route in, and that is
what makes one storage format enough.

## How this went — the part worth reading

🔴 **Three interaction models in one session, and every correction came from Richard looking at it.**

1. **Point anchors on curves.** Built, measured, gated, documented. He never asked for curves to be
   bendable; I assumed it because the task said "anchor points".
2. **Square routing, anchors minted by dragging.** He asked for square. I kept the mint-on-drag
   gesture from (1), which on a straight line is wrong: *"my instinct would be that grabbing a
   vertical line and dragging it left or right would just move it left or right"*.
3. **Square routing, runs not points.** His model. A run's position has to be a **stored number** for
   it to be draggable, which is why this changed the on-disk format rather than the gesture.

⚠️ **None of (1) was wasted, and none of it was right either.** The seam enumeration, the persistence
work, R2 and R3 all carried straight over. The *geometry* — `wireAnchors.ts`, 26 specs, a measured
21,300-case self-crossing sweep, a carefully argued ring glyph — was deleted whole. **It was rigorous
and it answered a question nobody had asked.**

🔴 **And the affordance failure is the same lesson twice.** Shipped (3), the first thing reported was
*"there's no way to add an anchor that I can see"*. It was not broken — *Add anchor here* had been on
the right-click menu all along and I verified it worked. **A control nobody can see is not a control**,
and I had written prose about the gesture instead of painting it. The `+` marks exist because of that
sentence.

**The standing rule this earns:** on anything a builder will *touch* rather than read, get it in front
of Richard at the first runnable state. The measurements were all sound; they priced things, and they
could not tell me which thing to build.

## Traps found today, all real and all filed

- 🔴 **A model field can land on top of a method.** `NodeGraphEditorConnection`'s constructor copies
  every model field onto the view, and `labelT` is both a stored number (CAN-001) and a method. An own
  property beats a prototype method, so a wire whose label had been moved threw
  `TypeError: this.labelT is not a function` **inside `paint`** — the frame stops, and **every node
  after that wire disappears and nothing responds to a click**. Latent since CAN-001; it only fires
  once the view is rebuilt from a model already carrying the key. Fixed by guarding the copy, not by
  renaming the field.
- 🔴 **A node with no `type` did the same one layer up.** `UnknownNodeType.localName` threw inside a
  getter during load; `fromJSON` adds roots before connections, so the graph ended up with **all its
  wires and none of its nodes**. Surfaced as a `<EditorDocument>` error naming nothing relevant.
  ⚠️ **Wires-but-no-nodes is a thrown exception, not a paint bug.** The debris node is still in
  `Puppy test 3` → `components/Pages/Admin Login/nodes.json` (`6d5ec795…`); the guard makes it
  harmless and does not remove it.
- ⚠️ **HMR leaves the mounted editor on the old module.** A fix can be in the bundle — a freshly
  `require`d copy proves it — while the running editor still reports the old behaviour. **Restart
  before disbelieving a fix.** Cost a wrong "the fix does not work" today.
- 🔴 **An unsettled canvas baseline reads as no change.** The first `layoutAndPaint()` after changing
  editor state differs from every later one. A real new mark measured **0 changed pixels** three times
  against such a baseline. `grab(); const baseline = grab();` and require a **0** control before
  believing any pixel measurement. And a `getImageData` **sum is not a fingerprint** — count pixels.
- 🔴 **The `(0, 1)` clamp on `u`** (R4) put a minted anchor at the far end of the wire, and **the
  round-trip spec that should have caught it passed** — the frame maths is exact; the normaliser
  between encode and decode was what moved the point. Test the whole production path, not the pair of
  functions you wrote.

## Housekeeping

- ⚠️ **A scratch project `NodeGX test projects/sig007-check` exists and is registered** — a copy of
  `nodegx-qa-fixture`, used for driving. Delete it and strip it from
  `~/Library/Application Support/NodeGX/{recently_opened_project.json,project_runtime_cache.json}`.
  The source fixture's SHA is `7b601a1a…` and is unchanged.
- ⚠️ **`nodeGraphEditor.squareWireRouting` is currently `true`** in Richard's editor settings, set over
  CDP for testing. It ships **off** by default; the toggle is Settings → Appearance → *Square wire
  routing*.
- ⚠️ `typecheck:runtime` is **still red and still not this work** — two untouched test files
  redeclaring `EditorConnection`. Do not let it read as a regression.
- The dev stack is running for Richard's testing. `dev:stop` before any `test:ci`.
