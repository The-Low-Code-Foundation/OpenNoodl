# NOTES — VFN-011, the bench

**Branch:** `vfn-bench`, forked from `cline-dev` at `76dfece7`.
**Three commits**, each one landable on its own:

| | |
|---|---|
| `4420812e` | Part 1 — the strip names its reason |
| `e1219147` | The drift gate, and the runner it grades — **before** any UI |
| `8d4bf513` | The bench: sandbox values, ▶ per signal, Run |

**Gate:** `cd packages/noodl-editor && npx jest` → **160 suites / 2310 passing**
(baseline 157 / 2265; +3 suites, +45 cases, no name changed).
`npx tsc -p tsconfig.json --noEmit` → clean, and *proved to cover the changed files* by appending
`const __probe: number = "not a number"` to `InterfaceRailsOverlay.ts` and watching it go red.

---

## 🔴 What is proved, and what is not

⚠️ **Written before any drive; kept as written, with the outcomes marked in the list below.** Session C
has since driven four of the nine owed items and the flagship gesture works — read the ✅ marks.

Nothing here had been driven when this was written. This worktree cannot run the editor (`npm run dev` resolves through
`lerna exec` to the primary checkout, where a human is working), so **every claim below is either a
headless spec or an owed drive**, and they are separated on purpose.

### Proved by spec

| Criterion | Where | What is actually asserted |
|---|---|---|
| **4 — the drift gate passes over the fixture** | `tests-unit/vfn-011/drift-gate.spec.ts` | 8 programs through `runOnBench` **and** through the runtime's real `_executeLogic`; outputs, signals, refusals and the recorded frame all diffed. Four negative controls. |
| **2 — the frame is a viewer frame** | same, + `bench.spec.ts` | The frame is built by the runtime's **own** `createBlockRunRecorder`, so it cannot be a lookalike. `sandbox: true` is the only addition. |
| **5 — a throw reports its block** | `bench.spec.ts` | `errorBlockId` is the block id; `controller.run` does not throw; the failed run is still in the scrubber with a note. |
| **8 — nothing writes to the program** | `bench.spec.ts` | Serialised workspace **byte-identical** across two `setText` + two `run`, asserted beside proof that two runs happened. |
| **6 — the empty strip names its reason** | `strip-reason.spec.ts` | Seven reasons, the precedence between them, and a negative control that rebuilds the old line and reproduces the reported silence. |
| The bench enumerates no ports | `bench.spec.ts` | A workspace mutation moves the bench's rows with nothing telling it. |

### Owed a live drive — **updated after DRIVE-2026-08-13-C; four of nine are closed**

⚠️ The list below was written before any drive. Session C drove items 1, 2, 3 and 5 and closed them;
lane D closed item 7. **Items 4, 6, 8 and 9 remain owed**, plus one screenshot the copy trim added.
See [DRIVE-2026-08-13-C.md](DRIVE-2026-08-13-C.md) and
[NEXT-SESSION-2026-08-13-F.md](NEXT-SESSION-2026-08-13-F.md).

1. ✅ **CLOSED — criterion 1 end to end.** The spec proves value-in → value-out of `outputRows()`. It
   does not prove the cell is typeable, the ▶ clickable, or that a value appears in the rail. **The
   drive did**: typed into a cell, pressed ▶, and the strip read *"Run 1 of 1 · live — Sandbox run —
   sandbox — not your app's data."* **The flagship works.**
2. ✅ **CLOSED — the badges.** This was filed as the half of criterion 1 *"most likely to be quietly
   wrong"*: `pushFrame` requests a paint through the existing scheduler, and `markFor` should badge a
   sandbox frame exactly as a live one — but a bench frame had never reached `BlockValueBadgeLayer`.
   It does. **Five badges painted, values `7, 3, 21, 7, 7`.**
3. ✅ **CLOSED — criterion 8 on disk**, and *not* a vacuous pass. The spec proves the *workspace
   string* is unchanged; `project.json` is one level up and is byte-identical after a bench session.
4. 🔴 **OWED — criterion 7 with a preview running.** Two sources into one history has never been
   exercised with both live. A viewer frame and a bench frame interleaved in the scrubber is the case.
5. ✅ **CLOSED — the 152 px rail fits.** `.RailCell` is `width: 100%; box-sizing: border-box` inside a
   rail whose `overflow` is `hidden`; the arithmetic said 132 px of content box and the drive agrees.
   ⚠️ If it ever needs more room, `.Rail`'s width is **also** hard-coded in
   `views/nodegrapheditor/logicOverlayGeometry.ts` — changing one without the other is a defect.
6. 🔴 **OWED — the focus-preserving repaint.** `paint()` remembers which cell was focused and where the caret
   was, and restores it after `replaceChildren`. Rails refresh on *every* settled Blockly change,
   so this runs constantly, and it is exactly the sort of thing that measures fine and feels wrong.
   ⚠️ Related register entry: `document.activeElement` is stale in a bubble-phase handler. This
   reads it at the *top* of a synchronous repaint, not from a handler, so it should be sound — but
   "should be" is why it is on this list.
7. ✅ **CLOSED — the two new strip sentences at real widths.** This was right, and it was worse than
   it says. The drive rendered *"…Press ▶ Run below to work them out here, with the app stop…"* —
   the teaching half gone — and a headless measurement (`scripts/devtools/text-advance.js`, glyph
   advances out of the system font; `tests-unit/vfn-011/strip-copy.spec.ts`) then found **six of the
   seven** sentences clipping at the window's 640 px minimum, with `no-node` the longest at 802 px
   against 564 px of room. All seven are trimmed and budgeted; see VFN-011's task file for the
   before/after table. 🔴 Two things this note got wrong, worth keeping: the risk was filed against
   *"the two new sentences"* when five of the seven were already too long before this task touched
   them, and `attached-idle` — the reported one — was only the **second** longest. Still owed: one
   screenshot at a 640 px window, because the budget is arithmetic with a ±5% band.
8. 🔴 **OWED — a genuinely stale node.** `no-probes` needs a project containing a Visual Function whose
   `generatedCode` predates LGC-003 and which has not been edited since. I have not found one; the
   branch has only been exercised with a hand-written string.
9. 🔴 **OWED (partly observed) — Part 1's `generatedCode` thread.** It runs property panel →
   `LogicBuilder.OpenTab` → `Tab` → `BlocklyWorkspace` → `attachBlockValues`. Every hop typechecks.
   Session C observed badges carrying values, which exercises part of the thread but does not grade
   it end to end.

---

## Two findings, neither of them mine to fix

### 🔴 The runtime reports a reserved `send signal` in two directions at once

Found **by the drift gate**, not by reading — the differential went red on the reserved-output
fixture and the reason turned out to be about the *signal* path.

`_executeLogic` handles the two reserved-name doors differently:

- a reserved **output value** is caught after the write loop, `_fail`s, and **returns** — so
  `executionError` stands and the node reports a failure;
- a reserved **`send signal`** fails from inside `_createExecutionContext`, *during* the run. The run
  then continues, and eleven lines later the success path executes
  `internal.executionError = null; … this.sendSignalOnOutput('success')`.

So a block program that sends `done` pulses **`Failure` and `Success`**, raises a runtime error, and
ends with an empty `error` output. A graph sequenced on either signal gets a true answer and a graph
reading `error` gets a blank one.

`BenchRunner` **mirrors this rather than correcting it** — a bench that quietly improved on the app
would be the second truth the gate exists to prevent — and says so in a comment at the mirroring
line. Worth its own task.

### ⚠️ `Noodl.Variables["x"] = 1` is probably not what the app does

`NoodlGenerators` emits `Noodl.Variables["name"]` for the variable blocks. In the app,
`Noodl.Variables` is `Noodl.Object.get('--ndl--global-variables')` — a **Model**, whose values live
behind `get`/`set` and whose change events are what a `Variable` node listens to. A bare property
assignment on a Model instance sets a JavaScript property; it is not obvious it notifies anything.
`Noodl.Objects[id]["prop"]` has the same shape one level down.

The bench's stubs are plain objects with the same *program-visible* subscript semantics, so the
drift gate agrees — because it hands both sides the same stub. **The gate is about the compile path
and deliberately does not vary the data**, so it cannot see this, and it is not evidence either way.
Not investigated. Filed rather than guessed at.

---

## Design decisions worth not re-litigating

**The bench regenerates at Run time; it does not read the node's saved `generatedCode`.** The two
differ for exactly the 300 ms save debounce, and during that window the blocks on screen are what the
builder means. The generation *expression* is the flush's own — extracted into `generateProgram()` in
`BlocklyWorkspace.tsx` and injected into `BenchController` — so it is the same function over the same
workspace with the same probes, not a second code path. This is why `no-probes` and the bench
disagree, and the disagreement is correct: that reason is about what the **app** would run.

**`STATUS_COPY` moved to `BlockValueTrace.ts`.** Words are a decision and this module's own docstring
already says decisions live on the graded side. Re-exported from `BlockValueController`, so no
import moved.

**The bench hint is appended, not written into the copy.** Whether "press ▶ Run below" is true
depends on whether this mount has a Run button, which is a per-mount fact. A build where one exists
without the other must not have the other lying about it — LGC-002's "a control that is there and
does nothing" arriving as copy instead of as a control.

**One history, one scrubber.** A second store for sandbox runs would give the badges two sources.
The note travels in a `WeakMap` keyed by the frame rather than as "the last note", because
criterion 7 asks that a sandbox run be distinguishable *while scrubbed back to it*, and a single
current note would say "sandbox run" over whatever frame was selected next.

---

## Where I stopped, and what is next

⚠️ **Updated:** the drive happened. Items 1, 2, 3, 5 are closed and item 7 found a real defect that
lane D fixed. **Items 4, 6, 8, 9 are still owed**, plus a screenshot of the trimmed strip at 640 px.

The code is complete against all eight acceptance criteria. What is missing is entirely the **drive**
— items 1–9 above, in that order. The first four are the ones that could still show the feature does
not work; 5–7 are polish that will need one round of adjustment; 8–9 are coverage of paths that are
built but unobserved.

Suggested next session, in the primary checkout after merge:

1. `dev:debug`, open the QA fixture's Visual Function with the app **stopped**.
2. Type into a cell, press ▶, screenshot the rails **and** the badges.
3. `git diff --stat` on the project — criterion 8, on disk.
4. Start a preview, trigger the node, scrub between the live frame and the sandbox one.
5. Read the strip's note at the pane's real width and trim the copy if it ellipsises.
