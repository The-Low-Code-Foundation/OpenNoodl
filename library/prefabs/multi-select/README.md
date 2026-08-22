# Multi Select

One prefab, three display variants of the same multi-select input. Installing it
adds a `Multi Select` folder with three drop-in components — pick the one that
fits your UI (they share the same inputs and outputs, so swapping later is
painless):

| Component | Looks like |
|---|---|
| `Multi Select/List` | A labelled checkbox group |
| `Multi Select/Pills` | A row of toggleable pill buttons (wraps) |
| `Multi Select/Dropdown` | A drop-down; selected items render as removable pills above it |

This entry replaces the former **Multi Choice**, **Selection Pills**, and
**Multi Choice with Pills** prefabs (merged 2026-08-22).

## Feeding items

All variants take the same data inputs:

- **Options** (array) — the values to choose from, e.g. from an Expression or
  Function node: `['one','two','three']`. Each option becomes one checkbox /
  pill / drop-down row. Items are created when Options arrives; with nothing
  connected the components fall back to a `['one','two','three']` demo array on
  their internal Initialize function.
- **Labels** (array, optional) — display text per option, index-aligned with
  Options. Omit it and the option values themselves are shown.
- **Selection** (array, optional) — the initially selected option *values*.

## Reading the selection

- **Selected Items** (array output) — the currently selected option values,
  e.g. `['one','three']`. Connect it to wherever the choice is consumed.
- **Changed** (signal output) — fires every time the user toggles an item
  (and, on Dropdown, when a pill is removed). Use it to trigger saves or
  filtering.

## Variant-specific ports

- `List`: **Label** (string) sets the group heading above the checkboxes.
- `Dropdown`: **Label** / **Show Label** control the heading; **Reset** (signal
  input) clears the whole selection; the drop-down sheet closes when the
  component loses focus.
- `List` and `Dropdown` expose **Item Template** / **Option Template** /
  **Pill Template** inputs if you want to swap in your own row/pill component —
  leave them unconnected to use the built-in ones.

All variants also expose the usual layout passthroughs (margins, alignment,
position, width).

## Styling

Colours come from the project style palette the prefab ships (`Primary`,
`White`, `Grey - 500/700/900`) and text styles use Inter (`Label Small`,
`Label Medium`, `Body Medium`) — edit them in the project's style panel to
re-theme every variant at once.
