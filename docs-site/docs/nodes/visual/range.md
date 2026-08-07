---
title: "Range"
---
:::warning Deprecated
This node is deprecated and kept only so existing projects keep working. It is not offered in the node picker for new use.
:::

Legacy slider visual, hidden from the node picker — superseded by net.noodl.controls.range (Slider).

The original Range (slider) visual, kept only so old projects load. The Slider control (net.noodl.controls.range) supersedes it with min/max/step value binding, visual states and accessibility.

## When to use it

Do not use in new graphs — use net.noodl.controls.range instead.

## At a glance

| | |
|---|---|
| Category | Visual |
| Type name | `Range` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `alignX` | Enum (`left`, `center`, `right`) | — | Horizontal alignment of this element within the space its parent gives it |
| `alignY` | Enum (`top`, `center`, `bottom`) | — | Vertical alignment of this element within the space its parent gives it |
| `backgroundColor` | Color | — | — |
| `blockTouch` | Boolean | — | — |
| `borderColor` | Color | `#000000` | — |
| `borderRadius` | Number | `1` | — |
| `borderStyle` | Enum (`none`, `solid`, `dotted`, `dashed`) | `none` | — |
| `borderWidth` | Number | `1` | — |
| `clickBubbling` | Enum (`auto`, `always`, `never`) | `auto` | — |
| `cssClassName` | String | `` | Extra CSS class names to put on this element, for styling from a stylesheet you supply |
| `enabled` | Boolean | `true` | — |
| `height` | Number | `100` | — |
| `marginBottom` | Number | — | Space outside the element's bottom edge, between it and its neighbours |
| `marginLeft` | Number | — | Space outside the element's left edge, between it and its neighbours |
| `marginRight` | Number | — | Space outside the element's right edge, between it and its neighbours |
| `marginTop` | Number | — | Space outside the element's top edge, between it and its neighbours |
| `max` | Number | `100` | — |
| `min` | Number | `0` | — |
| `mixBlendMode` | Enum (`normal`, `multiply`, `screen`, `overlay`, `darken`, `lighten`, `color-dodge`, `color-burn`, `hard-light`, `soft-light`, `difference`, `exclusion`, `hue`, `saturation`, `color`, `luminosity`) | `normal` | How this element's colours blend with whatever is painted behind it |
| `mounted` | Boolean | `true` | Removes the element from the page entirely when false, unlike Visible which leaves its space behind |
| `opacity` | Number | `1` | How opaque this element is, from 0 for invisible to 1 for solid |
| `position` | Enum (`relative`, `absolute`, `sticky`, `fixed`) | `relative` | How the element is placed: In Layout follows its siblings, Absolute ignores them, Sticky pins to the parent edge on overflow, Fixed stays put and takes no space |
| `step` | Number | `1` | — |
| `styleCss` | String | `/* background-color: red; */` | Raw CSS declarations applied to this element, overriding the styling ports above |
| `thumbColor` | Color | `#000000` | — |
| `thumbHeight` | Number | `16` | — |
| `thumbRadius` | Number | `8` | — |
| `thumbWidth` | Number | `16` | — |
| `trackColor` | Color | `#f0f0f0` | — |
| `trackHeight` | Number | `6` | — |
| `transformOriginX` | Number | `50` | Horizontal point the element rotates and scales around, as a fraction of its width |
| `transformOriginY` | Number | `50` | Vertical point the element rotates and scales around, as a fraction of its height |
| `transformRotation` | Number | `0` | Rotates the element clockwise in degrees, without affecting the layout |
| `transformScale` | Number | `1` | Scales the element about its transform origin; 1 leaves it unscaled |
| `transformX` | Number | `0` | Moves the element right after layout, without moving its siblings |
| `transformY` | Number | `0` | Moves the element down after layout, without moving its siblings |
| `value` | String | — | — |
| `variant` | String | — | Name of a saved variant of this node type to apply, replacing the styling set here |
| `visible` | Boolean | `true` | Hides the element while keeping the space it occupies in the layout |
| `width` | Number | `100` | — |
| `zIndex` | Number | — | Paint order among overlapping siblings; higher numbers paint on top |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `boundingHeight` | Number | — | Height this element actually ended up with after layout, in pixels |
| `boundingWidth` | Number | — | Width this element actually ended up with after layout, in pixels |
| `childIndex` | Number | — | This element's position among its parent's children, counting from 0 |
| `controlId` | String | — | — |
| `enabled` | Boolean | — | — |
| `focusState` | Boolean | — | — |
| `hoverState` | Boolean | — | — |
| `pressedState` | Boolean | — | — |
| `screenPositionX` | Number | — | Distance in pixels from the left edge of the window to this element's left edge |
| `screenPositionY` | Number | — | Distance in pixels from the top edge of the window to this element's top edge |
| `this` | Reference | — | A reference to this node itself, for ports that take a node rather than a value |
| `value` | Number | — | — |
| `valuePercent` | Number | — | — |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `didMount` | Signal | — | Fires once this element has been added to the page and can be measured |
| `hoverEnd` | Signal | — | — |
| `hoverStart` | Signal | — | — |
| `onBlur` | Signal | — | — |
| `onChange` | Signal | — | — |
| `onFocus` | Signal | — | — |
| `pointerDown` | Signal | — | — |
| `pointerUp` | Signal | — | — |
| `willUnmount` | Signal | — | Fires just before this element is removed from the page, while it still exists |

## Related nodes

[Slider](./net-noodl-controls-range.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
