---
title: "Radio Button"
---
:::warning Deprecated
This node is deprecated and kept only so existing projects keep working. It is not offered in the node picker for new use.
:::

Legacy radio-button visual, hidden from the node picker — superseded by net.noodl.controls.radiobutton.

The original Radio Button visual, kept only so old projects load. The Radio Button control (net.noodl.controls.radiobutton), used inside a Radio Button Group, supersedes it with group value handling, visual states and accessibility.

## When to use it

Do not use in new graphs — use net.noodl.controls.radiobutton instead.

## At a glance

| | |
|---|---|
| Category | Visual |
| Type name | `Radio Button` |
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
| `borderRadius` | Number | `16` | — |
| `borderStyle` | Enum (`none`, `solid`, `dotted`, `dashed`) | `solid` | — |
| `borderWidth` | Number | `1` | — |
| `boxShadowBlurRadius` | Number | `5` | — |
| `boxShadowColor` | Color | `rgba(0,0,0,0.2)` | — |
| `boxShadowEnabled` | Boolean | `false` | — |
| `boxShadowInset` | Boolean | `false` | — |
| `boxShadowOffsetX` | Number | `0` | — |
| `boxShadowOffsetY` | Number | `0` | — |
| `boxShadowSpreadRadius` | Number | `2` | — |
| `checkedBackgroundColor` | Color | `#000000` | — |
| `clickBubbling` | Enum (`auto`, `always`, `never`) | `auto` | — |
| `cssClassName` | String | `` | Extra CSS class names to put on this element, for styling from a stylesheet you supply |
| `enabled` | Boolean | `true` | — |
| `height` | Number | `32` | — |
| `marginBottom` | Number | — | Space outside the element's bottom edge, between it and its neighbours |
| `marginLeft` | Number | — | Space outside the element's left edge, between it and its neighbours |
| `marginRight` | Number | — | Space outside the element's right edge, between it and its neighbours |
| `marginTop` | Number | — | Space outside the element's top edge, between it and its neighbours |
| `mixBlendMode` | Enum (`normal`, `multiply`, `screen`, `overlay`, `darken`, `lighten`, `color-dodge`, `color-burn`, `hard-light`, `soft-light`, `difference`, `exclusion`, `hue`, `saturation`, `color`, `luminosity`) | `normal` | How this element's colours blend with whatever is painted behind it |
| `mounted` | Boolean | `true` | Removes the element from the page entirely when false, unlike Visible which leaves its space behind |
| `opacity` | Number | `1` | How opaque this element is, from 0 for invisible to 1 for solid |
| `position` | Enum (`relative`, `absolute`, `sticky`, `fixed`) | `relative` | How the element is placed: In Layout follows its siblings, Absolute ignores them, Sticky pins to the parent edge on overflow, Fixed stays put and takes no space |
| `styleCss` | String | `/* background-color: red; */` | Raw CSS declarations applied to this element, overriding the styling ports above |
| `transformOriginX` | Number | `50` | Horizontal point the element rotates and scales around, as a fraction of its width |
| `transformOriginY` | Number | `50` | Vertical point the element rotates and scales around, as a fraction of its height |
| `transformRotation` | Number | `0` | Rotates the element clockwise in degrees, without affecting the layout |
| `transformScale` | Number | `1` | Scales the element about its transform origin; 1 leaves it unscaled |
| `transformX` | Number | `0` | Moves the element right after layout, without moving its siblings |
| `transformY` | Number | `0` | Moves the element down after layout, without moving its siblings |
| `value` | String | — | — |
| `variant` | String | — | Name of a saved variant of this node type to apply, replacing the styling set here |
| `visible` | Boolean | `true` | Hides the element while keeping the space it occupies in the layout |
| `width` | Number | `32` | — |
| `zIndex` | Number | — | Paint order among overlapping siblings; higher numbers paint on top |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `boundingHeight` | Number | — | Height this element actually ended up with after layout, in pixels |
| `boundingWidth` | Number | — | Width this element actually ended up with after layout, in pixels |
| `checked` | Boolean | — | — |
| `childIndex` | Number | — | This element's position among its parent's children, counting from 0 |
| `controlId` | String | — | — |
| `enabled` | Boolean | — | — |
| `focusState` | Boolean | — | — |
| `hoverState` | Boolean | — | — |
| `pressedState` | Boolean | — | — |
| `screenPositionX` | Number | — | Distance in pixels from the left edge of the window to this element's left edge |
| `screenPositionY` | Number | — | Distance in pixels from the top edge of the window to this element's top edge |
| `this` | Reference | — | A reference to this node itself, for ports that take a node rather than a value |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `didMount` | Signal | — | Fires once this element has been added to the page and can be measured |
| `hoverEnd` | Signal | — | — |
| `hoverStart` | Signal | — | — |
| `onBlur` | Signal | — | — |
| `onFocus` | Signal | — | — |
| `pointerDown` | Signal | — | — |
| `pointerUp` | Signal | — | — |
| `willUnmount` | Signal | — | Fires just before this element is removed from the page, while it still exists |

## Related nodes

[Radio Button](./net-noodl-controls-radiobutton.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
