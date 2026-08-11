# Phase 60 — next session

**Written 2026-08-11**, at the end of the session that closed **SIG-005**.
**5 of 7 are done — SIG-001, 002, 003, 004, 005.** That is the whole of *what a wire means*, plus the
first of *what a wire looks like*.
**The next session's job is R8 and then SIG-006** — and R8 comes first for a reason given below.

Commit: `7e614ba0` (the painter, the module, 21 specs, four docs).
Remaining: **006, 007** — and **R8**, which is new and is not either of them.

## What this session did, so you do not redo it

The pulse was never broken. It was built, enabled by default, and **fires correctly end to end** — a
real click in the preview puts the connection's id on the channel and the editor paints it, verified
by driving it, not by reading it. What it was, was invisible.

| theme | wire | pulse over it | before | after |
|---|---|---:|---:|---:|
| **dark** | `#35c3e8` signal | `#b6e4f2` | **1.48:1** | 1.84 core / **17.19 flank** |
| **dark** | `#45d08a` value | `#a7e2c9` | **1.43:1** | 1.75 core / **17.19 flank** |
| light | `#0e9cc4` signal | `#145269` | 3.25:1 | **5.09** core / 14.35 flank |
| light | `#1e9e63` value | `#1a463b` | 3.09:1 | **4.74** core / 14.35 flank |

Measured on composited canvas pixels, four dash phases before / three points along the travel after,
in the running editor on `lib21-qa` with a purpose-built Button → `String.saveValue` (signal) and
`String.savedValue` → `Text.text` (value) pair. The fixture was removed from the project afterwards
and the removal confirmed on disk.

### The five things worth carrying

1. 🔴 **"Light mode is the binding constraint" is about text on a panel. For anything painted ON a
   wire, dark is binding and it inverts.** `wirePulse` is `--theme-color-fg-highlight` — near-white in
   dark, near-black in light. A wire is *already* a bright saturated colour at 9.3:1 against the
   ground, so in dark there is nowhere lighter for a mark to go; in light the same token is near-black
   and moves a great deal. **Check the dark number first.**
2. 🔴 **≥3:1 against a dark-theme wire is unreachable by any colour, and the task says so rather than
   reporting around it.** It requires a mark *darker* than the wire, and on a near-black ground a dark
   mark on a bright wire is indistinguishable from a **gap** — which is what an unhealthy wire's `[5]`
   dash already means. The mark went to **weight** and is measured against the **ground on its
   flanks**. Same shape as SIG-003's mixed-kind headings: *an acceptance criterion applied literally
   would have made it worse.*
3. ✅ **Splitting signal from value cost no protocol change.** The runtime genuinely cannot tell them
   apart — `connectionSentSignal` wraps `connectionSentValue` and `sendPulsingConnections` flattens the
   map to a bare array of ids. But **the editor already resolves the source port's type one line above
   the pulse block.** A signal now gets **one round-capped bead running source → target** (a moment has
   a position); a value gets **the repeating dash along the whole wire** (a value connection is live
   everywhere at once). Distinguishable in a still frame, which was the acceptance.
4. ⚠️ **The old mark could never have travelled.** `offset = life / 20` is 50 px/s and a pulse is
   visible for ~600 ms, so on a 300 px wire it left the source and was deleted ~250 px short of
   arriving. It was marching ants, not a travelling mark. The new one crosses in 420 ms.
5. 🔴 **R8, below.** Found while measuring, filed rather than fixed.

### 🔴 R8 — the defect this session filed and did not fix

**On a fresh open of a project, every connection in the component the editor lands on has
`fromPort === undefined`.** So `NodeLibrary.nameForPortType` returns undefined,
`CanvasTheme.connectionColors` falls through to the *data* pair, and **a signal wire is painted green
instead of cyan.** `wirePulseKind` falls to `'value'` too.

```js
ed = window.__nodeGraphEditor
ed.connections.map(c => c.fromProperty + ':' + (c.fromPort ? 'ok' : 'UNRESOLVED'))
// ["onClick:UNRESOLVED", "savedValue:UNRESOLVED"]        <- lib21-qa, /#__page__/Home, on open
```

It **self-heals the moment you navigate**, which is why nobody has ever reported it — switch to
another component and its wires read `onClick:ok/signal`, and switching *back* resolves the first
one's. `resolvePorts()` (`NodeGraphEditorConnection.ts:104`) has no guard and no retry; the re-resolve
that exists (`EditorEventBindings.ts:58-70`, on `libraryUpdated`/`typeAdded`) has either already fired
or is not yet bound at initial `render()`. Both paths go through the same `bindModel()`, so the
difference is purely **when**.

This is **phase 60's own premise failing in the one graph every builder sees first**: *a wire has a
kind, and the editor draws it* — here it draws it wrong. Recorded as SIG-005 **R8** and SIG-006 **R2**.

### Gates, measured on the settled tree

`typecheck:editor`, `typecheck:editor-tests`, `typecheck:viewer`, `typecheck:cloud` **clean** ·
`test:main` **116 suites / 1632 tests green** (was 115/1611; +1 suite, +21 specs, all this task's) ·
`lint:ci` **869 errors against a 3916 baseline** ·
`test:ci` **`Jasmine: 2632 specs, 6 failures` at seed 90638** — the recorded baseline, confirmed **by
name**: four `AIX-006 style vocabulary`, two `AI model registry`. Spec count unchanged at 2632, which
is correct: this task's 21 specs are Jest and live in `test:main`.

⚠️ **`typecheck:runtime` is still red and it is still not this work** — re-measured at the end of this
session, same two files, both unmodified in the diff:
`packages/noodl-runtime/test/editorconnection.replyidentity.test.ts:23` and
`…/editorconnection.sendqueue.test.ts:24` both redeclare `EditorConnection`. Pre-existing; ten minutes
for someone; **do not let it read as a regression.**

⚠️ **The first `test:ci` attempt died at the webpack stage in under a minute with no output at all.**
A bare re-run of the same bundle compiled successfully in 45 s, and the full re-run gave the baseline
above. If you see a sub-minute exit-1 with a truncated log, re-run before investigating.

⚠️ **These gates ran on a tree carrying a concurrent session's uncommitted work** (see below). The
baseline matched by name exactly, so it perturbed nothing — but say so if you inherit the numbers.

### Incidental, unrelated to this phase

**One node with an undefined type name takes down the whole editor document.** Opening `Puppy test 3`
gives an "Aw, Snap!" error boundary — `UnknownNodeType.localName` does `this.name.split('/')` and
`this.name` is undefined (`models/nodelibrary/UnknownNodeType.ts:6`). An unknown *type* is supposed to
render as an unknown-node card; an unknown type with no name string kills `EditorDocument` instead.
Not investigated further.

---

Paste the block below into a fresh session.

---

Work on **phase 60** for OpenNoodl/NodeGX — **R8 first, then SIG-006**. Work on `cline-dev`, commit
straight to it, no branches and no PRs. **Check for a second live session first**
(`git log --since="3 hours ago"`, and read untracked files rather than assuming they are yours) —
there was one throughout the last three sessions, on phases 50/54/55/57/58, and it was **still
committing 15 minutes before this handover was written** (`08c2b85a` reconciling four LEG branches,
`fb696b0d` phase-54). It leaves uncommitted work in `packages/noodl-core-ui/`,
`packages/noodl-editor/src/editor/src/{utils/ExtractToComponent.ts,
views/nodegrapheditor/EditorClipboard.ts, views/nodegrapheditor/ExtractToComponentPopup.*,
views/panels/ComponentsPanelNew/, pages/ProjectsPage/, models/template/}` and
`packages/noodl-editor/tests/`. ⚠️ **`views/nodegrapheditor/` holds both their untracked
`ExtractToComponentPopup.*` and your files — never pathspec that directory, name the files.**
Pathspec-scope every `git add` **and** every `git commit`, and **never stash**.

Read these first, in this order:

1. `dev-docs/tasks/phase-60-values-and-signals/README.md` — the phase and its **four premise
   corrections**, every one read in source. Do not re-derive them.
2. `dev-docs/tasks/phase-60-values-and-signals/TASKS.md` — the ordering, and **"What SIG-005 settled,
   and what it left"**.
3. `dev-docs/tasks/phase-60-values-and-signals/SIG-005-THE-SIGNAL-TRAVELS.md` — **its Register, R5
   through R8 only.** R8 is your first job and it is written up there with the reproduction.
4. `dev-docs/tasks/phase-60-values-and-signals/SIG-006-WHICH-WAY-DOES-THIS-WIRE-GO.md` — the task.
   **Read R2 before measuring anything about wire colour.**
5. `packages/noodl-editor/src/editor/src/views/nodegrapheditor/wirePulse.ts` — **its header carries the
   measurements and the reasoning**, and its API is what SIG-006 item 4 calls.

## Why R8 comes before SIG-006

SIG-006 is *the task about telling wires apart*. R8 means the first graph a builder opens is telling
them apart **wrong** — a signal wire painted in the data colour. Shipping direction cues onto a canvas
that is mis-stating kind is building on sand, and any measurement of wire colour taken on that graph
is measuring the wrong pixels.

**It is not a phase-60 task and should not be filed as one.** Give it its own spec — an editor
load-ordering fix with a gate — or land it as a scoped fix with a regression spec. ⚠️ **Prove the gate
red by injection before trusting it green**, the way SIG-003's `catalog:groups:check` had to be: its
first version read a field its source lacked and printed a confident `✓ 0`.

⚠️ **If R8 turns out larger than it looks, stop and say so.** SIG-006's items 1–3 (the endpoint glyphs,
the node-side dot/arrow, and what `'both'` paints) do not depend on it — only the colour-adjacent parts
do. Do those and leave the rest, rather than half-fixing load ordering.

## What SIG-005 hands SIG-006

✅ **`wirePulse.ts` is THE travelling-mark implementation. Item 4 calls it. Writing a second one is
the exact failure the 005-before-006 ordering existed to prevent.**

- `travellingHeadRange(ageMs)` → `{from, to}` in bezier `t`; `samplePolyline(pointAt, from, to)` →
  points. **It takes the point function as an argument** precisely so a hover can drive it — all you
  supply is the age (time since the pointer entered, instead of `performance.now() - created`).
- ⚠️ **The mark travels source → target because `curve[0]` is the source**, the same array the endpoint
  dots are painted from. So item 1's arrowhead and this mark cannot disagree about which end is which.
- ⚠️ **Decide what a hovered *value* wire does, out loud.** SIG-005 gave a signal one bead and a value
  a repeating dash *on purpose*. Hover asks a different question ("which way?"), so it may want the
  bead on both — that is a third state on one painter and it needs a decision, not an inheritance.

## Standing constraints for this phase

- 🔴 **Dark is the binding theme for anything painted on a wire** (finding 1 above). Light is binding
  for text on a panel. Do not inherit the wrong one.
- **Wire colour already carries four meanings** — type, health, pulse, diff annotation — and
  `NodeGraphEditorConnection.ts:625-627` explicitly refused to make selection a fifth, using stroke
  weight instead. **New information goes in shape, weight or motion. Never a sixth colour.**
- **Red is danger only.**
- ⚠️ **`portIcons.ts` is a complete glyph table imported by nothing.** SIG-006's acceptance says it is
  **either imported or deleted at the end of this task**. Do not start a third vocabulary beside it and
  the painter's `dot`/`arrow`.
- ⚠️ **`endpointHitRadius` is 8 against a painted radius of 3**, deliberately, for CAN-003 endpoint
  dragging. Changing the paint must not silently change the grab. An arrowhead is paint, not a target.

## Driving and measuring

Use the `run-editor` skill. The mechanics that cost this session real time are in memory under
**`reaching-editor-modules-over-cdp`**; the short version:

- ✅ **`ed.layoutAndPaint()` paints synchronously.** `ed.repaint()` only schedules a
  `requestAnimationFrame`, which an occluded window clamps ~1000×. Force the frame yourself and read
  `getImageData` in the same `eval` — this sidesteps the occlusion trap entirely and beats screenshot
  timing.
- ✅ **Three-frame stability mask, then filter to the wire's own token colour.** A plain two-frame diff
  produced a confident `#ffffff` on `#000000` = 21:1 that was not the thing under test. Print the
  foreground and background hex beside every ratio.
- ⚠️ **The node-graph canvas is transparent where the ground shows through** — the ground is CSS on the
  element behind it. `getImageData` gives you `#000000, alpha 0` there. Fill your own ground before
  rendering a crop for evidence.
- ⚠️ **Sample the animation phase, not multiples of its period.** `lineDashOffset` 0 / 20 / 40 against
  a `[5, 15]` dash are the same phase, and produced three byte-identical "measurements at three points
  along the travel".
- ⚠️ **`ed.clearSelection(); ed.highlighted = null;` first**, or you measure `wireSignalHighlighted`.
- ⚠️ **Reaching a non-exported module:** `window.webpackChunknoodl_editor.push([...])` works, but
  **never require `projectmodel.ts` that way** — it re-evaluated the module and dropped the editor back
  to the launcher mid-session. Reach the project off the editor: `ed.model.owner` is the ComponentModel,
  `ed.model.owner.owner` is the project.
- ⚠️ **`cdp click <selector>` matches the FIRST element for that selector.** Tag the one you want with
  a unique `id` in an `eval` first — clicking a class opened the wrong project.
- ⚠️ **A preview page is `overflow-y: clip`.** You cannot scroll to a control below the fold; reorder
  the node to the top of the page's children instead.
- Clean up anything you add to Richard's projects, and confirm the removal **on disk**, not just in the
  model.

## Gates

`dev:stop` **before** `test:ci`; **measure `test:main`, never inherit its number**; only the
`Jasmine:` line counts, and match failures **by name** — the baseline is **6** (4 × `AIX-006 style
vocabulary`, 2 × `AI model registry`), reaching 12 when the order-dependent BEN-001 cluster fails, so
re-run at another seed before investigating. **Record the seed.** ⚠️ `test:ci` takes 10–15 minutes and
its output is large — redirect it to a file and grep, because a truncated tail loses the `Jasmine:`
line and the seed. ⚠️ A sub-minute exit-1 at the webpack stage is transient; re-run it. ⚠️
`typecheck:runtime` is already red on two untouched test files — do not chase it.

## After SIG-006

**SIG-007 is gated on a question, not on code.** Its §0 says to ship 001–006, put the result in front
of the same user, and ask whether he still wants to bend wires — because manual routing is what people
reach for when they cannot tell what a wire is or where it goes, which is precisely what 005 and 006
address. It is also the only task in the phase that changes what a connection is **on disk**. **Do not
start it without that answer.**
