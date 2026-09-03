# DEF-041 — the drag door and STYLE-002's defaults: a real asymmetry that bites nobody

**Status: ✅ MEASURED, DRIVEN AND CLOSED — 2026-09-03, session 43.**
🔴 **The row it comes from is DISPROVED as a live defect.** Promoted from the unnumbered drag-door
row in [UNOWNED-ROWS-TO-MEASURE.md](UNOWNED-ROWS-TO-MEASURE.md) (owner `NONE` since 2026-08-30),
which owed a drive *"before anyone fixes it"*. The drive is what reversed it.

## What the row claimed

`ElementConfigRegistry.applyDefaults` has exactly one call site — `NodePicker.utils`. The other
path that mints a brand-new node, `NodeOperations.createNewNode` (a drag from the library onto the
canvas), never calls it. The row read that as an accessibility defect a person meets:

> Four types carry an ElementConfig […] Placed from the node picker they arrive with token-based
> sizing, radius, cursor and their initial variant. **Dragged from the library they arrive bare.**
> That includes DEF-001's accessibility repair […] so **the same control is accessible or not
> depending on which gesture created it.**

The call-site count re-derives **exactly** at HEAD. The sentence about a person does not.

## The drive — 2026-09-03, a real editor on a copy of `sb015-editor-drive`

🔴 **The control was read first, and it read ZERO.** The first attempt at both arms created
nothing, which would have "confirmed" the row by accident. `dispatchDrag`'s default 12 steps jump
the pointer off the source element before `ComponentItem`'s 5px threshold
(`handleMouseMove`, `:101-116`) can fire, so no drag ever started. **At 120 steps the control
fires**, and only then does an empty arm mean anything.

| arm | gesture | result |
| --- | --- | --- |
| **CONTROL** | drag `Nav` (a project component) from the Components panel → canvas | ✅ node created: `/Site/Nav`, `parameters: {}` |
| **the row's claim** | drag the picker's **Checkbox card** → canvas | 🔴 **nothing created** |
| **the other door** | click the same Checkbox card | ✅ node created with **all 8 defaults** |

The picker arm, in full — this is what "arrives with defaults" means:

```json
{ "width": "var(--space-4)", "height": "var(--space-4)", "borderWidth": "var(--border-1)",
  "borderColor": "var(--border-control)", "borderStyle": "solid",
  "borderRadius": "var(--radius-sm)", "cursor": "pointer", "_variant": "default",
  "useLabel": true }
```

`borderColor: var(--border-control)` is DEF-001's 1.23:1 repair and `useLabel: true` is DEF-025's,
the latter arriving via `seedNewNode`, which **both** doors already call.

## Why nothing is bare — and it is not a near miss

**A built-in node type cannot be dragged onto the canvas at all.**

- `onDrop` (`nodegrapheditor.drag.ts:101`) is reached from exactly one place,
  `InteractionController.ts:817`, fed by `PopupLayer.instance.dragItem`.
- Of the three `PopupLayer.instance.startDragging` call sites, only one can reach the canvas:
  `ComponentsPanelNew/hooks/useDragDrop.ts:27`. It carries `component` (a project `ComponentModel`)
  or `folder`. **Never a node type.**
- `getDragItemComponent` also reads `dragItem.nodeType`. 🔴 **`nodeType` is declared on the
  interface and assigned by nothing, anywhere in the editor.**
- And the configs are keyed by built-in type names: measured live in the running editor,
  `ElementConfigRegistry.has('net.noodl.controls.checkbox')` is `true`,
  `ElementConfigRegistry.has('/Site/Nav')` is **`false`**.

So every item that can arrive at `createNewNode` today is one `applyDefaults` would ignore. The
asymmetry is real **in the code** and inert **in the product**.

## What was built, and why it is deliberately small

`ElementConfigRegistry.applyDefaults(node, type.name)` added to `NodeOperations.createNewNode`,
**before the add**, mirroring the picker exactly.

⚠️ **This is a latent trap being closed, not a defect being fixed**, and the write-up says so at
the call site. The justification is that `nodeType` already exists and is already read: the day a
drag source populates it, this door would mint untokenised, inaccessible controls in silence.
Making the doors agree now costs one line and, per the drive, changes nothing today.

🔴 **The row's own candidate fix was NOT taken.** It proposed folding `applyDefaults` into
`seedNewNode` so "what a node arrives with" has one home — and warned this is not a one-liner
because the picker applies defaults **before** the node is in the graph and `seedNewNode` runs
**after**, deliberately, for undo granularity. That warning is correct and the reason it was
refused: these are direct `parameters` writes with no undo entry of their own, so moving them
after the add would show a bare node until the next repaint. **A restructure that risks a visible
regression to close a hole nothing can currently reach is the wrong trade.**

## The gate — `tests-unit/def-041/both-creation-doors-seed.test.ts`

Four tests. 🔴 **It DERIVES its population from source rather than naming the two doors**, because
the failure worth guarding is a **third** door being added that seeds one way and not the other —
the exact drift `newNodeSeed.ts`'s own docstring already warns about, and the shape DEF-038 was
built to avoid.

- *the derived population is non-empty* — the control for the instrument itself. A regex matching
  nothing would make every other assertion trivially true, which is how a sweep like this fails
  silently.
- *every door that calls `seedNewNode` also calls `applyDefaults`* — stated as a set difference so
  a failure **names the door**.
- *both known doors are in that population* — so the sweep is looking at the right thing.
- *`DragItem.nodeType` is read but never assigned* — 🔴 **this is the row's tripwire.** If it ever
  goes red, a drag source has started carrying a built-in node type, and the claim this row
  disproved becomes true.

### Mutants — two, and the second is the one that matters

| mutant | what it does | killed by |
| --- | --- | --- |
| 1 | removes the new `applyDefaults` call (back to the one-door state) | *every door that calls seedNewNode also calls applyDefaults* |
| 2 | **adds a third door** that calls `seedNewNode` and not `applyDefaults` | the same test — which is what proves the sweep catches the **shape**, not this instance |

Restored green; md5 matched the pre-mutation snapshot.

## Gates run

| gate | result |
| --- | --- |
| `tests-unit/def-041` | **4 passed**, exit 0 |
| editor drive, three arms with an armed control | as tabulated above |
| **post-fix drive, in the same running editor** | both arms below |

### The post-fix drive — and it caught the fix not being live

Re-running `createNewNode` after the edit returned a checkbox carrying **only** `useLabel: true`.
🔴 **The fix was in the served bundle and not in the running app**: HMR replaced the module, but
the `NodeOperations` instance the editor was holding kept the old prototype. A renderer reload was
needed. **Without the presence control this would have been written up as a working fix on the
strength of a passing source-derived sweep.**

After the reload, through the modified function:

| arm | input | `parameters` |
| --- | --- | --- |
| **presence control** — proves the added call is not inert code | `net.noodl.controls.checkbox` | all **8** ElementConfig defaults + `useLabel` — **identical to the picker door** |
| **no-regression control** — the only input the drag door can actually receive | `/Site/Nav` | `{}`, unchanged from the pre-fix drag |

## Bounds — stated so this is not over-read

- **What is disproved is the row's sentence about a person**, not its call-site count. The count is
  exact and re-derived at HEAD.
- **The absence is source-derived plus one driven negative.** "No drag source carries a node type"
  rests on the `startDragging` call-site sweep and on `nodeType` having no assigner — both greps,
  both pinned by the gate. The drive contributes one armed negative (the Checkbox card) beside one
  armed positive (`Nav`). ⚠️ A drag source outside this editor package would not be seen.
- **`applyDefaults` on the drag door has never been observed doing anything**, by construction —
  there is no item that reaches it and has a config. The gate asserts the call exists; only the
  tripwire test would notice if it started mattering.
- **The picker arm was driven; the drag arm's node parameters were never compared for an
  ElementConfig type**, because no gesture produces one. That comparison is not deferred work — it
  is unreachable.
