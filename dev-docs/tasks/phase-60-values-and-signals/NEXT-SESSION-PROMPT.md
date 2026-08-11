# Phase 60 — next session

**Written 2026-08-11.** **SIG-001…006 are all closed.** The whole session's work was seen by Richard
in the running editor, and his feedback is already built (R8/R9). **SIG-007 is unblocked — its §0 gate
is answered, in his words, in the task file** — and it is the only thing left in the phase.

Commits: `1b28efe6` (R3), `d6e0562c` (R8/R9), plus the doc commit that follows this file.

## What this session did, so you do not redo it

### 1. SIG-006 R3 — the along-the-wire chevrons, priced and built

A chevron repeated every **500 screen px**, arc-length spaced, on wires long enough to carry one.
Geometry in `DIRECTION_CHEVRON` / `chevronPlacements` / `chevronPolyline` in
[`wireEndpoints.ts`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/wireEndpoints.ts).

🔴 **The finding worth carrying: node positions are not wire geometry.** I first priced this with a
static model treating each wire as a straight line between its two nodes' `x`/`y`. Measured live on
real `pointOnCurve` geometry it was wrong by ~3.5× on the cost (38 → ~10 marks a viewport) and by more
on the need (40-of-54 → ~2-of-25 wires with both ends off screen). The curve leaves and arrives
*horizontally* through a mid-x, so neither its length nor its viewport intersection resembles the
chord. **A static sweep over `project.json` is fine for finding the densest component; never for the
number.**

🔴 **And a measurement can be right and still answer the wrong question.** The corrected numbers made
me ship the chevrons **off** by default, reasoning from redundancy. Richard turned them on on sight —
*"I think it should be on by default, with the option to turn it off"*. The measurement answered *how
much this costs*; it could not answer *what the canvas should look like*. Worse, the thing that made
him want it always-on was the length threshold I had built for density reasons: short hops stay clean,
so only wires you cannot take in at a glance get marked. **The cost model produced the feature's best
argument and then argued against it.**

### 2. SIG-006 R8 — the hover mark arrives instead of stopping

Richard: *"it stopping abruptly is a bit weird, and the triangle at the end not lighting up white is
inconsistent… I'd have expected something a bit more 'electric', rounded and faded, not a white
rectangle."*

🔴 **All three were one omission — the mark modelled the *crossing* and nothing about landing.**
`travellingHeadRange` clamps the head at `t = 1` and holds the tail `headSpan` behind it, so a
full-length bar **parked** on the end of the wire and then blinked out. Three additions in
`wirePulse.ts`, so the runtime pulse and the hover mark keep **one** implementation:

- **`beadRange`** runs the tail in after the head lands (170 ms) — the mark is consumed by the target.
- **`arrivalGlow`** lights the target arrowhead as it lands, decaying over 240 ms. ⚠️ The lit glyph is
  the *payoff*: the mark spends its whole life saying "this way" and only that instant says "**here**".
- **`beadTaper`** + a dim wide halo under a bright narrow core. ⚠️ **One stroke can only be one width
  and one alpha** — that is *why* it was a bar. It is now 14 segments. `shadowBlur` is the other way
  to get a glow and costs far more on a graph pulsing dozens of wires.

Measured live, peak luminance in a 3×3 on composited pixels: bead **222 → 229** at 120 ms and
**220 → 241** at 380 ms (brighter toward the head — the fade reads); target glyph **202 → 231** on
landing, back to **202** by 700 ms; wire clear after 560 ms.

⚠️ `travellingHeadRange` is **unchanged** and still grades the crossing — `beadRange` wraps it. Do not
collapse them; SIG-005's specs describe the crossing honestly.

### Gates, measured on this tree

`typecheck:editor`, `:editor-tests`, `:viewer`, `:cloud` **clean** · `lint:ci` **865 / 3916 baseline**,
unchanged from session start · `test:main` **117 suites / 1674 tests green** (was 117/1653; +21, all
this session's) · `test:ci` **2635 specs, 6 failures at seed 91848** — **the baseline exactly, by
name** (4 × `AIX-006 style vocabulary`, 2 × `AI model registry`). Run twice, at seeds 91485 and 91848,
6 both times; the order-dependent BEN-001 trio fired at neither.

⚠️ `typecheck:runtime` is **still red and still not this work** — the same two untouched files
redeclaring `EditorConnection`. **Do not let it read as a regression.**

⚠️ Gates ran on a tree carrying a concurrent session's uncommitted work (the same ~20 files as the
last five sessions). Untouched by these commits; the baseline matched by name exactly.

### Housekeeping

`Erleah-2/project.json` was **copied, never opened** — SHA `1c926d68…` verified unchanged at the end.
Scratch project registrations and `editorSettings.json` were restored from backup. **The dev stack is
stopped.**

---

Paste the block below into a fresh session.

---

Work on **SIG-007, anchor points**, the last open task in **phase 60** for OpenNoodl/NodeGX.
**SIG-001…006 are all closed and Richard has seen them running.** Work on `cline-dev`, commit straight
to it, no branches and no PRs.

**Check for a second live session first** (`git log --since="3 hours ago"`, and read untracked files
rather than assuming they are yours) — there has been one throughout the last six sessions, on phases
50/54/55/57/58. It leaves uncommitted work in `packages/noodl-core-ui/` and
`packages/noodl-editor/src/editor/src/{utils/ExtractToComponent.ts,
views/nodegrapheditor/{EditorClipboard.ts,ExtractToComponentPopup.*}, views/ConnectionPopup/,
views/panels/ComponentsPanelNew/, pages/ProjectsPage/, models/template/}` and
`packages/noodl-editor/tests/`. ⚠️ **`views/nodegrapheditor/` holds both their untracked files and
yours — never pathspec that directory or `views/ConnectionPopup/`, name the files.** Pathspec-scope
every `git add` **and** every `git commit`, and **never stash**.

Read these first, in this order:

1. `dev-docs/tasks/phase-60-values-and-signals/SIG-007-ANCHOR-POINTS.md` — **all of it.** Its **§0 is
   answered** (Richard's words, recorded 2026-08-11) so the gate is cleared, but §0 still names what
   this task costs, and **"What else acquires a new field"** is the part that makes it large.
2. `dev-docs/tasks/phase-60-values-and-signals/README.md` — the phase and its **four premise
   corrections**, every one read in source. Do not re-derive them.
3. `dev-docs/tasks/phase-60-values-and-signals/TASKS.md` — **"What SIG-006 settled, and what it left"**.
4. `packages/noodl-editor/src/editor/src/views/nodegrapheditor/wireEndpoints.ts` — **its header owns
   the whole mark vocabulary on a wire and its end**, with the fill-ratio table and R3's density
   measurements. **An anchor handle is a sixth mark on that wire and goes through this module.**
5. `packages/noodl-editor/src/editor/src/views/nodegrapheditor/wirePulse.ts` — the one travelling-mark
   implementation, now including the arrival.

## Where to start

**SIG-007 §"Build" item 1 is the real first task and the spec is right that it comes before code:
decide the geometry and write it down.** Two decisions are load-bearing and neither is made:

- ⚠️ **Relative or absolute.** An anchor in absolute canvas coordinates on a wire whose endpoints then
  move produces a wire that loops back on itself. The acceptance drives a node *the full width of the
  canvas with three anchors set* — design for that case first, not last.
- 🔴 **R1 is an unresolved design conflict, not a detail.** "Click near one end and drag" is *already*
  `endpointAt`'s CAN-003 re-target gesture at an 8px radius. The reported feature begins with the same
  gesture. Decide the boundary and **make it visible** before building either.

**Whatever a zero-anchor wire computes must be exactly today's curve**, or every existing graph
re-routes itself on open.

⚠️ **Richard's two design steers, recorded in SIG-007's §0 block:** a cue should *only appear where it
is needed* (handles on hover/selection only — he confirmed the principle unprompted), and the
aesthetic to hold to is a **wire diagram**. There are already five marks on a wire — endpoint circle,
endpoint arrowhead, `'both'` diamond, direction chevron, travelling bead. An anchor handle is a sixth.

## Standing constraints for this phase

- 🔴 **Dark is the binding theme for anything painted on a wire.** Light is binding for text on a panel.
- **Wire colour already carries four meanings** — type, health, pulse, diff annotation — and
  `NodeGraphEditorConnection.ts` explicitly refused to make selection a fifth, using stroke weight.
  **New information goes in shape, weight or motion. Never a sixth colour.**
- **Red is danger only.**
- ⚠️ **Glyphs are painted at constant screen size** via `glyphScaleFor`, floored at 0.5 zoom. **Mark
  *spacing* along a wire is screen-based but deliberately unfloored** (`DIRECTION_CHEVRON.spacing`).
  Do not "fix" one to match the other.
- ⚠️ **The canvas animation flag is reason-counted.** `startNodeAnimations(reason)` /
  `stopNodeAnimations(reason)` — passing no reason takes the `'nodes'` hold and fights the AI assistant.
- ⚠️ **`endpointHitRadius` is 8 against a painted radius of 3**, deliberately, for CAN-003. Paint is
  not a target — and SIG-007 is where that finally gets contested.
- 🔴 **Node positions are not wire geometry.** Any density or length claim about wires is measured by
  sampling `pointOnCurve` in the running editor; a straight-line model over node `x`/`y` overcounts by
  ~3.5×.
- 🔴 **A measurement can be right and answer the wrong question.** Cost models price a thing; they do
  not decide whether it belongs. Put it in front of Richard.

## Driving and measuring

Use the `run-editor` skill. Mechanics are in memory under **`reaching-editor-modules-over-cdp`**,
**`open-a-copy-of-a-real-project-in-the-editor`** and **`a-boot-window-defect-erases-its-own-evidence`**:

- ✅ **`window.__nodeGraphEditor` is the live editor**; `ed.model.owner.owner` is the ProjectModel and
  `ed.switchToComponent(comp)` navigates without touching the UI.
- ✅ **`ed.layoutAndPaint()` paints synchronously**; `ed.repaint()` only schedules a
  `requestAnimationFrame`, which an occluded window clamps ~1000×.
- ✅ **The graph context is `ed.canvas.ctx`**, `ed.canvas.ratio` is the device ratio, and screen px =
  `(graph + pan) * scale * ratio`.
- ✅ **To prove a new mark paints, diff two frames** — patch the guard method on the connection
  prototype to return `false`, `layoutAndPaint()`, `getImageData`, restore, repeat. The changed pixels
  *are* your mark, and you never have to guess a colour threshold.
- ✅ **To grade an animation, drive the clock, not the pointer** — set `ed.highlightedConnection` and
  `ed.hoverMarkStartedAt = performance.now() - age`, then `layoutAndPaint()` per age. That is how R8's
  arrival was measured frame by frame.
- ⚠️ **`ed.clearSelection(); ed.highlighted = null; ed.setHighlightedConnection(undefined);` first**, or
  you measure the highlighted colours and the hover mark.
- ⚠️ **The CDP `eval` context persists between calls** — wrap every probe in `(() => { … })()`.
- ⚠️ **`npm run cdp -- eval "$(cat file.js | tr '\n' ' ')"` silently comments out the rest of the file**
  at the first `//`. **Strip comment lines** (`grep -v '^[[:space:]]*//'`). This bit again this session.
- ⚠️ **Opening a project rewrites it.** Drive a **copy**, and check the source's SHA at the end.

## Gates

`dev:stop` **before** `test:ci`; **measure `test:main`, never inherit its number**; only the
`Jasmine:` line counts, and match failures **by name** — the baseline is **6** (4 × `AIX-006 style
vocabulary`, 2 × `AI model registry`), reaching 12 when the order-dependent BEN-001 cluster fails.
✅ **`NOODL_SPEC_SEED=<seed> npm run test:ci` pins the order** — when the extra failures plausibly touch
what you changed, pin the failing seed and revert your change rather than settling for a clean run at
another seed. **Record the seed.** ⚠️ `test:ci` takes 10–15 minutes and its output is large — redirect
to a file and grep, because a truncated tail loses the `Jasmine:` line and the seed. ⚠️ A sub-minute
exit-1 at the webpack stage is transient; re-run it. ⚠️ `typecheck:runtime` is already red on two
untouched test files — do not chase it.

⚠️ **SIG-007 changes what a connection is on disk, so its gates are not only the suite.** The
acceptance asks for save → close → reopen **and** export → import, *separately* — a field the exporter
does not know about is dropped silently and shows up as "my routing disappeared", not as an error.
