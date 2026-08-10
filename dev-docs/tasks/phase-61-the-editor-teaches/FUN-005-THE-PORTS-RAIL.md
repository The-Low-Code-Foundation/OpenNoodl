# FUN-005 — The ports rail: the notation becomes something you click

**Status:** 📋 open · **Track: the affordance** · depends on FUN-003 and FUN-001 · this is Richard's
*"visual things you can click that add the `Inputs` for you"*

## Why clicking beats knowing

FUN-002 gives a beginner something to imitate and FUN-004 catches them when they guess wrong. Both
still require **recall** — knowing that the prefix exists at the moment of typing. A rail replaces
recall with **recognition**, which is the difference between a notation you must be taught and one
you cannot avoid noticing.

It is also the only task here that stays useful after the notation is learned: clicking a port is
faster than typing it, and it cannot misspell one.

## §1 — What it is

A slim column down one edge of the code editor popout, listing **this node's ports** — the union of
FUN-003's declared list and `minePorts`' mined list, grouped Inputs and Outputs, each row showing the
name and its type.

Clicking a row inserts at the caret, via FUN-001's builders:

| Row | Inserts |
|---|---|
| an input | `Inputs.Value` |
| an input whose name is not an identifier | `Inputs["My Value"]` |
| a **value** output | `Outputs.Result = ` — caret left after the `=` |
| a **signal** output | `Outputs.Done()` |

⚠️ **The value/signal distinction is the whole reason a rail beats a snippet menu.** A signal output
is a *call*, a value output is an *assignment*, and the runtime types them differently based on which
shape it finds in the text
([`javascriptnodeparser.js:353-366`](../../../packages/noodl-runtime/src/javascriptnodeparser.js)).
A user who writes `Outputs.Done = true` when they meant a signal gets a value port named `Done` and a
node that never fires. The rail gets this right for free, every time, because it knows the type.

Rows should be **draggable** into the document as well as clickable — Blockly users and anyone who
has used a snippets panel will try it, and CodeMirror handles the drop.

## §2 — Creating a port without leaving

Below the two groups, one control per group: **+ Input**, **+ Output**.

It does not open the property panel. It inserts the notation with the name selected for typing —
`Inputs.newInput` with `newInput` as the selection — because **that is what creating a port is**
([`javascriptnodeparser.js:294-387`](../../../packages/noodl-runtime/src/javascriptnodeparser.js)).
The port appears on the node as the user types the name.

This is the single most direct demonstration of the phase's central fact, and it costs one button.

⚠️ For an output, `+ Output` must ask value-or-signal, or offer two buttons, because there is no
neutral insertion — the shape *is* the type. Two buttons is the smaller answer.

## §3 — Live values, and the honest limit

While the app is previewing, each input row shows its current value; each output row shows what was
last written to it.

This is the piece that turns the notation from syntax into meaning: seeing `Value = "hello"` beside
the code is what makes `Inputs.Value` stop being a magic word. It is also, for the same reason, the
most likely thing in this phase to be believed when it is wrong.

⚠️ **Constraints, all of them real:**

- **The values live in the viewer, not the editor.** The node's `_internal.inputValues` is in the
  preview frame; nothing in the editor window has them. This is the same separation that made a
  previous dynamic-port implementation unreachable, and it means the rail needs the relay, not a
  local read.
- **Formatting is the `previewValue` display dialect, not JSON.** This repo has already shipped a
  defect from treating it as JSON once. Strings quoted, objects summarised.
- **No value is not the same as `undefined`.** "Not running" and "running, and this input is
  undefined" are different facts and a beginner will read a blank as the second. Say which.
- ⚠️ **Occluded Electron fires zero `ResizeObserver` events and clamps timers ~1000×.** Any headless
  verification of a live-updating rail needs a screenshot to force a frame, or it will report an
  empty rail that is actually fine.

**§3 is separable.** Ship §1 and §2 first; they need no runtime connection at all. If §3 slips, the
rail is still the best affordance in the phase.

## §4 — Where it goes, and what it must not break

The popout is sized from `localStorage['codeeditor_size_percentage']` with a 60%×70% fallback
([`CodeEditorType.ts:169-187`](../../../packages/noodl-editor/src/editor/src/views/panels/propertyeditor/CodeEditor/CodeEditorType.ts)),
and rendered inside a `flushSync` so `showPopout` can measure real content — a deliberate fix for
FH-005, where an unmeasured popout opened below the fold.

⚠️ **The rail is inside that measurement.** A rail that lays out asynchronously reintroduces the
0×0 measurement and the offscreen popout. Render it synchronously with the editor.

Collapsible, remembering its state in the same `localStorage` neighbourhood. An expert who does not
want it should be able to fold it to a strip once and never see it again.

⚠️ **Two CSS traps this repo has paid for**: an `HStack` forces `height: 100%` on itself and stretches
its children, which overflows a block parent by exactly the offset; and **an undefined CSS-module
class renders no class at all**, so a mistyped rail class produces a row that is unmeasurable rather
than visibly wrong. Both cost a session before.

## Acceptance

- The rail lists this node's ports — panel-declared and code-mined, deduplicated — grouped and typed.
- Clicking a **signal** output inserts a call; clicking a **value** output inserts an assignment.
  Verify by running the node, not by reading the text.
- A port whose display name contains a space inserts bracket notation, and `minePorts` mines it back
  as the same port.
- **+ Input** followed by typing a name puts a matching port on the node, with no visit to the
  property panel.
- Opening node A's editor, closing it, then opening node B's shows **B's ports** (this is FUN-003's
  clearing defect, and the rail is where it becomes visible).
- The popout still opens fully on screen when launched from the **bottom row** of a long property
  panel — the FH-005 regression check.
- Collapsing the rail survives a reopen.
- §3 only: with the app previewing, an input row shows the live value; stopping the preview says
  "not running" rather than blanking.

## Register

| # | Finding | State |
|---|---|---|
| F16 | Signal vs value output is a **shape** difference in the text, so an inserter that knows the type prevents a class of silent defect a snippet menu cannot | ✅ verified, `javascriptnodeparser.js:353-366` |
| F17 | The popout is rendered under `flushSync` specifically so it can be measured; asynchronous rail layout reopens FH-005 | ✅ verified, `CodeEditorType.ts:208-212` |
| F18 | Live values require the relay — `_internal.inputValues` is in the viewer frame, unreachable from the editor window | ✅ known separation; ours to wire |
| F19 | Occluded Electron fires no `ResizeObserver` and clamps timers, so headless checks of §3 need a forced frame | ⚠️ standing environment trap |
