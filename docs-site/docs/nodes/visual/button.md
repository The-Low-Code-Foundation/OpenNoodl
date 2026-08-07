---
title: "Button"
---
:::warning Deprecated
This node is deprecated and kept only so existing projects keep working. It is not offered in the node picker for new use.
:::

Legacy button visual, hidden from the node picker — superseded by net.noodl.controls.button.

The original Button visual, kept only so old projects load. The Button control (net.noodl.controls.button) supersedes it with label/icon layout, hover/pressed/focus states and accessibility.

## When to use it

Do not use in new graphs — use net.noodl.controls.button instead.

## At a glance

| | |
|---|---|
| Category | Visual |
| Type name | `Button` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `alignX` | Enum (`left`, `center`, `right`) | — | Horizontal alignment of this element within the space its parent gives it |
| `alignY` | Enum (`top`, `center`, `bottom`) | — | Vertical alignment of this element within the space its parent gives it |
| `backgroundColor` | Color | `#000000` | — |
| `blockTouch` | Boolean | — | — |
| `borderColor` | Color | `#000000` | — |
| `borderRadius` | Number | `0` | — |
| `borderStyle` | Enum (`none`, `solid`, `dotted`, `dashed`) | `none` | — |
| `borderWidth` | Number | `0` | — |
| `boxShadowBlurRadius` | Number | `5` | — |
| `boxShadowColor` | Color | `rgba(0,0,0,0.2)` | — |
| `boxShadowEnabled` | Boolean | `false` | — |
| `boxShadowInset` | Boolean | `false` | — |
| `boxShadowOffsetX` | Number | `0` | — |
| `boxShadowOffsetY` | Number | `0` | — |
| `boxShadowSpreadRadius` | Number | `2` | — |
| `buttonType` | Enum (`button`, `submit`) | `button` | — |
| `clickBubbling` | Enum (`auto`, `always`, `never`) | `auto` | — |
| `color` | Color | `#FFFFFF` | — |
| `cssClassName` | String | `` | Extra CSS class names to put on this element, for styling from a stylesheet you supply |
| `enabled` | Boolean | `true` | — |
| `fontFamily` | Font | — | — |
| `fontSize` | Number | — | — |
| `height` | Dimension | `100` | Height of the element; how the value is read depends on Size Mode |
| `label` | String | `Label` | — |
| `marginBottom` | Number | — | Space outside the element's bottom edge, between it and its neighbours |
| `marginLeft` | Number | — | Space outside the element's left edge, between it and its neighbours |
| `marginRight` | Number | — | Space outside the element's right edge, between it and its neighbours |
| `marginTop` | Number | — | Space outside the element's top edge, between it and its neighbours |
| `mixBlendMode` | Enum (`normal`, `multiply`, `screen`, `overlay`, `darken`, `lighten`, `color-dodge`, `color-burn`, `hard-light`, `soft-light`, `difference`, `exclusion`, `hue`, `saturation`, `color`, `luminosity`) | `normal` | How this element's colours blend with whatever is painted behind it |
| `mounted` | Boolean | `true` | Removes the element from the page entirely when false, unlike Visible which leaves its space behind |
| `opacity` | Number | `1` | How opaque this element is, from 0 for invisible to 1 for solid |
| `paddingBottom` | Number | `5` | — |
| `paddingLeft` | Number | `20` | — |
| `paddingRight` | Number | `20` | — |
| `paddingTop` | Number | `5` | — |
| `position` | Enum (`relative`, `absolute`, `sticky`, `fixed`) | `relative` | How the element is placed: In Layout follows its siblings, Absolute ignores them, Sticky pins to the parent edge on overflow, Fixed stays put and takes no space |
| `sizeMode` | Enum (`explicit`, `contentWidth`, `contentHeight`, `contentSize`) | `contentSize` | Whether Width and Height are used as given, or the element sizes itself to fit its contents |
| `styleCss` | String | `/* background-color: red; */` | Raw CSS declarations applied to this element, overriding the styling ports above |
| `textStyle` | TextStyle | `None` | — |
| `transformOriginX` | Number | `50` | Horizontal point the element rotates and scales around, as a fraction of its width |
| `transformOriginY` | Number | `50` | Vertical point the element rotates and scales around, as a fraction of its height |
| `transformRotation` | Number | `0` | Rotates the element clockwise in degrees, without affecting the layout |
| `transformScale` | Number | `1` | Scales the element about its transform origin; 1 leaves it unscaled |
| `transformX` | Number | `0` | Moves the element right after layout, without moving its siblings |
| `transformY` | Number | `0` | Moves the element down after layout, without moving its siblings |
| `variant` | String | — | Name of a saved variant of this node type to apply, replacing the styling set here |
| `visible` | Boolean | `true` | Hides the element while keeping the space it occupies in the layout |
| `width` | Dimension | `100` | Width of the element; how the value is read depends on Size Mode |
| `zIndex` | Number | — | Paint order among overlapping siblings; higher numbers paint on top |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `boundingHeight` | Number | — | Height this element actually ended up with after layout, in pixels |
| `boundingWidth` | Number | — | Width this element actually ended up with after layout, in pixels |
| `childIndex` | Number | — | This element's position among its parent's children, counting from 0 |
| `childrenCount` | Number | — | How many child elements are currently mounted inside this one |
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
| `onClick` | Signal | — | — |
| `onFocus` | Signal | — | — |
| `pointerDown` | Signal | — | — |
| `pointerUp` | Signal | — | — |
| `willUnmount` | Signal | — | Fires just before this element is removed from the page, while it still exists |

## Dynamic ports

_This node's port list changes at runtime (declared-port-groups); the tables above may be incomplete for a given instance._

Declares conditional/expandable port groups whose visibility depends on parameter values (see declaredPortGroups).

| Condition | Inputs shown | Outputs shown |
|---|---|---|
| boxShadowEnabled = true | `boxShadowOffsetX`, `boxShadowOffsetY`, `boxShadowInset`, `boxShadowBlurRadius`, `boxShadowSpreadRadius`, `boxShadowColor` | — |
| sizeMode = explicit OR sizeMode = contentHeight | `width` | — |
| sizeMode = explicit OR sizeMode = contentWidth | `height` | — |

## Ports at runtime

Declared-port-groups gate box-shadow and width/height ports on parameter values; irrelevant for new work — the node is hidden from the picker.

## Related nodes

[Button](./net-noodl-controls-button.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
