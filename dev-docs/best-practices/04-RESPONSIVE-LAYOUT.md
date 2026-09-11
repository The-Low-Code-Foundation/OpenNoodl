# 04 — Responsive layout: one node reflows, nothing else does

## The single most important fact in this folder

> **`net.noodl.visual.columns` is the only node in the NodeGX runtime with any breakpoint concept.**

Verified by grepping the whole viewer for a media query or a breakpoint: it appears nowhere else.
There is **no responsive node**, no project-level viewport setting, and no responsive form of
`fontSize`.

The consequence is severe and non-obvious: **a `Group` row never reflows.** A two-column hero built
from Groups is still two columns at 390px. A card given `width: 32%` is 120px wide on a phone. It
does not degrade — it just stays exactly as authored while the screen shrinks around it.

So: **anything arranged in more than one column must be a `Columns` node.** Not a Group with
`flexDirection: row`. Not a Group with `flexWrap: wrap` and percentage tracks — that version at least
adds up on a desktop, but it can never collapse, which makes it a desktop-only layout with extra
steps.

## The two ways to use it

### Unknown-length lists → `autoFit`

```
sizing: "autoFit"
minWidth: 280px
marginX: 12px
```

No breakpoints to maintain. It fits as many columns as the container can hold at that minimum width
and reflows on its own. **This is the right default for anything fed by a Repeater** — a product
grid, a post list, a tile wall.

### Fixed arrangements → a layout string plus breakpoints

```
layoutString: "1 1 1 1"     // four equal columns
mediumBreakpoint: 900px, mediumLayout: "1 1"
smallBreakpoint:  560px, smallLayout:  "1"
marginX: 20px
```

Use for a known set: a 2-up hero (`"1 1"`, or `"2 1"` for an uneven split), a 3-up feature strip, a
4-up footer, a stat row. Leaving a breakpoint's layout blank makes that breakpoint inert, which is
the documented way to have only one.

## Breakpoints are container width, not viewport width

This is better than it sounds. The same component behaves correctly inside a sidebar, a modal, or a
repeater cell, because it responds to the box it is actually in rather than to the window. It also
means you cannot reason about breakpoints by thinking about device sizes alone — think about how wide
the container will be.

## Columns and Repeaters work together by design

A `For Each` inside a `Columns` node is the intended shape. The Repeater draws nothing itself and
adds its items as siblings, so `Columns` skips the Repeater and gives each real item a column box.
Pinned by 35 existing corpus specs — this is not a workaround.

Because the column supplies the track, **the item component should be `width: 100%`**. That is what
makes one card component work in a 4-up grid, a 2-up related-items row and a sidebar without change.
An item that hardcodes its own percentage width can only ever live in the layout it was written for.

## Type does not scale

`fontSize` has no responsive form. A `--text-6xl` display headline is 60px on a phone, where it will
wrap to five lines and dominate the screen.

**Pick the display size that survives 390px** — usually `--text-4xl` or `--text-5xl` — rather than
the one that looks best at 1440px. The same applies to fixed image heights and to any generous
`padding` on a band: what reads as confident whitespace on a desktop is most of a phone screen.

## Verify it, because it is not visible in the graph

Nothing about a graph tells you it breaks at 390px. Render it and measure:

1. Nothing exceeds the viewport — `el.getBoundingClientRect().width > window.innerWidth` should find
   nothing, and `document.documentElement.scrollWidth` should equal the viewport width.
2. Every multi-column band has become one column.
3. The display headline still fits in two or three lines.

Chrome will not open a window narrower than about 500px, so a real mobile width has to come from
CDP's `Emulation.setDeviceMetricsOverride` rather than `--window-size`. Measuring 390 and being handed
500 is the harness lying about the exact thing under test.

## The short version

| You want | Use |
|---|---|
| A grid of unknown length | `Columns`, `sizing: autoFit`, `minWidth` 260–320px |
| A fixed 2/3/4-up that must collapse | `Columns`, `layoutString` + small/medium breakpoints |
| A row of things that should shrink but never wrap | a `Group` row (unwrapped children DO shrink) |
| A wrapped grid of Groups | **nothing — this cannot collapse; use `Columns`** |
| Responsive type | not available; choose a size that works small |
