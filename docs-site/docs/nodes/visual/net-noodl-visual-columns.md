---
title: "Columns"
---
Responsive multi-column layout: distributes its children into columns whose relative widths come from a layout string.

Columns lays out its visual children in a grid of columns described by `layoutString`: a space-separated list of relative widths, so '1 2 1' means three columns where the middle one is twice as wide as the outer ones (default '1 2 1'). Children fill the columns in order and wrap into further rows when there are more children than columns. `marginX` (Horizontal Gap) and `marginY` (Vertical Gap) set the spacing in pixels (default 16), and `minWidth` (Min Column Width) makes the layout responsive: when the container gets too narrow to honour the minimum, columns fold away and content reflows into fewer, wider columns. `direction` flips the fill order between row and column, and `justifyContent` aligns partial rows. The node warns in the editor if `layoutString` is bound to a non-string.

## When to use it

Card grids, dashboards, magazine-style layouts — anywhere content should reflow across a variable number of columns. For a fixed row or column of items a plain Group with `flexDirection` is simpler; for one instance per data record put a For Each inside the Columns.

## At a glance

| | |
|---|---|
| Category | Visual |
| Type name | `net.noodl.visual.columns` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `cssClassName` | String | `` | Extra CSS class names to put on this element, for styling from a stylesheet you supply |
| `direction` | Enum (`row`, `column`) | `row` | Whether items fill across rows or down columns |
| `justifyContent` | Enum (`flex-start`, `flex-end`, `center`) | `flex-start` | Where the columns sit as a group when they do not fill the container |
| `layoutString` | String | `1 2 1` | Column widths as space-separated proportions, so "1 2 1" makes the middle column twice as wide |
| `marginX` | Number | `16` | Space between columns, drawn as a gutter rather than as padding on the items |
| `marginY` | Number | `16` | Space between rows |
| `mediumBreakpoint` | Number | — | Container width below which Medium Layout replaces Layout String; this is the container, not the viewport |
| `mediumLayout` | String | — | Layout String to use below Medium Below; leaving it blank makes the breakpoint inert |
| `minWidth` | Number | `0` | Columns are dropped from the end rather than shrink below this; with Auto Fit it decides how many there are |
| `mounted` | Boolean | `true` | Removes the element from the page entirely when false, unlike Visible which leaves its space behind |
| `packing` | Enum (`rows`, `masonry`) | `rows` | Rows makes every item in a row as tall as the tallest; Masonry lets each column pack independently |
| `sizing` | Enum (`layoutString`, `autoFit`) | `layoutString` | Layout String sets the columns explicitly; Auto Fit derives them from Min Column Width and the space available |
| `smallBreakpoint` | Number | — | Container width below which Small Layout replaces the others; it wins over Medium Below |
| `smallLayout` | String | — | Layout String to use below Small Below; leaving it blank makes the breakpoint inert |
| `styleCss` | String | `/* background-color: red; */` | Raw CSS declarations applied to this element, overriding the styling ports above |
| `variant` | String | — | Name of a saved variant of this node type to apply, replacing the styling set here |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `boundingHeight` | Number | — | Height this element actually ended up with after layout, in pixels |
| `boundingWidth` | Number | — | Width this element actually ended up with after layout, in pixels |
| `childIndex` | Number | — | This element's position among its parent's children, counting from 0 |
| `childrenCount` | Number | — | How many child elements are currently mounted inside this one |
| `screenPositionX` | Number | — | Distance in pixels from the left edge of the window to this element's left edge |
| `screenPositionY` | Number | — | Distance in pixels from the top edge of the window to this element's top edge |
| `this` | Reference | — | A reference to this node itself, for ports that take a node rather than a value |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `didMount` | Signal | — | Fires once this element has been added to the page and can be measured |
| `willUnmount` | Signal | — | Fires just before this element is removed from the page, while it still exists |

## Patterns

- Responsive card grid: layoutString '1 1 1' + `minWidth` ~200 so three columns collapse to two, then one, as the viewport narrows.
- For Each inside Columns: repeated component instances distribute across the columns automatically.

## Examples

**Media card row: Columns layout with Image, Icon and Circle**

A card layout composed from the visual primitives: Columns (net.noodl.visual.columns) distributes its children by a layout string ('1 2' — the second column twice as wide), the Image shows a picture from a URL/asset on `src`, the Icon (net.noodl.visual.icon) renders a themed glyph, and the Circle doubles as a status dot whose `fillColor` is data-driven. Layout is containment; only the dynamic bits (image source, status color) are wired.

## Related nodes

[Group](./group.md), [Repeater](./for-each.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
