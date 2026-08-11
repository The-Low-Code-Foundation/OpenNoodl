# Phase 60 — next session

**Written 2026-08-11**, at the end of the session that closed **SIG-006 R3**.
**SIG-001…006 are done — 6 of 7.** Only **SIG-007** remains, and it is gated on a question for
Richard, not on code. Commit: `1b28efe6`.

## What this session did, so you do not redo it

### SIG-006 R3 — decided, priced, and built

R3 asked whether a wire should state its direction in its **middle**, and at what density cost. The
previous session refused it as an unpriced density decision and left it open. It is now decided:

✅ **A chevron repeated every 500 screen px along the wire, off by default**, behind a new editor
setting **Always show wire direction** (`ALWAYS_SHOW_WIRE_DIRECTION`, Appearance settings, beside
CAN-001's *Always show wire labels*). Geometry is `DIRECTION_CHEVRON` / `chevronPlacements` /
`chevronPolyline` in [`wireEndpoints.ts`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/wireEndpoints.ts),
import-free, 9 new specs (30 in `tests-unit/sig-006/`). Criterion 1 is now met, with its condition
named rather than glossed.

### 🔴 The finding worth carrying: node positions are not wire geometry

I first priced this **statically**, treating each connection as a straight line between its two nodes'
`x`/`y`. That model was wrong in a way that mattered:

| | straight lines over node origins | real curves, measured live |
|---|---:|---:|
| chevrons painted, median viewport | 38 | **~10** |
| visible wires with **both ends off screen** | 40 of 54 | **~2 of 25** |

The curve leaves the source and arrives at the target *horizontally*, routed through a mid-x control
pair, so neither its arc length nor its viewport intersection resembles the chord. **Measure wire
density by sampling `pointOnCurve` in the running editor.** A static sweep over `project.json` is fine
for *finding* the densest component — it correctly picked `Erleah-2` `/Pages/Home`, 263 wires — but
not for the number.

🔴 **And the correction changed the *reason* for the decision, not just the figures.** The refusal
rested on density; density turned out affordable. What actually keeps the cue off by default is
**redundancy** — at a normal viewport an end is visible on ~92% of the wires on screen, and those
already state their direction with a circle and an arrowhead. Hover answers the rest. Had I stopped at
the static model I would have reached the same verdict for a reason that was not true.

### The other things worth carrying

1. 🔴 **A single mid-wire mark is not the cheap version, it is a plausible lie.** One chevron at the
   midpoint costs almost nothing and answers **under half** the wires that need it, because a long
   wire's *middle* is usually off screen too. It would have satisfied the acceptance criterion's
   letter — you can capture one — while leaving the case unanswered. **A cue readable from *any* slice
   of a wire must repeat, and repeating is the entire cost. They are the same requirement.**
2. ⚠️ **The marks thin out as you zoom away** — 22 → 15 → 6 chevrons at 100/50/25% on a fixed pan,
   because graph-space spacing grows with `1/scale` and a wire must be one spacing long to carry any.
   That is the right way round: zooming out brings the *ends* on screen, where the endpoint glyphs
   answer. ⚠️ Note this is the opposite treatment to `glyphScaleFor`, which is floored — **glyph
   *size* is floored, mark *spacing* is not**, and the header says why.
3. **Open and stroked, against the endpoint arrowhead's closed fill.** A mid-wire mark that read as an
   endpoint would say the wire *stops* there — on a wire whose real ends are off screen, the one thing
   it must not say.
4. ⚠️ **The label chip paints after the chevrons** (`paintPortLabel` is the last call in `paint`), so
   the CAN-001/002 midpoint collision R3 worried about resolves by ordering, not by special-casing.

### Gates, measured on this tree

`typecheck:editor`, `typecheck:editor-tests`, `typecheck:viewer`, `typecheck:cloud` **clean** ·
`lint:ci` **865 errors against a 3916 baseline** — *unchanged* from session start ·
`test:main` **117 suites / 1662 tests green** (was 117/1653; +9, all R3's) ·
`test:ci` **2635 specs, 6 failures at seed 91485** — **the baseline exactly, by name** (4 ×
`AIX-006 style vocabulary`, 2 × `AI model registry`). The order-dependent BEN-001 trio did not fire at
this seed.

⚠️ `typecheck:runtime` is **still red and still not this work** — the same two untouched files
redeclaring `EditorConnection` (`editorconnection.replyidentity.test.ts:23`,
`editorconnection.sendqueue.test.ts:24`). Ten minutes for someone; **do not let it read as a
regression.**

⚠️ **These gates ran on a tree carrying a concurrent session's uncommitted work** — the same 20 files
as last session (`noodl-core-ui/`, `ProjectsPage/`, `ExtractToComponent*`, `ComponentsPanelNew/`,
`models/template/`, `ConnectionPopup/`, `EditorClipboard.ts`, `tests/`). They were untouched by this
commit and unchanged throughout; the baseline matched by name exactly.

### Housekeeping done

- `Erleah-2/project.json` was **copied, never opened** — SHA `1c926d68…` verified unchanged at the end.
  The editor drove a scratch copy in the session scratchpad instead. ⚠️ See the memory
  `open-a-copy-of-a-real-project-in-the-editor` for the mechanic, including that the live app's
  Application Support directory is **`NodeGX`** and that `editorSettings.json` nests everything under
  a `settings` key.
- The scratch entry was removed from `recently_opened_project.json` and `editorSettings.json` restored
  from backup.

---

Paste the block below into a fresh session.

---

Work on **phase 60** for OpenNoodl/NodeGX. **SIG-001…006 are all closed.** The only task left is
**SIG-007**, and it is **gated on a question for Richard** — read "Which to do" before starting
anything. Work on `cline-dev`, commit straight to it, no branches and no PRs.

**Check for a second live session first** (`git log --since="3 hours ago"`, and read untracked files
rather than assuming they are yours) — there has been one throughout the last five sessions, on phases
50/54/55/57/58. It leaves uncommitted work in `packages/noodl-core-ui/` and
`packages/noodl-editor/src/editor/src/{utils/ExtractToComponent.ts,
views/nodegrapheditor/{EditorClipboard.ts,ExtractToComponentPopup.*}, views/ConnectionPopup/,
views/panels/ComponentsPanelNew/, pages/ProjectsPage/, models/template/}` and
`packages/noodl-editor/tests/`. ⚠️ **`views/nodegrapheditor/` holds both their untracked files and
yours, and `views/ConnectionPopup/` is theirs — never pathspec either directory, name the files.**
Pathspec-scope every `git add` **and** every `git commit`, and **never stash**.

Read these first, in this order:

1. `dev-docs/tasks/phase-60-values-and-signals/README.md` — the phase and its **four premise
   corrections**, every one read in source. Do not re-derive them.
2. `dev-docs/tasks/phase-60-values-and-signals/TASKS.md` — the ordering, and **"What SIG-006 settled,
   and what it left"**.
3. `dev-docs/tasks/phase-60-values-and-signals/SIG-007-ANCHOR-POINTS.md` — **its §0 first.**
4. `packages/noodl-editor/src/editor/src/views/nodegrapheditor/wireEndpoints.ts` — **its header carries
   the whole endpoint and along-the-wire vocabulary, the fill-ratio table, and R3's density
   measurements.** Anything new painted on a wire or its ends goes through it.

## Which to do

**SIG-007 is gated on a question, not on code.** Its §0 says to ship 001–006, put the result in front
of the same user, and ask whether he still wants to bend wires — because manual routing is what people
reach for when they cannot tell what a wire is or where it goes, which is exactly what 005 and 006
address. **All six have now shipped, so the question is finally askable, and nothing else in the phase
is blocking it.** SIG-007 is also the only task in the phase that changes what a connection is **on
disk**. **Do not start it without that answer.**

⚠️ **Ask Richard, and show him the built result while you ask** — including *Always show wire
direction* in Appearance settings, which is off by default and which he has not seen.

If the answer has not come, the **ELO track** has an obvious second task: **one node with an undefined
type name still takes down the whole editor document.** `Puppy test 3` gives an "Aw, Snap!" boundary —
`UnknownNodeType.localName` does `this.name.split('/')` with `this.name` undefined
(`models/nodelibrary/UnknownNodeType.ts:6`). Same class and same boot window as ELO-001, and it kills
the document rather than mispainting it. Carried across three handovers now, still unfixed.

## Standing constraints for this phase

- 🔴 **Dark is the binding theme for anything painted on a wire.** Light is binding for text on a
  panel. Do not inherit the wrong one.
- **Wire colour already carries four meanings** — type, health, pulse, diff annotation — and
  `NodeGraphEditorConnection.ts:625-627` explicitly refused to make selection a fifth, using stroke
  weight instead. **New information goes in shape, weight or motion. Never a sixth colour.**
- **Red is danger only.**
- ⚠️ **Glyphs on the canvas are painted at constant screen size** via `glyphScaleFor`, floored at 0.5
  zoom. **Mark *spacing* along a wire is screen-based too but deliberately unfloored** — see
  `DIRECTION_CHEVRON.spacing`. Do not "fix" one to match the other.
- ⚠️ **The canvas animation flag is reason-counted.** `startNodeAnimations(reason)` /
  `stopNodeAnimations(reason)`. Passing no reason takes the default `'nodes'` hold and will fight the
  AI assistant.
- ⚠️ **`endpointHitRadius` is 8 against a painted radius of 3**, deliberately, for CAN-003 endpoint
  dragging. An arrowhead is paint, not a target — and so is a chevron.
- 🔴 **Node positions are not wire geometry.** Any density claim about wires is measured by sampling
  `pointOnCurve` in the running editor; a straight-line model over node `x`/`y` overcounts by ~3.5×
  and misled R3 about *why* its own answer was right.

## Driving and measuring

Use the `run-editor` skill. Mechanics are in memory under **`reaching-editor-modules-over-cdp`**,
**`open-a-copy-of-a-real-project-in-the-editor`** and **`a-boot-window-defect-erases-its-own-evidence`**:

- ✅ **`window.__nodeGraphEditor` is the live editor**; `ed.model.owner.owner` is the ProjectModel, and
  `ed.switchToComponent(comp)` navigates without touching the UI.
- ✅ **`ed.layoutAndPaint()` paints synchronously**; `ed.repaint()` only schedules a
  `requestAnimationFrame`, which an occluded window clamps ~1000×.
- ✅ **The graph context is `ed.canvas.ctx`**, and `ed.canvas.ratio` is the device ratio.
  Screen px = `(graph + pan) * scale * ratio`.
- ✅ **To prove a new mark paints, diff two frames** — patch the guard method on the connection
  prototype to return `false`, `layoutAndPaint()`, `getImageData`, restore, repeat. The changed pixels
  *are* your mark, and you never have to guess a colour threshold.
- ⚠️ **`ed.clearSelection(); ed.highlighted = null; ed.setHighlightedConnection(undefined);` first**, or
  you measure the highlighted colours and the hover mark.
- ⚠️ **The CDP `eval` context persists between calls** — wrap every probe in `(() => { … })()`.
- ⚠️ **`npm run cdp -- eval "$(cat file.js | tr '\n' ' ')"` silently comments out the rest of the file**
  at the first `//`. **Strip comment lines** (`grep -v '^[[:space:]]*//'`) or you get
  `SyntaxError: Unexpected end of input`. This bit again this session.
- Clean up anything you add to Richard's projects, and confirm the removal **on disk** — back
  `project.json` up first and check the SHA afterwards. Better still, **drive a copy**.

## Gates

`dev:stop` **before** `test:ci`; **measure `test:main`, never inherit its number**; only the
`Jasmine:` line counts, and match failures **by name** — the baseline is **6** (4 × `AIX-006 style
vocabulary`, 2 × `AI model registry`), reaching 12 when the order-dependent BEN-001 cluster fails.
✅ **`NOODL_SPEC_SEED=<seed> npm run test:ci` pins the order** — when the extra failures plausibly touch
what you changed, pin the failing seed and revert your change rather than settling for a clean run at
another seed. **Record the seed.** ⚠️ `test:ci` takes 10–15 minutes and its output is large — redirect
it to a file and grep, because a truncated tail loses the `Jasmine:` line and the seed. ⚠️ A sub-minute
exit-1 at the webpack stage is transient; re-run it. ⚠️ `typecheck:runtime` is already red on two
untouched test files — do not chase it.
