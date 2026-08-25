# FB-022 — numbers you can grab

**Filed:** 2026-08-22, from Jordan's session-2 report §5 — the second session to arrive at
this independently (previous session: the AudioNodes comparison). **Status: ✅ built, specced and DRIVEN
2026-08-25 (session 29). AC1–AC5 all met.** Size was M/L; delivered M.

> *"The friction between me and moving this thing — I'm going to try and drag it. Whereas down
> here I have to type something in."* Proposed in-session: **click-and-hold drags the value,
> single click edits.** No mode, no new control.

Two different users reaching for the same missing interaction while doing different tasks is
a signal about the tool's shape, not a preference — filed on that basis. It is also the item
that converts FB-016's overlay from a diagnostic into a feedback loop: scrub margin, watch
the margin box move.

---

## Scope

1. **Drag-to-scrub on numeric fields** in the properties panel: press-and-hold + horizontal
   drag changes the value continuously; a plain click focuses for typing (the discriminator
   is movement past a small threshold before mouseup, the way devtools and Figma do it).
2. Modifier scaling (shift = ×10, alt = ×0.1) and per-port step derived from the type where
   it exists.
3. Applies to `number`, units-`number` and `dimension` value halves — the unit stays a
   dropdown; scrubbing never changes the unit (FB-019's coercion rules own that).
4. Out of scope: on-canvas drag handles for margin/padding (a bigger feature; this task is
   the panel half Jordan actually asked for).

## Acceptance criteria

- AC1: scrub changes the rendered element live (undo coalesces to one entry per scrub
  gesture, not one per pixel — the undo integration is the real work in this task).
- AC2: click-without-drag still enters edit mode; typing is unchanged — asserted both arms.
- AC3: a scrub on a **connected** port doesn't silently write a doomed parameter — FB-018's
  chip means the field isn't scrubbable while bound; asserted.
- AC4: works on the three numeric row types named in (3); rows opt in by type, not by
  hand-list — sweep-asserted like FB-018 AC2.
- AC5: driven in the running editor; pointer capture releases correctly (no stuck-drag after
  mouseup outside the panel).

## Traps

- The panel's row components are shared with non-visual nodes — a scrub on e.g. a delay
  number must behave identically; don't gate on "visual".
- Pointer capture + the panel's own scroll: a vertical drift mid-scrub must not scroll the
  panel (FB-017's scroll-preservation work is adjacent — coordinate, don't collide).


---

# What was built (session 29, 2026-08-25)

## The shape: four modules, and why the decisions are not in the components

| Module | What it owns | Why there |
|---|---|---|
| `noodl-core-ui/…/scrub/scrubGesture.ts` | threshold, step-per-unit, modifier scaling, the value arithmetic | pure; no DOM, no React |
| `noodl-core-ui/…/scrub/scrubController.ts` | the listener state machine, over an injected document | pure; makes AC2 and AC5 **gradeable** |
| `noodl-core-ui/…/scrub/useDragToScrub.ts` | refs and unmount cleanup, ~15 lines | the only part that needs React |
| `propertyeditor/DataTypes/scrubPolicy.ts` | **which ports scrub**, from the port type | AC4; no editor imports |
| `propertyeditor/DataTypes/scrubCommit.ts` | one undo entry per gesture | AC1 |

`BasicType`, `NumberWithUnits` and `Dimension` each ask `scrubSpecForPortType` and each pass a
binding down. `PropertyPanelBaseInput` gained `onMouseDown` + `isScrubbable` and **no hook**,
deliberately: three existing specs evaluate element trees containing it in a runner with no
React dispatcher, and a hook there would have broken them.

## 🔴 Four things that were nearly wrong

### 1. The spec that could not fail — a hole shaped exactly like the defect

AC1's headline claim is *the live writes record nothing*. The first version of `scrubCommit`'s
fake node had `setParameter(name, value)` — **no third argument** — so it could not tell a
write that asked for undo from one that did not. A mutant that made `writeScrubStep` push an
entry on **every pixel**, which is the precise defect AC1 exists to prevent, killed **zero
rows**. The fake now mirrors the undo half of `NodeGraphNode.setParameter`, and there is a
control arm proving the same fake *does* record 40 entries when a caller asks. Only the
mutation sweep found this; the suite was green and meaningless.

### 2. "Is this a number port" ≠ "does this port render a number field"

`Ports.viewClassForPort` is an ordered chain, and **the eight margin/padding ports are
`{ name: 'number', units: ['px','%'] }`** — indistinguishable from Width to a naive check.
They are claimed four branches earlier by `isOfMarginPaddingType` and render inside the
margin/padding widget, **which has had its own drag since POL-012**. A binding built for them
would be a second gesture on a control that is not there. Every predicate ahead of the numeric
branches was read; the prefix is pinned as a literal and the sweep **re-derives the real one
out of `Ports.ts`**, so a predicate inserted above the numeric rows fails the suite instead of
quietly stealing ports.

### 3. `setParameter`'s own `oldValue` override cannot express "it was on its default"

The margin/padding drag commits through `args.oldValue`, and the check is **`if
(args.oldValue)` — falsy**. A drag starting on a port with no parameter set has `undefined`,
which that check cannot distinguish from "not supplied", so it falls through to the *current*
parameter: the dragged value. **Undo would restore the drag.** Margin/padding never meets this
because it seeds from the port default and therefore always has an object — the bug is real
and simply unreachable from there. `commitScrub` builds its own group instead, in the
`push`-not-`pushAndDo` form `UndoActionGroup` documents. A mutant using the constructor's
`do`/`undo` form (the documented `ptr = 0` trap) kills 4 rows.

### 4. A blank field is not a zero

An unset port is showing its *default* — `Width` is `100%`, `Opacity` is `1`. Starting a drag
at 0 would snap the element to nothing before the pointer moved a pixel. `scrubStartValue`
reads stored → port default → 0, and asserts a stored **zero** is not mistaken for unset.

## Two decisions worth keeping

- **The value is absolute within the gesture** (`start + dx × step`), never accumulated.
  Accumulating rounds every sample and the roundings add up, so an out-and-back does not
  return. The spec drags out 80px and back and asserts the *exact* start value returns.
- **Modifiers compose multiplicatively** — shift ×10, alt ×0.1, both ×1. The only rule that is
  order-independent.

## AC3 has two independent mechanisms, on purpose

FB-018's chip already **replaces** the control on a connected row, so structurally there is no
field to press. That is one edit away from not holding, and the failure would be silent — a
scrub on a bound port writes a value the connection overwrites next frame, which is the FB-018
bug re-created by a gesture. So `scrubSpecForPortType` **also** refuses a binding when
`isConnected`, and that half is gradeable in the plain-Node runner. Expression mode is gated
the same way and is the sharper case: there a drag would overwrite the author's expression
with a literal.

## Specs — 5 files, 85 specs, all 18 mutants killed plus the 2 the drive found

`tests-unit/fb-022/`: `scrubGesture` (20), `scrubController` (18), `scrubCommit` (15),
`scrubPolicy` (26), `scrubConnectedRow` (6) — counted per file, not estimated. The last 8 are
the two guards the drive earned, and both were confirmed to go red against the pre-fix code.

**The AC4 corpus is the real shipped catalog**, built from every port-declaring mixin in
`node-shared-port-definitions.ts` — 73 ports: 39 `number`, 2 `dimension`, 8 of the numbers
carrying `marginPaddingComp`. **33 scrub, 40 do not**, and the number/dimension total (41) is
counted independently of the policy that classifies it.

⚠️ **A plausibility guard earned its place immediately**: the first corpus was 35 ports
because I called six of the eleven mixins, and `expect(length).toBeGreaterThan(40)` caught it.
Missing `addBorderInputs`/`addShadowInputs` would have dropped most of the unit-bearing numbers
in the catalog — Border Width, the four shadow offsets, Font Size — which are exactly the rows
a scrub is for.

## Gates, this tree — re-run AFTER the drive's two fixes, because the first run could not speak for them

- `npm run test:main`: **331 files / 5338 specs / 0 failures** (was 326 / 5253 in s28) — the 5
  new files and their 85 specs.
- ✅ **`npm run test:ci` RUN TWICE, 2026-08-25.** 13:06→13:19 seed **26506**, and again after the
  fixes 13:41→13:54 seed **48211**. Both: `Jasmine: 2849 specs, 4 failures (failed).` All four
  `AIX-006 style vocabulary`, **by name** — the same four as s26/s27/s28. Spec count identical,
  no new name, and the floor now held across two different seeds on one afternoon.
  ⚠️ **`test-results.json` is at `packages/noodl-editor/tests/`, not `packages/noodl-editor/`.**
  The first run's "delete it beforehand" precaution was aimed at the wrong path and was a
  no-op; both runs were confirmed from the summary line and a fresh mtime instead.
  ⚠️ A peer predicted, in advance, a possible fifth failure (`AIX-011 criterion 7`, the 30ms
  flake) because an iOS simulator was pinning a core. **It did not fire** — so that flake
  survives at least one core-pinned run.
- `npm run typecheck:editor`: **0 errors**, and **proved to see all four new files** by
  planting 4 errors (4 reported, naming exactly those files) and removing them.
- `npm run typecheck:core-ui`: **44 errors, none of them mine and none new** — a pre-existing
  dirty gate (`@noodl-viewer-cloud/execution-history` resolution, VersionControlPanel,
  AiSettings). ⚠️ The only grep hit for "scrub" is `main/src/execution-history/scrub.ts`, an
  unrelated file that happens to share the word. This gate is **not** clean and must not be
  quoted as passing.

---

# The drive (2026-08-25) — ten predictions, and 🔴 TWO REAL DEFECTS THE SPECS COULD NOT SEE

Predictions and **falsifiers** were written down before the editor was launched. Two of the ten
came back wrong, and both were defects in shipped code that 75 green specs had passed over.

| # | Prediction | Result |
|---|---|---|
| P1 | `Width` scrubbable, a string field not | ✅ 20 numeric fields scrubbable; `backgroundColor`, `cssClassName` not |
| P2 | Click with no movement focuses, value unchanged | ✅ focused, `160` unchanged |
| P3 | +60px on a `px` field = +60 | ✅ 160 → 220 |
| P4 | Exactly one undo entry | ✅ `1`, labelled `change Width` |
| P5 | One undo restores the pre-drag value | 🔴 **THREW** — see below |
| P6 | Element changes live during the drag | ✅ **13 live writes** — 165,170…220 — and **1** undo entry |
| P7 | Nothing moves after mouseup | ✅ three cross-screen moves with `buttons:1` changed nothing |
| P8 | Connected port has no field to press | ✅ input **absent**, chip reads `Bound to A wide 100% · width`, sibling `height` still scrubbable |
| P9 | Scrub keeps focus on the transform-origin field | 🔴 **value was wrong** — see below |
| P10 | Margin fields not scrubbable | ✅ 8 labels, **0** scrubbable, no margin `<input>` at all |

## 🔴 Defect 1 (P5): `parent.model` is a `ModelProxy`, and it had no `notifyListeners`

The first undo threw **`model.notifyListeners is not a function`**, left `UndoQueue.ptr` at 1,
and — the user-visible part — reverted `width` to 160 **in the project while the field on screen
still read 220**.

The model a row holds is a `ModelProxy`, not a `NodeGraphNode`. The proxy forwards `on` and
`off` to the node but simply had no `notifyListeners`, so a caller holding it could not fire the
`modelParameterUndo` that makes the panel rebuild — the event `NodeGraphNode.setParameter`'s own
undo closures fire on the node.

🔴 **The spec passed because the fake was MORE CAPABLE THAN THE REAL OBJECT.** `scrubCommit`'s
fake node had `notifyListeners`; the thing it stands for did not. A fake can always be given a
method. **Fix:** complete the proxy's facade. **Guard:** a spec that parses `modelProxy.ts` and
asserts the methods `commitScrub` calls are really declared — it goes red with the forwarder
removed.

## 🔴 Defect 2 (P9): port defaults are strings, and `numericPart` took numbers only

A +30px drag on `Transform Origin X` put **30** in a field that had been showing **50**. The
gesture had started from 0, because `transformOriginX` declares **`default: '50'` — a string** —
and `scrubStartValue` accepted `number` only. The panel stringifies whatever it is handed, so
the display was right the whole time; only the gesture could tell the difference.

Measured across the 33 scrubbable ports: **14 number defaults, 5 string, 14 absent.**

⚠️ **And the corpus above is the SHARED mixins only.** A peer's prompt to widen the check found
a third string numeric default outside it — `visual/circle.ts` gives `size` (type `number`)
`default: '100'`. A grep over the whole viewer source is now an arm of its own, so the two the
drive happened to hit are not mistaken for all of them. 🔴 The transferable lesson is not
"handle strings": it is that **a default declared as a string is a type the declaration and its
reader can disagree about silently** — it fails as a *plausible value*, never as an error.
⚠️ And three of the five strings are **`'Auto'`** (`fontWeight`, `letterSpacing`, `lineHeight`),
so a blanket coercion would have been wrong in the other direction. **Fix:** accept a numeric
string, reject anything that is not finite. **Guard:** six arms taking their defaults from the
real mixins, including the `'Auto'` case; two go red without the fix. After the fix, the same
drag reads **50 → 80**, unit `%` preserved, one undo entry.

## What the drive settled that no spec could

- **Live feedback is real**: 13 model writes during one 60px drag, 1 undo entry. AC1 as a
  measurement rather than an argument.
- **No stuck drag**: after mouseup, three synthetic `mousemove`s with the button flag set
  reached nothing — the document listener set was genuinely empty.
- **Focus is never stolen**: after a scrub, `document.activeElement` is still the field and
  `transformOriginFocus.focused` still holds `transformOriginX` — the tracker FB-016's
  crosshair depends on is undisturbed.
- **A panel rebuild mid-drag would dispose the controller**, and does not happen for these
  ports: `HINT_INPUT_PARAMETERS` is corner-radius + `clip` + `scrollEnabled` + `nativeScroll`
  only, and `refreshHints` applies attributes rather than rebuilding rows.

## ⚠️ What the drive could NOT see, stated rather than glossed

🔴 **The crosshair element itself was never observed.** In Design mode the viewer frame has
**zero rendered elements** (`[data-noodl-node-id]` count 0, empty body), so
`[data-noodl-transform-origin]` stayed `display: none` throughout — including in the control
reading taken *before* any focus. What was measured instead is the mechanism the crosshair
hangs off: the field keeps focus and the focus tracker keeps the port. **P9's claim is settled;
the pixels are not.** Driving the crosshair needs the app running, which is a different mode
from the one the property panel lives in.

Also unobserved: that `user-select: none` visibly prevents a selection being painted (the style
was confirmed set during the drag and restored after), and a mouseup genuinely outside the OS
window.
