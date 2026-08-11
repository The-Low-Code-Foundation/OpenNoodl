---
title: "Label"
---
:::warning Deprecated
This node is deprecated and kept only so existing projects keep working. It is not offered in the node picker for new use.
:::

Legacy text-label visual, hidden from the node picker — superseded by Text.

The original Label visual (an HTML label element with a text style), kept only so old projects load. Text supersedes it for all display text; for form-control captions the modern controls carry their own labels.

## When to use it

Do not use in new graphs — use Text instead.

## At a glance

| | |
|---|---|
| Category | Visual |
| Type name | `Label` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `alignX` | Enum (`left`, `center`, `right`) | — | Horizontal alignment of this element within the space its parent gives it |
| `alignY` | Enum (`top`, `center`, `bottom`) | — | Vertical alignment of this element within the space its parent gives it |
| `borderBottomColor` | Color | — | Colour of the bottom edge only, overriding Border Color |
| `borderBottomLeftRadius` | Number | — | Rounds the bottom-left corner only, overriding Corner Radius |
| `borderBottomRightRadius` | Number | — | Rounds the bottom-right corner only, overriding Corner Radius |
| `borderBottomStyle` | Enum (`none`, `solid`, `dotted`, `dashed`) | — | Line style for the bottom edge only, overriding Border Style; None hides that edge |
| `borderBottomWidth` | Number | — | Thickness of the bottom edge in pixels, and it adds to the element's size |
| `borderColor` | Color | `#000000` | Colour of the border, which has no effect while Border Style is None |
| `borderLeftColor` | Color | — | Colour of the left edge only, overriding Border Color |
| `borderLeftStyle` | Enum (`none`, `solid`, `dotted`, `dashed`) | — | Line style for the left edge only, overriding Border Style; None hides that edge |
| `borderLeftWidth` | Number | — | Thickness of the left edge in pixels, and it adds to the element's size |
| `borderRadius` | Number | `0` | Rounds all four corners, except any corner that sets its own radius |
| `borderRightColor` | Color | — | Colour of the right edge only, overriding Border Color |
| `borderRightStyle` | Enum (`none`, `solid`, `dotted`, `dashed`) | — | Line style for the right edge only, overriding Border Style; None hides that edge |
| `borderRightWidth` | Number | — | Thickness of the right edge in pixels, and it adds to the element's size |
| `borderStyle` | Enum (`none`, `solid`, `dotted`, `dashed`) | `none` | Line style for all four edges; None hides the border and leaves Border Width and Color inactive |
| `borderTopColor` | Color | — | Colour of the top edge only, overriding Border Color |
| `borderTopLeftRadius` | Number | — | Rounds the top-left corner only, overriding Corner Radius |
| `borderTopRightRadius` | Number | — | Rounds the top-right corner only, overriding Corner Radius |
| `borderTopStyle` | Enum (`none`, `solid`, `dotted`, `dashed`) | — | Line style for the top edge only, overriding Border Style; None hides that edge |
| `borderTopWidth` | Number | — | Thickness of the top edge in pixels, and it adds to the element's size |
| `borderWidth` | Number | `2` | Thickness of the border in pixels, which adds to the element's size unless Box Sizing accounts for it |
| `color` | Color | — | Colour of the text itself, not of the element behind it |
| `cssClassName` | String | `` | Extra CSS class names to put on this element, for styling from a stylesheet you supply |
| `fontFamily` | Font | — | Typeface to render the text in, either a web-safe family name or a font file added to the project |
| `fontSize` | Number | — | Height of the text, in pixels |
| `fontStyle` | Enum (`normal`, `italic`) | `normal` | Renders the text upright or italic |
| `fontWeight` | Number | `Auto` | How heavy the text is drawn, from 100 (thin) to 900 (black); leave as Auto to use the weight the font family sets |
| `for` | String | — | — |
| `height` | Dimension | `100` | Height of the element; how the value is read depends on Size Mode |
| `letterSpacing` | Number | `Auto` | Extra space added between characters; leave as Auto to use the spacing built into the font |
| `lineHeight` | Number | `Auto` | Vertical space each line of text occupies; leave as Auto to follow the font |
| `marginBottom` | Number | — | Space outside the element's bottom edge, between it and its neighbours |
| `marginLeft` | Number | — | Space outside the element's left edge, between it and its neighbours |
| `marginRight` | Number | — | Space outside the element's right edge, between it and its neighbours |
| `marginTop` | Number | — | Space outside the element's top edge, between it and its neighbours |
| `maxHeight` | Number | — | Largest height the element may grow to, taking priority over Height |
| `maxWidth` | Number | — | Largest width the element may grow to, taking priority over Width |
| `minHeight` | Number | — | Smallest height the element may shrink to, taking priority over Height |
| `minWidth` | Number | — | Smallest width the element may shrink to, taking priority over Width |
| `mixBlendMode` | Enum (`normal`, `multiply`, `screen`, `overlay`, `darken`, `lighten`, `color-dodge`, `color-burn`, `hard-light`, `soft-light`, `difference`, `exclusion`, `hue`, `saturation`, `color`, `luminosity`) | `normal` | How this element's colours blend with whatever is painted behind it |
| `mounted` | Boolean | `true` | Removes the element from the page entirely when false, unlike Visible which leaves its space behind |
| `opacity` | Number | `1` | How opaque this element is, from 0 for invisible to 1 for solid |
| `position` | Enum (`relative`, `absolute`, `sticky`, `fixed`) | `relative` | How the element is placed: In Layout follows its siblings, Absolute ignores them, Sticky pins to the parent edge on overflow, Fixed stays put and takes no space |
| `sizeMode` | Enum (`explicit`, `contentWidth`, `contentHeight`, `contentSize`) | `contentSize` | Whether Width and Height are used as given, or the element sizes itself to fit its contents |
| `styleCss` | String | `/* background-color: red; */` | Raw CSS declarations applied to this element, overriding the styling ports above |
| `text` | String | — | — |
| `textStyle` | TextStyle | `None` | Applies one of the project's saved text styles; the individual font ports below override whatever it sets |
| `textTransform` | Enum (`none`, `uppercase`, `lowercase`, `capitalize`) | `none` | Forces the text to upper case, lower case or capitalised without changing the underlying value |
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
| `screenPositionX` | Number | — | Distance in pixels from the left edge of the window to this element's left edge |
| `screenPositionY` | Number | — | Distance in pixels from the top edge of the window to this element's top edge |
| `this` | Reference | — | A reference to this node itself, for ports that take a node rather than a value |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `didMount` | Signal | — | Fires once this element has been added to the page and can be measured |
| `willUnmount` | Signal | — | Fires just before this element is removed from the page, while it still exists |

## Dynamic ports

_This node's port list changes at runtime (declared-port-groups); the tables above may be incomplete for a given instance._

Declares conditional/expandable port groups whose visibility depends on parameter values (see declaredPortGroups).

| Condition | Inputs shown | Outputs shown |
|---|---|---|
| sizeMode = explicit OR sizeMode = contentHeight | `width` | — |
| sizeMode = explicit OR sizeMode = contentWidth | `height` | — |
| borderStyle = solid OR borderStyle = dashed OR borderStyle = dotted  | `borderWidth`, `borderColor` | — |
| borderLeftStyle = solid OR borderLeftStyle = dashed OR borderLeftStyle = dotted OR borderStyle = solid OR borderStyle = dashed OR borderStyle = dotted  | `borderLeftWidth`, `borderLeftColor` | — |
| borderTopStyle = solid OR borderTopStyle = dashed OR borderTopStyle = dotted OR borderStyle = solid OR borderStyle = dashed OR borderStyle = dotted  | `borderTopWidth`, `borderTopColor` | — |
| borderRightStyle = solid OR borderRightStyle = dashed OR borderRightStyle = dotted OR borderStyle = solid OR borderStyle = dashed OR borderStyle = dotted  | `borderRightWidth`, `borderRightColor` | — |
| borderBottomStyle = solid OR borderBottomStyle = dashed OR borderBottomStyle = dotted OR borderStyle = solid OR borderStyle = dashed OR borderStyle = dotted  | `borderBottomWidth`, `borderBottomColor` | — |

## Ports at runtime

Declared-port-groups gate width/height and border ports on parameter values; irrelevant for new work — the node is hidden from the picker.

## Related nodes

[Text](./text.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
