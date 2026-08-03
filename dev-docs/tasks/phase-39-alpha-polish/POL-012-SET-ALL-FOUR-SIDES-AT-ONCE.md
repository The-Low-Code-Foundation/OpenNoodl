# POL-012 — Set all four sides at once

Covers reported item **14**.

## What was reported

> Where there's the option to add padding or margins, can you add an option to set all values at
> once? Instead of having to click in and out of each bottom, top, left, right field individually
> and type the same number.

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

1. A link toggle appears on the padding group and the margin group, independently.
2. With it on, typing one value sets all four, live.
3. That gesture is **one** undo step.
4. Turning it on does not change any value by itself.
5. Units follow, including the mixed-units case.
6. The toggle's state is not written to the project.
7. Verified in the running editor, on a real node, in both themes.

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
