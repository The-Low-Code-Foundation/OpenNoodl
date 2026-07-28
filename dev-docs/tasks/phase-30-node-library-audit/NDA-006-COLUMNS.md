# NDA-006: Columns — breakpoints, repeaters, and then masonry

## Metadata

| Field | Value |
|-------|-------|
| **ID** | NDA-006 |
| **Phase** | Phase 30 — Node Library Audit & Remediation (Track O) |
| **Tier** | 2 |
| **Priority** | 🟠 High — Richard's #1, and the repeater half means the node fails at its most common use |
| **Difficulty** | 🟠 Medium — slices 1–2 are small and well understood; masonry is real design work |
| **Estimated Time** | 2–3 weeks |
| **Prerequisites** | None. Slice 3 wants NDA-013 (Repeater) landed first |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟢 **Sonnet 5** for slices 1–2, 🔵 **Fable 5** for slice 4 |

## Objective

Make Columns responsive in the way people actually mean, make it work with a Repeater at all, and
then add masonry.

## Slice 1 — Fix the in-place mutation (small, do it first)

[`Columns.tsx:43-47`](../../../packages/noodl-viewer-react/src/components/visual/Columns/Columns.tsx#L43-L47):

```js
const newLayout = layout;   // not a copy
if (rowWidth.expected < rowWidth.min) newLayout.pop();
```

`calcAutofold` then recurses on its own mutated output
([`Columns.tsx:18-27`](../../../packages/noodl-viewer-react/src/components/visual/Columns/Columns.tsx#L18-L27)).
Copy the array. This is a plain bug and independent of everything else in the task.

Also in scope here: `visibility: hidden` until the first `ResizeObserver` callback
([`Columns.tsx:141`](../../../packages/noodl-viewer-react/src/components/visual/Columns/Columns.tsx#L141))
means the node renders blank on first paint and blank under SSR — which is why the catalog marks it
`partial`. Measure on first render instead, or accept the flash deliberately and document it.

## Slice 2 — Repeater children must be laid out (the real defect)

[`Columns.tsx:119-134`](../../../packages/noodl-viewer-react/src/components/visual/Columns/Columns.tsx#L119-L134)
filters `ForEachComponent` **out** of `children` and renders it separately at line 154, outside the
`.column-item` wrapper that carries the width:

```jsx
{forEachComponent && forEachComponent}
{children.map((child, i) => <div className="column-item" style={{ width: … }}>…</div>)}
```

with the comment "ForEachComponent breaks the layout but is needed to send onMount/onUnmount". So
**Columns + Repeater — the most common reason to use Columns — produces unwrapped, unsized children.**

The fix is to stop treating the ForEach component as a layout participant. It exists to emit
mount/unmount, not to render a box. Options, in preference order:

1. Have `ForEachComponent` render as a fragment so its children land directly in the parent's child
   list and get wrapped normally. Best if the mount/unmount plumbing survives it.
2. Have Columns wrap the ForEach's *children* rather than the ForEach itself, walking one level.
   Fragile, but local.
3. Move mount/unmount emission off the rendered component entirely. Cleanest, largest blast radius —
   the Repeater is not the only consumer.

**Checked:** `Columns.tsx` is the *only* file that special-cases `ForEachComponent` (lines 3, 124,
129, 132). `Group` and the other containers do not, which is why they lay repeater children out fine.
That makes option 1 the most attractive — if a fragment render works for Columns, nothing else needs
to change — and it means this defect is genuinely one file, not a pattern.

## Slice 3 — Breakpoints

The entire responsive API today is one `layoutString` (`'1 2 1'`) plus one `minWidth`
([`columns.ts:40-100`](../../../packages/noodl-viewer-react/src/nodes/visual/columns.ts#L40-L100)),
and the only adaptive behaviour is popping columns off the end. There is no way to say "3 up on
desktop, 2 on tablet, 1 on mobile", which is the request every real layout makes.

Design decision for Richard: **per-breakpoint layout strings** (`'1 2 1'` / `'1 1'` / `'1'` with
authorable widths) versus **auto-fit from a min column width** (CSS `repeat(auto-fit, minmax(…))`).
Recommend supporting both — auto-fit covers most cases with one input and no breakpoint management,
explicit breakpoints cover the rest. The existing `minWidth` port is already halfway to auto-fit.

Note the editor has no breakpoint concept today, so this may need a project-level breakpoint set
rather than per-node values. Check what the styles system (Phase 9) already has before inventing one.

## Slice 4 — Masonry

Only after slices 2 and 3. Masonry over a repeater is the actual request, and it is meaningless while
repeater children are not laid out at all.

Implementation note: CSS `columns` gives masonry cheaply but reorders children top-to-bottom within
each column, which is usually wrong for a list. A JS-measured absolute layout preserves order but
needs the `ResizeObserver` work from slice 1 to be solid. Decide explicitly and document which
ordering an author gets.

## Success criteria

1. Corpus row F3 green (Columns + Repeater children carry widths).
2. `calcAutofold` does not mutate its argument; add a unit test.
3. A layout can be expressed per breakpoint, verified in the screenshot corpus at ≥2 widths.
4. Masonry over a repeater renders, with documented ordering.
5. Live-verified in the editor and in a deployed build — the SSR/first-paint behaviour differs.
