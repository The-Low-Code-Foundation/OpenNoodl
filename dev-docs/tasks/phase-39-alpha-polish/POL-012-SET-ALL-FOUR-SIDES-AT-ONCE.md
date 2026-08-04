# POL-012 — Set all four sides at once

Covers reported item **14**.

## What was reported

> Where there's the option to add padding or margins, can you add an option to set all values at
> once? Instead of having to click in and out of each bottom, top, left, right field individually
> and type the same number.

## Status: DONE — 2026-08-04

`scripts/pol39-live/pol012-linked-sides.js` reports **12/12 in both themes**, on a real node in a
real project, with every value read back off `NodeGraphNode.parameters` — what actually gets written
to disk — rather than off the screen.

All four slices landed. Slice 4's survey found one other four-sided group and it is **already
solved**, differently: corner radius has a single `borderRadius` plus per-corner overrides
(`style[r] = b[r] || b.borderRadius`) behind a `corners` tab, so it has had "set all four at once"
since before this task and needs nothing. Border width is the same shape. Nothing else has four
sides.

### Two things that came out of building it

- **"Turn linked on only if all four already agree" means it starts ON.** Four untouched sides *do*
  agree, which is the state every node starts in — so the default is linked, and the rule the spec
  is actually protecting (never flatten four values that differ) is a separate case. The driver's
  first version assumed the opposite and reported five failures against correct behaviour. The
  measurement now covers both: linked-by-default on an untouched node, *and* that toggling records
  nothing and changes nothing when the sides are mixed.

- **`12/12` said nothing about where the control sits.** The first placement — beside each group's
  tag — worked perfectly and covered the tags' last letters (`MARGIN⛓`, `PADDIN⛓`) and the
  padding-top field. Only a screenshot caught it. The overlap is a measurement now: every toggle's
  box against every tag and every value label.

### The undo shape, which is the substantive half

`setParameter` already takes an `UndoActionGroup` as `args.undo` and only creates-and-pushes its own
when it is handed a boolean. So `updateAll` builds one group, passes it to all four writes, and
pushes it once — and it must `push`, never `pushAndDo` and never the constructor's `do`/`undo` form.
`UndoActionGroup`'s own docblock records why: the constructor form leaves `ptr` at 0 and produces a
group that **cannot be undone at all**.

Measured: undo depth `0→1` with the label `change padding`, and pressing undo *once* restores all
four sides — including the one that was on `%`. A queue that grew by one but restored one side would
have passed a depth check and failed a user, so both are asserted.

## The mechanism — confirmed

[`MarginPaddingType`](../../../packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataTypes/MarginPaddingType.ts)
collects the four ports of a group into one view (`fromPort` keys on
`'marginsandpadding-' + p.group`) and renders `MarginPaddingInput`. It keeps `defaults`, `values`
and `ports` as four-entry records.

Its write path is strictly one side at a time:

```ts
private update(comp: string, value: MarginPaddingValue | undefined, opts?) {
  this.values[comp] = value;
  const undoArgs = { undo: true, label: 'margin or padding changed', … };
  …
```

There is no batched path and no linked mode. Setting a uniform 16px is four focus/type/blur cycles
and **four separate undo entries**, so undoing it is four presses too.

The view already has everything a linked mode needs — all four ports, their defaults and their
units, in one object.

## What to build

**Slice 1 — the affordance.** A link/lock toggle in `MarginPaddingInput` beside the four fields.
When linked, editing any field writes all four.

Conventions worth following, since every design tool has solved this:

- The toggle is **per group** (padding and margin lock independently) and is **editor state, not
  project state** — it describes how you are typing, not what the project is. It should not be
  written to `project.json`, and it should not survive as a saved parameter.
- Linked mode should turn *on* automatically only if all four are already equal — never silently
  flatten four different values the moment it is switched on. If they differ, switching on and then
  typing is what unifies them, and that is a visible action the user took.
- Show it: when linked, all four fields update as you type, not on blur.

**Slice 2 — one undo step.** This is the substantive part. `update()` must gain a batched sibling —
`updateAll(value)` — that writes all four parameters inside a **single** undo group with a label
like `"change padding"`. Four undo entries for one gesture is its own defect and is worth fixing
even if the linked mode were rejected.

Check how the editor groups undo elsewhere (`setParameter`'s `undo`/`label` options and whatever
transaction mechanism the apply path uses) rather than inventing a grouping.

**Slice 3 — the units port.** Each side carries a unit as well as a value
(`{ value, unit }`, with `type.defaultUnit`). Linked mode must set the unit too, and must handle the
case where the four sides currently carry *different* units. Units ports write **strings**, which is
a documented trap in this area — do not assume a number survives the round trip.

**Slice 4 — everywhere it applies.** The report says "where there's the option to add padding or
margins". That is `MarginPaddingType` via `addPaddingInputs` / `addMarginInputs`, which is most
visual nodes. Confirm the toggle appears on all of them and check whether any other four-sided group
exists (border radius corners, border widths) that should get the same treatment. If so, name them
here and decide whether they are in scope — a corner-radius lock is the same gesture and users will
expect it next.

## Criteria

1. ✅ A link toggle on each group, independently — verified by unlocking margin and finding padding
   still locked. Neither overlaps a tag or a value field.
2. ✅ With it on, typing one value sets all four, live. All four labels preview the typed text
   *before* it is committed, including the one under the cursor — nothing is written until commit,
   which is what keeps criterion 3 exact.
3. ✅ One undo step: depth `0→1`, label `change padding`, and one undo press restores all four.
4. ✅ Toggling off and on again changes no value and records no undo step. Measured on a group whose
   sides *differ*, which is the case the rule exists for.
5. ✅ Units follow. `paddingTop` was put on `7%` first, so the linked write had a genuinely mixed
   group to resolve; all four came out `16px`.
6. ✅ Nothing lock-shaped in the node's parameters after the whole run.
7. ✅ Both themes, 12/12 each.

## Traps

- **Units ports write strings.** A batched write that puts numbers where strings are expected will
  look right in the panel and be wrong on disk.
- `MarginPaddingType` is a legacy `TypeView` hosting React through `createRoot`, and it re-renders
  via `renderReact()` on a `setTimeout(…, 0)` in places. State that lives in the React component
  will be discarded by a re-render driven from the view; the link flag needs to live where it
  survives that.
- Padding on the Icon node is deliberately absent — NDA-012 deleted a declared 5px default there
  because it never reached the element. Do not "restore" it while working in this area.
- `flagOutputDirty` on a signal port never fires, and a declared default never runs its setter. If a
  batched write appears not to apply, check the setter route before the batching.
