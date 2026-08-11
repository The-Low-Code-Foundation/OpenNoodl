# Phase 60 — next session

**Written 2026-08-11**, at the end of the session that fixed **R8** (as ELO-001) and built **SIG-006**.
**6 of 7 SIG tasks are done.** Only **SIG-007** remains, and it is gated on a question for Richard,
not on code — see the last section. There is also **one open item inside SIG-006** (R3) that is a
design decision rather than a bug.

Commits: `ac7690c5` (ELO-001) and the SIG-006 commit that follows it.

## What this session did, so you do not redo it

### 1. R8 is fixed — and the handover's diagnosis of it was wrong

R8 said "the component a project opens on builds its connections before the node library can answer",
and pointed at editor load ordering. **It is not load ordering.** An in-boot trace shows
`EditorEventBindings`' `libraryUpdated` re-resolve firing exactly when it should, with the connection
in hand, *after* the type has resolved to a `BasicNodeType` — and still reading **zero ports**:

```
resolvePorts onClick -> saveValue  from=UNRESOLVED  portsOnFromNode=0  libLoaded=false  typeCtor=UnknownNodeType
libraryUpdated handler in EditorEventBindings, connections=1
resolvePorts onClick -> saveValue  from=UNRESOLVED  portsOnFromNode=0  libLoaded=true   typeCtor=BasicNodeType
```

`NodeGraphNode.getPorts()` memoises the `[]` it derives from an `UnknownNodeType` during the window
before the viewer delivers the library, and **`[]` is truthy**, so `if (!this._ports)` never
re-derives. Full write-up:
[`dev-docs/tasks/editor-load-ordering/ELO-001-…md`](../editor-load-ordering/ELO-001-A-PORT-LIST-CACHED-BEFORE-THE-LIBRARY.md).

🔴 **The trap worth carrying: the defect erases its own evidence.** `NodeGraphModel.scheduleUpdateTypes()`
clears every node's `_ports` on a `setTimeout(…, 1)` — one tick *after* the only thing that would have
re-read it. So by the time you can type into a console, the cache is healthy and only `fromPort` is
stale, which reads as pure load ordering. **I abandoned the correct hypothesis once on exactly that
evidence.** Anything inside the editor's first second has to be traced with `console.log` in source and
a cold boot, not probed from a live `eval`.

⚠️ **A cold boot is required to reproduce**: reopening a project inside a live session has the library
already loaded. Stage the fixture **on disk** (stop the stack, edit `project.json`, relaunch).

### 2. SIG-006 is built — 6 of 7 acceptance criteria

Circle at the source, arrowhead at the target, on every committed wire; node-side glyphs rebuilt;
`'both'` given a **diamond**; hover runs SIG-005's mark source → target; `portIcons.ts` **deleted**.
Geometry is in [`wireEndpoints.ts`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/wireEndpoints.ts),
import-free, 21 specs in `tests-unit/sig-006/`.

Measured on composited pixels, `lib21-qa` `/Table/Row`, five wires — the width **across** the wire at
the endpoint and behind it, masked to the wire's own colour so the node card is excluded:

| zoom | glyph | at the endpoint | 3 back | 7 back |
|---|---|---:|---:|---:|
| 100% | source circle | **5.5 px** | 1.5–2.5 | 1.5–2 |
| 100% | target arrowhead | **0 px** | 3.5 | 7.5–10 |
| 50% | source circle | **5.5–6 px** screen | — | — |
| 50% | target arrowhead | **0–0.5 px** screen | — | — |

The profiles are opposite by construction, and unchanged by zoom.

### The five things worth carrying

1. 🔴 **A glyph on a zooming canvas must be painted at constant *screen* size, or no choice of shape
   passes a zoom-out test.** Everything after `CanvasRenderer` scales the context is in *graph* units,
   so the old 7px disc and 8px triangle were 3.5 and 4 screen px at 50% — half a pixel apart. This was
   never a shape problem first; it was a units problem. `glyphScaleFor` divides by the zoom down to a
   0.5 floor (below which the ground grid has already gone).
2. 🔴 **`isPlayingNodeAnimations` was a bare boolean and a second animated thing breaks it in both
   directions.** The AI assistant's spinning icons owned it; a pointer leaving a wire would have frozen
   them mid-spin, and the assistant finishing would have frozen the hover mark. `CanvasPainter` now
   counts **reasons**. **Anything else that animates the canvas must take a reason, not the boolean.**
3. 🔴 **`isHighlighted()` is not "the wire under the cursor."** It is also true when either endpoint's
   *node* is hovered or selected — a dozen wires at once on a busy node. The hover mark reads
   `owner.highlightedConnection === this`.
4. ⚠️ **The hover bead runs on value wires too, and that is a decision.** At runtime SIG-005 gives a
   value a repeating dash because a value is live everywhere at once. Hover asks a *different*
   question, and "which way" has one answer shape for both kinds. The two never collide — the hover
   branch is `else` to the pulse.
5. 🔴 **SIG-006's criterion 1 is refused, not met.** See below.

### 🔴 SIG-006 R3 — the one criterion this session would not fake

Criterion 1: *"a committed wire shows its direction without hovering, without selecting, and without
either node being visible — captured on a wire whose ends are both off screen."*

**An endpoint glyph is at the endpoint.** On a wire whose ends are both off screen there is nothing of
it to see, and the criterion forbids the hover that does answer that case. Meeting it literally needs
an always-on **mid-wire** cue, and that is a density decision, not a detail:

- the task's own "What must not regress" says endpoint density on a real graph is the test;
- the label chip (CAN-001/002) already occupies the midpoint on wires that have one;
- a mark on every wire in a hundred-wire graph is exactly what the endpoint dots were kept small to
  avoid.

**Left unbuilt and written down** rather than guessed at — the same shape as SIG-005's finding that a
criterion applied literally would have made the thing worse. If you take it on, the candidates are a
mid-wire chevron (cheap, collides with the chip) or tapering the wire itself (survives any zoom,
larger change, interacts with the pulse's weight boost and `Created`'s 3px stroke).

⚠️ Also open: **the `'both'` diamond has never been seen on a screen.** A sweep of every component in
`lib21-qa` found zero `'both'` plugs — it needs a port that is the source of one wire *and* the target
of another *on the same side of the same node*. It is graded by spec. Look at it when you build one.

### Gates, measured on this tree

`typecheck:editor`, `typecheck:editor-tests`, `typecheck:viewer`, `typecheck:cloud` **clean** ·
`test:main` **117 suites / 1653 tests green** (was 116/1632; +1 suite, +21 specs, all SIG-006's) ·
`lint:ci` **865 errors against a 3916 baseline** — *down* 2 from the 867 at session start, because the
plug-glyph helpers became `const` rather than adding four `no-inner-declarations` to the ratchet.

`test:ci`: **2635 specs**, and the baseline of **6** confirmed by name at seed **02525**.

✅ **New and useful: you can pin the seed.** `tests/SpecRunner.html:41-42` reads
`process.env.NOODL_SPEC_SEED`, so `NOODL_SPEC_SEED=31954 npm run test:ci` reproduces an order. This
session used it as a **control**: ELO-001's change came back 12 at seed 31954 and 6 at 02525, and
BEN-001 *reads* `getPorts` — so "it's order-dependent" was not good enough. Re-running **31954 with the
change reverted** returned 14. BEN-001 fails at that seed either way. One run, and the change is
exonerated instead of argued about. **Do this whenever the extra failures plausibly touch what you
changed.**

⚠️ `typecheck:runtime` is **still red and still not this work** — the same two files, both untouched:
`packages/noodl-runtime/test/editorconnection.replyidentity.test.ts:23` and
`…/editorconnection.sendqueue.test.ts:24` redeclare `EditorConnection`. Ten minutes for someone; **do
not let it read as a regression.**

⚠️ **These gates ran on a tree carrying a concurrent session's uncommitted work** — `noodl-core-ui/`,
`ProjectsPage/`, `ExtractToComponent*`, `ComponentsPanelNew/`, `models/template/`, and (new, appearing
mid-session) `views/ConnectionPopup/ConnectionBar.tsx` and `ConnectionPopup.module.scss`. The baseline
matched by name exactly, so it perturbed nothing — but say so if you inherit the numbers.

### Incidental, unrelated

- **One node with an undefined type name still takes down the whole editor document.** `Puppy test 3`
  gives an "Aw, Snap!" boundary — `UnknownNodeType.localName` does `this.name.split('/')` with
  `this.name` undefined (`models/nodelibrary/UnknownNodeType.ts:6`). Carried over from the last
  handover; still unfixed. **This is now an obvious ELO-track candidate** — it is the same
  UnknownNodeType, in the same boot window.
- A renderer `SyntaxError: Unexpected token '<', "<!DOCTYPE "… is not valid JSON` appears in
  `.logs/dev.log` on editor boot. Something fetches a URL that 404s to an HTML page and parses it as
  JSON. Not investigated; unrelated to the canvas.

---

Paste the block below into a fresh session.

---

Work on **phase 60** for OpenNoodl/NodeGX. **SIG-001…006 are done.** Two things are open and they are
different in kind: **SIG-006 R3** (a design decision about wire density) and **SIG-007** (gated on a
question for Richard). **Read "Which to do" below before starting either.** Work on `cline-dev`, commit
straight to it, no branches and no PRs.

**Check for a second live session first** (`git log --since="3 hours ago"`, and read untracked files
rather than assuming they are yours) — there was one throughout the last four sessions, on phases
50/54/55/57/58, and it was still committing minutes before this handover. It leaves uncommitted work in
`packages/noodl-core-ui/`, `packages/noodl-editor/src/editor/src/{utils/ExtractToComponent.ts,
views/nodegrapheditor/EditorClipboard.ts, views/nodegrapheditor/ExtractToComponentPopup.*,
views/ConnectionPopup/, views/panels/ComponentsPanelNew/, pages/ProjectsPage/, models/template/}` and
`packages/noodl-editor/tests/`. ⚠️ **`views/nodegrapheditor/` holds both their untracked
`ExtractToComponentPopup.*` and yours, and `views/ConnectionPopup/` is now theirs too — never pathspec
either directory, name the files.** Pathspec-scope every `git add` **and** every `git commit`, and
**never stash**.

Read these first, in this order:

1. `dev-docs/tasks/phase-60-values-and-signals/README.md` — the phase and its **four premise
   corrections**, every one read in source. Do not re-derive them.
2. `dev-docs/tasks/phase-60-values-and-signals/TASKS.md` — the ordering, and **"What SIG-006 settled,
   and what it left"**.
3. `dev-docs/tasks/phase-60-values-and-signals/SIG-006-WHICH-WAY-DOES-THIS-WIRE-GO.md` — **its
   Register, and "What was measured".** R3 is the open design decision and is written up there.
4. `packages/noodl-editor/src/editor/src/views/nodegrapheditor/wireEndpoints.ts` — **its header carries
   the shape reasoning and the fill-ratio table.** Anything new on a wire end goes through it.
5. `dev-docs/tasks/editor-load-ordering/README.md` — the ELO track, one task closed, and the rule it
   exists to state: **a value derived while the node library was empty is a "don't know yet", and
   `[]` is truthy.**

## Which to do

**SIG-007 is gated on a question, not on code.** Its §0 says to ship 001–006, put the result in front
of the same user, and ask whether he still wants to bend wires — because manual routing is what people
reach for when they cannot tell what a wire is or where it goes, which is exactly what 005 and 006
address. **006 has now shipped, so the question is finally askable.** It is also the only task in the
phase that changes what a connection is **on disk**. **Do not start it without that answer.**

So unless Richard has answered: **SIG-006 R3 is the work**, and it is a *design* task — decide whether
a wire states its direction in its middle, and at what density cost. Measure on a real graph, not a
two-node example. If the answer is "no", say so and close R3 rather than leaving the criterion
ambiguous.

⚠️ A third option, if neither appeals: the **ELO track** has an obvious second task — the
`UnknownNodeType.localName` crash above. Same class, same boot window, and it takes down the whole
document.

## Standing constraints for this phase

- 🔴 **Dark is the binding theme for anything painted on a wire.** Light is binding for text on a
  panel. Do not inherit the wrong one.
- **Wire colour already carries four meanings** — type, health, pulse, diff annotation — and
  `NodeGraphEditorConnection.ts:625-627` explicitly refused to make selection a fifth, using stroke
  weight instead. **New information goes in shape, weight or motion. Never a sixth colour.**
- **Red is danger only.**
- ⚠️ **Glyphs on the canvas are painted at constant screen size** via `glyphScaleFor`. Anything new
  that must survive zoom-out goes through it, or it halves with the content.
- ⚠️ **The canvas animation flag is reason-counted.** `startNodeAnimations(reason)` /
  `stopNodeAnimations(reason)`. Passing no reason takes the default `'nodes'` hold and will fight the
  AI assistant.
- ⚠️ **`endpointHitRadius` is 8 against a painted radius of 3**, deliberately, for CAN-003 endpoint
  dragging. An arrowhead is paint, not a target.

## Driving and measuring

Use the `run-editor` skill. The mechanics are in memory under **`reaching-editor-modules-over-cdp`**
and **`a-boot-window-defect-erases-its-own-evidence`**; the short version:

- ✅ **`ed.layoutAndPaint()` paints synchronously**; `ed.repaint()` only schedules a
  `requestAnimationFrame`, which an occluded window clamps ~1000×. Force the frame and read
  `getImageData` in the same `eval`.
- ✅ **The graph context is `ed.canvas.ctx`, not `document.querySelector('canvas').getContext('2d')`** —
  and `ed.canvas.ratio` is the device ratio. Screen px = `(graph + pan) * scale * ratio`.
- ✅ **To compare two glyphs, measure a *profile*, not a crop.** A box around an endpoint contains the
  wire as well, and the wire is the same colour, so areas and bounding boxes say almost nothing. The
  width **across** the wire at the endpoint separates a circle (widest there) from an arrowhead (a
  point there) completely.
- ⚠️ **`ed.clearSelection(); ed.highlighted = null; ed.setHighlightedConnection(undefined);` first**, or
  you measure the highlighted colours and the hover mark.
- ⚠️ **The CDP `eval` context persists between calls** — a second `const s = …` throws
  "Identifier 's' has already been declared". Wrap every probe in `(() => { … })()`.
- ⚠️ **`npm run cdp -- eval "$(cat file.js | tr '\n' ' ')"` silently comments out the rest of the file**
  at the first `//`. Strip comment lines first, or the whole probe becomes one line ending in a
  comment and you get `SyntaxError: Unexpected end of input`.
- ⚠️ **`cdp click <selector>` matches the FIRST element for that selector.** Tag the one you want with
  a unique `id` in an `eval` first.
- Clean up anything you add to Richard's projects, and confirm the removal **on disk** — back
  `project.json` up first and check the SHA afterwards.

## Gates

`dev:stop` **before** `test:ci`; **measure `test:main`, never inherit its number**; only the
`Jasmine:` line counts, and match failures **by name** — the baseline is **6** (4 × `AIX-006 style
vocabulary`, 2 × `AI model registry`), reaching 12 when the order-dependent BEN-001 cluster fails.
✅ **`NOODL_SPEC_SEED=<seed> npm run test:ci` pins the order** — when the extra failures plausibly touch
what you changed, do not settle for a clean run at another seed; **pin the failing seed and revert your
change.** **Record the seed.** ⚠️ `test:ci` takes 10–15 minutes and its output is large — redirect it to
a file and grep, because a truncated tail loses the `Jasmine:` line and the seed. ⚠️ A sub-minute exit-1
at the webpack stage is transient; re-run it. ⚠️ `typecheck:runtime` is already red on two untouched
test files — do not chase it.
