## §63 Tier 2.8 row 13 — `Drag`: the wrapper drags, the child rides (session 86, 2026-09-05)

Type id `Drag`, display name *Drag* — the thirteenth and last row of §50's list. Picker **105 → 106**.

### §63.0 What a Drag is, and what that decides

**The node on disk** (`drag.ts`, `Drag.tsx`, `react-draggable` 4.5.0, the catalog): a VISUAL node (`allowChildren`, `noodlNodeAsProp`)
that renders **no element of its own**. `Drag.tsx` takes the FIRST child (`React.Children.toArray(children)[0]`), returns `null`
with none, and wraps it in a controlled `<Draggable position={state}>`, which `cloneElement`s the child's root with
`style.transform = translate(x px, y px)` and `onMouseDown / onMouseUp / onTouchEnd`; `DraggableCore` adds a native non-passive
`touchstart` on mount and `mousemove/mouseup` (or `touchmove/touchend`) on the owner document for the life of one drag. **Mouse and
touch events, not pointer events** — transcribed as such.

**Inputs**: `axis` (enum x | y | both, default **`x`**), `enabled` (true), `useParentBounds` (*Constrain to parent*, true), `scale` (1),
`inputPositionX/Y` (*Start Drag X/Y*, no default), two snap groups — `snapToPositionX.do` (*Do*), `.value` (*Value*, 0),
`.duration` (300), and the same for Y — plus the generic visual ports (`mounted`, `cssClassName`, `styleCss`, `variant`), inert on a
node that draws nothing. **Outputs**: `onStart` (*Drag Started*), `onStop` (*Drag Ended*), `onDrag` (*Drag Moved*), `positionX/Y`
(*Drag X/Y*), `deltaX/Y`, and the outcome trio `done / failure / completed` shared by both snap actions.

**What the runtime does with them**, read off both files and the library:

- The pointer position is taken in the offsetParent's coordinates (`clientX + scrollLeft − rect.left`; the core's `scale` is 1 —
  `Draggable` strips `scale` before it passes props down), and `createDraggableData` divides the *delta* by `scale` once. With
  `bounds: 'parent'` the new position is clamped against `node.parentNode` (`getBoundPosition`: offsetLeft/Top, clientWidth/Height,
  paddings, margins, borders) and the overshoot is kept as *slack* so the element does not lag the pointer on the way back. `axis`
  gates only what is **flushed to the DOM** (`canDragX`); every callback still reports both axes.
- On mount `x = inputPositionX ? inputPositionX : 0` (falsy → 0), then `positionX(x), positionY(y), deltaX(0), deltaY(0)`. When a
  Start Drag input changes: the raw value into state, `positionX(new)`, `deltaX(new − prev)`.
- `onStart`: outputs (x, y, 0, 0) → the *Drag Started* pulse → both snap timers stopped. `onDrag`: outputs (clamped x, y, delta) →
  *Drag Moved*. `onStop`: the position is committed **on the enabled axes only**, `positionX(data.x)`, `positionY(data.y)`
  (no deltas), *Drag Ended*. So on `axis: x` the *Drag Y* output moves with the pointer while the element does not — kept.
- A snap: `if (state.x === x) return`; else stop the X timer and tween `state.x → x` with `easeOutCubic` over `duration === undefined
  ? 300 : duration` on the runtime's `TimerScheduler` (a duration ≤ 0 jumps in one frame), each frame `setState` and `positionX(value)`
  — no delta. **`Done` fires after every snap call that reached the mounted component, a no-op included** (`outcomeOnInnerComponent`
  reports `done` unless the method returns a string, and neither does); **`Failure` only when the component never mounted**
  (`visual/action-dropped`). The snap *Value* setter abstains on `undefined`/`null`/`''`, raises `drag/snap-position-not-a-number`
  on anything non-numeric and leaves the target alone; *Duration* is stored raw.

**The design — a hook on a wrapper, the listeners on the hook, the snap registers filled on arrival.**

- **`src/lib/drag.ts`** (`src/emit/dragLib.ts`): `useDrag(options, listeners): DragHandle`. The core and the wrapper transcribed —
  mouse + touch, the `react-draggable-transparent-selection` user-select hack, `bounds: 'parent'`, slack, the axis flush rule — and
  `Drag.tsx` on top: the outputs' order, the per-axis commit on stop, the snap registers with the setter's abstain/NaN rules, the
  tween on **`src/lib/animate.ts`'s scheduler transcription** (`createRun / startRun / stopRun / eases.easeOut` — the same
  `TimerScheduler` and the same `EaseCurves.easeOut`, transcribed once in §49 and reused rather than copied). The handle carries
  `ref`, a fresh `style` (`{ transform }`) per render, stable `handlers` (`onMouseDown / onMouseUp / onTouchEnd`), **live getters**
  `x / y / deltaX / deltaY`, and `snapTo('x' | 'y')`.
  🔴 The getters are load-bearing: the runtime writes the outputs and *then* pulses, so a *Drag Moved* chain reads the value of
  **this** frame. A listener closing over a plain render value would read the previous render's — §58's "live getters on the handle"
  rule, for the same reason.
  The options are typed `unknown` where the runtime's ports take whatever a wire delivers, and consumed inside the lib exactly as
  the component consumes them (`scale || 1`, `enabled === false`, `startX ? startX : 0`, and `'useParentBounds' in options ? … :
  true` — the declared default applies only to a port nothing set, as `registerInput` applies it). The lib imports `./errors`
  (`raiseAppError`, the NaN snap value) and `./animate`; `emitApp` ships both wherever it ships `drag.ts`.
- **Plan**: `renderRole` gains `'drag'` (a `StyleRole` with no style ports of its own); the walk keeps the **first** child and drops the
  rest by name; `DragPlan { nodeId, label, local, comment, options, listeners, drops }` on `plan.drags`, registered by `dragPlanOf`
  (options resolved in render context, arrival semantics) and completed by a pass beside §57's Added pass (listeners: `doneChainOf`
  in render context, snapped). Wires **into** the option ports are consumed there, not by the binding pass; wires **off** the value
  outputs ride the binding pass's whitelist (`isDragRead`) and resolve to `drag-out { local, field }` — `number`, never undefined,
  valid in both contexts. The two `Do`s are trigger ports (`isTriggerWire`) compiling to `drag-snap { local, axis }` — a bare
  expression `card.snapTo('x')`, its *Done* a listener the hook fires (one `done` whichever site asked — the node owns its outcome
  ports). `OWN_CHAIN_OUTPUTS[Drag]` = the three pulses and the trio, so the attach pass never takes them as element events.
- **Emit**: a `<div ref={card.ref} style={card.style} {...card.handlers}>` where the Drag sits, its first child inside; the hook line
  after the render locals it may read; `drag-out` in the five expression switches; `drag-snap` in the action switches;
  `import { useDrag } from '../lib/drag'` earned where a plan survived.

**Refused by name.** Whole node, before the walk (the subtree is left out, marked where it sat — the visual family's own rule):
(1) no child — *"it has no child to drag — a Drag with no child renders nothing (Drag.tsx returns null)"*; (2) *Completed* consumed —
UUID's sentence; (3) a pulse into a value sink — *"its Drag Started output is consumed as a value — a pulse carries nothing to
read"*; (4) *"its <port> output is not a port this node has"* / *"its <port> input is not a port this node has"*; (5) *"two wires
feed its <Label> input — last-writer-wins is not statically ordered"*. Per wire, the element still printing and a marker naming it
(the style-wire precedent): (6) an option wire that does not resolve or reads a handler-only value; (7) a listener chain that does
not translate — §57's *"its <Label> chain did not translate — <reason>"*; (8) *Failure* consumed — dropped with a note, because the
emitted element is mounted whenever a handler in this component can run, so that arm cannot fire; (9) a second child — *"the runtime
draws only the first child of a Drag"*. Generic sentences expected to fire unchanged: a `Do` from an untranslatable trigger (the attach
pass's), `didMount`/`willUnmount` (*no DOM event equivalent*), the Bounding Box outputs (whatever a Group's read of them says today).

**Recorded divergences**: the runtime drags the **child's** root; the export drags a wrapper `<div>` that takes the child's place in
the parent's flex flow (the child lays out inside a block wrapper — a `flex-grow` on the child now relates to the wrapper, not the
Group). The three marker classes `react-draggable-transparent-selection` aside (`react-draggable`, `-dragging`, `-dragged`) are not
emitted. A snap *Value* that arrives NaN twice in a row raises once (an effect keyed on the value; the setter raises per delivery).

### §63.1 What is emitted

- **`src/lib/drag.ts`** (`src/emit/dragLib.ts`, new, 595 emitted lines — a quoted line array generated from a typechecked source):
  `useDrag(source, options, listeners): DragHandle`. `DraggableCore` (mouse + touch, the primary button only, the non-passive
  native `touchstart`, the document `mousemove/mouseup` or `touchmove/touchend` for one drag, the finger followed by identifier,
  the `react-draggable-transparent-selection` hack and its frame-later removal), `Draggable` (the controlled position, the
  live/committed pair, `bounds: 'parent'` against the parent's inner box with slack, the axis flush rule) and `Drag.tsx` (the
  outputs' order — written BEFORE each pulse — the per-axis commit on release with `positionX/Y(data)` and no deltas, the
  `componentDidUpdate` on Start Drag, the snap registers with `readSnapCoordinate`'s abstain/NaN rules, the easeOut tween on
  `./animate`'s `createRun/startRun/stopRun/eases.easeOut`, `done` after every snap call, both timers stopped on Drag Started
  and on unmount). The handle: `ref`, a fresh `style: { transform }`, stable `handlers` (`onMouseDown/onMouseUp/onTouchEnd`),
  **live getters** `x/y/deltaX/deltaY`, `snapTo(axis)`. Options typed `unknown` and consumed as the props are (`scale || 1`,
  `enabled === false`, `startX ? startX : 0`, `'axis' in options ? … : 'x'`, `'useParentBounds' in options ? … : true`).
  Raises `drag/snap-position-not-a-number` on `./errors` with the runtime's own sentence.
- **Home.tsx**: `import { useDrag } from '../lib/drag'`; after the render locals,
  `const card = useDrag({ label: 'Card', nodeId: 'drag', componentName: '/Pages/Home' }, { axis: 'both', startX: 20, startY: 20, snapX: x, snapXDuration: 200, snapY: 0 }, { onStart: () => status.set('dragging'), onEnd: () => status.set('released'), done: () => status.set('snapped') });`
  the wrapper `<div ref={card.ref} style={card.style} {...card.handlers}>` where the Drag sits with its first child inside;
  `{card.x}` `{card.y}` `{card.deltaX}` `{card.deltaY}` bare (numbers, never undefined); the button
  `onClick={() => { card.snapTo('x'); card.snapTo('y'); }}`; a Condition on Drag X is `useEffect(…, [card.x])`.
- **plan.ts**: `DRAG_TYPE`, `DRAG_OPTION_PORTS` (port → key → label), `DRAG_VALUE_OUTPUTS`, `DRAG_PULSE_OUTPUTS`, `DRAG_SNAP_TRIGGERS`;
  `ValueExpr` gains `drag-out { local, field }`; `HandlerAction` gains `drag-snap { local, axis }`; `DragPlan` on
  `ComponentPlan.drags`; `renderRole` → `'drag'` (a `StyleRole` in style.ts with its own ports consumed there —
  `DRAG_OWN_PORTS`, pinned equal to the plan's list); `dragDeferReason` before the walk; the walk keeps the first child and
  `dropSubtree`s the rest; `dragPlanOf` (options in render context, arrival semantics, per-wire drops) beside `screenPlanOf`;
  `compileDragSnap`; the listener pass beside §57's Added pass (render context, snapped, wires consumed, Failure dropped with a
  note); `OWN_CHAIN_OUTPUTS[Drag]`; `isTriggerWire`; the `compileSink` dispatch; `isDragRead` in the binding whitelist; the five
  expression switches and the action walkers; and 🔴 **a restore of `static` over every rendered id the attach pass had
  collapsed into its trigger** (§63.4 #4).
- **component.ts**: `TAGS.drag`, the hook line (after the animations, listeners inline), `hookExprSources` over the options,
  the `||` hook-gap chain, the `role === 'drag'` branch of `renderCore` (drops → `defer` markers on the wrapper), `drag-out` in
  `maybeUndefined` / `exprCode` / `effectDeps`, `drag-snap` in `actionCode` / `actionExprsOf`, `allActions` over the listeners,
  the import earned by a surviving plan, `dragLib` on `EmittedComponent`. **emitApp.ts**: `drag.ts`, and `animate.ts` +
  `errors.ts` earned by it. **Ledger**: `Drag` translated with a note; floor **105 → 106** (this branch); eight pins moved;
  the editor's `exp-013/exportBadge.test.tsx` re-pinned from `Drag` to `net.noodl.SSE` at both sites (not run here).
- **Refused by name** (§C, every sentence exact): no child · Completed consumed (UUID's) · `its Drag Moved output is consumed as
  a value — a pulse carries nothing to read` · `its <port> output|input is not a port this node has` · `two wires feed its Snap To
  Position X — Value input — last-writer-wins is not statically ordered`. **Dropped by name, the wrapper still dragging**:
  `Drag <id>: its <Label> input is dropped — it reads a value that only exists inside a handler` (a received event's payload) /
  `— <the source's own sentence>` · `Drag <id>: its <Label> chain did not translate — <reason>; the wrapper still drags` ·
  `Drag <id>: its Failure chain is not emitted — Failure fires only when a snap reaches a Drag that has not mounted (drag.ts
  outcomeOnInnerComponent), and the emitted element is mounted whenever a handler in this component can run` · `the runtime draws
  only the first child of a Drag (Drag.tsx renders React.Children.toArray(children)[0])`. Generic sentences left to fire
  unchanged: a Do from an untranslatable trigger (the attach pass's), `didMount` (*no DOM event equivalent*), a Bounding Box read
  (*no deterministic translation in step 5*), a value output into a signal port (the attach pass's).

### §63.2 The fixture — `tests/fixtures/board-desk`

`App`: the Router alone. `Pages/Home`: page › shell › [headline; **board** (320×200) › **drag** (`axis: both`, Start Drag 20/20,
Snap X Duration 200, Snap Y Value 0; Snap X Value ← `homeX` Variable ← `targetInput`) › **card** (80×80) › "Card"; four Texts on
Drag X / Drag Y / Delta X / Delta Y; a status Text on the `status` Variable; the input; a "Snap home" button → both Dos]; Drag
Started / Drag Ended / Done → three Set Variables fed by three `String` nodes. **The reverted arm** (`probe-reverted.log`, HEAD
2a2dd4fa): `node drag (Drag) is in the visual tree but has no generator yet`, the card subtree "has no translation in this slice"
(not "inside drag" — the unsupported-child path does not disposition descendants), the three Set Variables silenced from the
value side (*"the value wire has no statically known source"* — §54.2's finding, §59's again), 6 silenced, `pathway: false`.
**Built**: 16 files, 0 refusals, the one shell note, the real `tsc` over the app clean.

### §63.3 Gates

```
packages/nodegx-export: tsc --noEmit 0 · drag.test.ts 51/51
  §A the fixture whole + the real ts.Program (9) · §B the hook under a fake React + fake DOM + hand-driven frame clock (21)
  §C refusals and drops by mutation, each sentence exact (16) · §D the shapes a wire changes, two typechecked as real programs (3)
  §F the findings pinned (2)
export-ledger:check OK (exit 0) · picker --check 106/127 (83.5%), floor 106, exit 0 (was 105 on this branch)
eight floor pins moved 105 → 106: animation-pair, browser-utilities, filter-records, on-app-error, object-store, run-tasks, script, streaming-trio
neighbours re-run one at a time, green: in-code-markers 57, unreported-deferrals 7, logic 29, cascade 83, preflight 241,
  emitted-syntax 68, exported-readme 184, typecheck-emitted 37, animation-pair 57, browser-utilities 55, filter-records 34,
  on-app-error 41, object-store 35, run-tasks 67, script 74, streaming-trio 59
arms 17/17 KILLED, every arm compiled, sources restored md5-identical after each (mut.py, mut-summary.txt): M1 axis x also drags
  Y — 2 · M2 no slack — 1 · M3 outputs after the pulse — 2 · M4 commit ignores the axis — 2 · M5 no Done on a no-op snap — 1 ·
  M6 '' no longer abstains — 1 (a SURVIVOR on the first cut: B15 never observed the abstained value between two accepted ones —
  the row was added) · M7 Drag Started keeps the snap running — 1 · M8 touchstart never removed — 1 · M9 getters → captured
  values — 11 · M10 pulse-as-value refusal removed — 1 · M11 every child drawn — 1 · M12 a handler-only option prints — 1 ·
  M13 the Failure sentence inverted — 1 · M14 the disposition restore disarmed — 1 · M15 the wrapper without handlers — 9 ·
  M16 animate.ts not earned — 4 (the emitted tsc among them) · M17 an effect keyed on the handle — 1. M14 re-cut against the
  narrowed restore: KILLED — 1 (F2).
  Nine first cuts of the lib "NOT CUT": dragLib.ts is a quoted line array, and a multi-line anchor never matches — re-cut
  against the quoted lines. Two first cuts (M13, M14) did not compile ("0 total" is not a kill) and were re-cut at the value level.
whole package jest: 72 files (72 on disk = 71 + this spec), 2512 rows, exit 0, alone on the box at load 5.4 — run AFTER the last
  src/ change (a first full run read 2511/2512: visual.test.ts's "a page's sole Group child collapses into the page div" —
  the disposition restore's first cut was too broad, §63.4 #2; narrowed, re-run, 72/72)
NOT run (the orchestrator's, after merging): editor tsc, editor test:ci (the exp-013 re-pin), any drive.
```

### §63.4 What building it found

1. 🔴 **A `String` node's output port is `savedValue`, not `value`.** The fixture's three chains read *"the value wire has no
   statically known source"* in BOTH arms until `roster-desk`'s wiring was read; §59's E7 (`Value Changed`'s port) again, on the
   fixture rather than the node. Pinned (F1).
2. 🔴 **The attach pass writes `collapsed into snapBtn` over a RENDERED sink.** The Drag whose snap Do a button fires read
   "collapsed" in its own report while it draws — the Checkbox with a wired Check has done the same since the controlled-state
   slice, unseen because nothing asserted a rendered control's disposition. One loop after every pass restores `static` for every
   rendered id that is the sink of a trigger wire; pinned (F2), an arm (M14). ⚠️ The first cut restored EVERY rendered
   collapse and the whole suite caught it (`visual.test.ts`: a page's sole Group collapses into the page div, truly) — a fix
   scoped by the symptom, not by the population that produced it.
3. ⚠️ **Predicted a text input's live text into an option would be handler-only.** It is a state row: the controlled-state slice
   mints `useState` for a control read outside its own onChange, and the option is `scale: snapTarget` — §57.4's second trap,
   verbatim. The handler-only drop needed a genuinely handler-only source: a received event's payload (C6); the state-row shape
   is pinned beside it (C6b).
4. ⚠️ **My slack arithmetic was wrong and the lib was right** (B5's first expectation said 150; the library's own sums give 120 —
   the first clamp's overshoot is 320−240 = 80, not 110). The row keeps the derivation.
5. ⚠️ **`Condition`'s input is `condition`, not `valueA`** — the panel's comparator fields are not ports (D3's first cut).
6. ⚠️ **A 1 ms frame is not "nowhere near"**: easeOut moves 20 → 0 by 0.2 in a 300 ms tween (B15).
7. ⚠️ **A mutant of a quoted line array needs a quoted-line anchor** — nine arms cut nothing on the first pass and said so.

### §63.5 What this leaves (owner NONE unless named)

- **The wrapper `<div>` takes the child's place in the parent's flex flow**, where the runtime drags the child's own root: a
  child with `flex-grow` or `align-self` now relates to the wrapper. The alternative — printing the ref, the transform and the
  handlers onto the child's own element — needs every role's printer to accept injected attrs and a style merge; recorded, not
  built. Owner NONE.
- **The three marker classes** (`react-draggable`, `-dragging`, `-dragged`) are not emitted; an author's CSS targeting them
  would not apply. Owner NONE.
- **A snap Value that arrives NaN twice in a row raises once** (an effect keyed on the value; the setter raises per delivery).
- **The Bounding Box, Child Index, Children Count, Screen Position, `this`, `didMount`/`willUnmount` ports** take the generic
  sentences a Group's take; this row translates the drag ports only.
- **A wire delivering `undefined` into Axis or Constrain to parent** reads as "set to nothing" in the lib (`'axis' in options`),
  which is the runtime's answer; a wire that DELIVERS the literal default is indistinguishable from an authored one — fine.
- The Variable `homeX`'s render local prints as `x` (the existing Variable local minting) — a poor name beside `card.x`, not this
  row's, and it typechecks. Owner NONE.
- **Not driven in a browser this session** (the brief forbids drives from a slice agent); the orchestrator's headless drive of
  `board-desk` is owed — the lib is graded under a fake DOM (§B, 21 rows), which cannot see `offsetLeft`, `getComputedStyle`
  or a real `touchstart` being passive.
