---
title: "Group"
---
The universal layout container: a flexbox div that stacks its children in a row or column and is the root of most components.

Group is the workhorse visual container. It renders as a flexbox element and lays out its visual children (the `children` list in the project file) along `flexDirection`, with alignment, padding, margins, size, scrolling, borders and background as parameters. Nearly every component's visual tree starts with a Group; nesting Groups is how all layout is composed. It also reports interaction (`onClick`, hover and pointer signals) and geometry (`boundingWidth`/`boundingHeight`, screen position), so it doubles as a click surface.

## When to use it

Reach for Group whenever you need structure: rows, columns, cards, overlays, scroll areas, click targets. Do not use it for text (use Text), images (Image), or button-like affordances with label/icon styling (net.noodl.controls.button).

## At a glance

| | |
|---|---|
| Category | Visual |
| Type name | `Group` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `alignContent` | Enum (`flex-start`, `flex-end`, `center`, `space-between`, `space-around`, `space-evenly`) | — | Where the wrapped lines sit as a group; only applies once Multi Line Wrap is on |
| `alignItems` | Enum (`flex-start`, `flex-end`, `center`) | `flex-start` | Where children sit across the layout direction |
| `alignX` | Enum (`left`, `center`, `right`) | — | Horizontal alignment of this element within the space its parent gives it |
| `alignY` | Enum (`top`, `center`, `bottom`) | — | Vertical alignment of this element within the space its parent gives it |
| `as` | Enum (`div`, `section`, `article`, `aside`, `nav`, `header`, `footer`, `main`, `span`) | `div` | HTML element to render as, which changes nothing visually but matters for screen readers and SEO |
| `backgroundColor` | Color | `transparent` | Fill colour behind the children |
| `blockTouch` | Boolean | — | Stops every pointer event that lands here from reaching the nodes this one sits inside. Blunt: it takes hover and pointer-down with it, so reach for Click Bubbling first if it is only clicks you want to keep in |
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
| `boxShadowBlurRadius` | Number | `5` | How soft the shadow edge is; 0 gives a hard edge |
| `boxShadowColor` | Color | `#00000033` | Colour of the shadow, including how transparent it is |
| `boxShadowEnabled` | Boolean | `false` | Turns the drop shadow on |
| `boxShadowInset` | Boolean | `false` | Draws the shadow inside the element instead of behind it |
| `boxShadowOffsetX` | Number | `0` | How far to the right the shadow is cast from the element |
| `boxShadowOffsetY` | Number | `0` | How far down the shadow is cast from the element |
| `boxShadowSpreadRadius` | Number | `2` | How much larger than the element the shadow is drawn |
| `clickBubbling` | Enum (`auto`, `always`, `never`) | `auto` | Whether a click here also fires Click on the nodes this one sits inside. Automatic keeps it here as soon as this node's own Click is connected, so a button inside a clickable card runs the button and not the card; Always is the older behaviour where both run; Never keeps every click here, wired or not. Note that an element at zero opacity takes no pointer events at all |
| `clip` | Boolean | `false` | Hides any child that overflows the group instead of letting it spill out |
| `columnGap` | Number | `0` | Space between children on the horizontal axis |
| `cssClassName` | String | `` | Extra CSS class names to put on this element, for styling from a stylesheet you supply |
| `flexDirection` | Enum (`none`, `column`, `row`) | `column` | How children are stacked: None positions them absolutely, Vertical stacks them down, Horizontal across |
| `flexWrap` | Enum (`nowrap`, `wrap`, `wrap-reverse`) | `nowrap` | Lets children wrap onto another line when they do not fit on one |
| `height` | Dimension | `100` | Height of the element; how the value is read depends on Size Mode |
| `justifyContent` | Enum (`flex-start`, `flex-end`, `center`, `space-between`, `space-around`, `space-evenly`) | `flex-start` | Where children sit along the layout direction when they do not fill it |
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
| `nativeScroll` | Boolean | `true` | Uses the browser's own scrolling, which is smoother; turn it off to get snapping and the Scroll To actions |
| `opacity` | Number | `1` | How opaque this element is, from 0 for invisible to 1 for solid |
| `paddingBottom` | Number | `0` | Space inside the element's bottom edge, between it and its content |
| `paddingLeft` | Number | `0` | Space inside the element's left edge, between it and its content |
| `paddingRight` | Number | `0` | Space inside the element's right edge, between it and its content |
| `paddingTop` | Number | `0` | Space inside the element's top edge, between it and its content |
| `pointerEventsEnabled` | Boolean | `true` | When disabled, mouse and touch events pass through to whatever is behind this element |
| `pointerEventsMode` | Enum (`inherit`, `explicit`) | `inherit` | Whether pointer handling is inherited from the parent or set explicitly on this element |
| `position` | Enum (`relative`, `absolute`, `sticky`, `fixed`) | `relative` | How the element is placed: In Layout follows its siblings, Absolute ignores them, Sticky pins to the parent edge on overflow, Fixed stays put and takes no space |
| `rowGap` | Number | `0` | Space between children on the vertical axis |
| `scrollBounceEnabled` | Boolean | `true` | Lets the content overscroll and spring back at the ends |
| `scrollEnabled` | Boolean | `false` | Lets the user scroll the children when they do not all fit |
| `scrollSnapEnabled` | Boolean | `false` | Makes scrolling settle on item boundaries rather than anywhere |
| `scrollSnapToEveryItem` | Boolean | `false` | Snaps to each item in turn instead of allowing a fast flick past several |
| `scrollToElement.duration` | Number | `500` | How long the scroll animation takes, in milliseconds; 0 jumps |
| `scrollToElement.element` | Reference | — | Which element to scroll to, taken from another node's DOM Element output |
| `scrollToIndex.duration` | Number | `500` | How long the scroll animation takes, in milliseconds; 0 jumps |
| `scrollToIndex.index` | Number | `0` | Zero-based index of the child to scroll to |
| `showScrollbar` | Boolean | `false` | Shows a scrollbar rather than scrolling invisibly |
| `sizeMode` | Enum (`explicit`, `contentWidth`, `contentHeight`, `contentSize`) | `explicit` | Whether Width and Height are used as given, or the element sizes itself to fit its contents |
| `styleCss` | String | `/* background-color: red; */` | Raw CSS declarations applied to this element, overriding the styling ports above |
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

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `focus` | Signal | — | Gives this group keyboard focus, so key events reach it |
| `scrollToElement.do` | Signal | — | Scrolls to the element on Element; fired in the same frame the Group mounts, it is held until the Group exists rather than dropped |
| `scrollToIndex.do` | Signal | — | Scrolls to the child at Index, then fires Done — or Failure with the reason it could not |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `boundingHeight` | Number | — | Height this element actually ended up with after layout, in pixels |
| `boundingWidth` | Number | — | Width this element actually ended up with after layout, in pixels |
| `childIndex` | Number | — | This element's position among its parent's children, counting from 0 |
| `childrenCount` | Number | — | How many child elements are currently mounted inside this one |
| `onScrollPositionChanged` | Number | — | How far the content is scrolled, in pixels from the start |
| `screenPositionX` | Number | — | Distance in pixels from the left edge of the window to this element's left edge |
| `screenPositionY` | Number | — | Distance in pixels from the top edge of the window to this element's top edge |
| `this` | Reference | — | A reference to this node itself, for ports that take a node rather than a value |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `didMount` | Signal | — | Fires once this element has been added to the page and can be measured |
| `done` | Signal | — | Fires once Focus, Scroll To Element or Scroll To Index has been carried out |
| `focusLost` | Signal | — | Fires when keyboard focus leaves this group |
| `focused` | Signal | — | Fires when this group takes keyboard focus |
| `hoverEnd` | Signal | — | Fires when the pointer leaves this element |
| `hoverStart` | Signal | — | Fires when the pointer moves over this element or any of its children |
| `onClick` | Signal | — | Fires when this element is clicked or tapped |
| `onScrollEnd` | Signal | — | Fires when scrolling settles, including after a flick has coasted to a stop |
| `onScrollStart` | Signal | — | Fires when the user starts scrolling |
| `pointerDown` | Signal | — | Fires when a mouse button is pressed or a finger touches this element |
| `pointerEnter` | Signal | — | Fires when the pointer moves onto this element, not counting its children |
| `pointerUp` | Signal | — | Fires when the mouse button is released or the finger lifts over this element |
| `willUnmount` | Signal | — | Fires just before this element is removed from the page, while it still exists |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `failure` | Signal | — | Fires when the action did nothing and says why on Error — most often a scroll target that is not inside this group, or a group that has still not mounted |

## Dynamic ports

_This node's port list changes at runtime (declared-port-groups); the tables above may be incomplete for a given instance._

Declares conditional/expandable port groups whose visibility depends on parameter values (see declaredPortGroups).

| Condition | Inputs shown | Outputs shown |
|---|---|---|
| flexDirection != none | `scrollEnabled` | — |
| flexDirection != none AND scrollEnabled = true | `nativeScroll` | — |
| flexDirection != none AND scrollEnabled = true AND nativeScroll = false | `scrollBounceEnabled`, `scrollSnapEnabled`, `showScrollbar`, `scrollToElement.do`, `scrollToElement.element`, `scrollToElement.duration`, `scrollToIndex.do`, `scrollToIndex.index`, `scrollToIndex.duration` | — |
| flexDirection != none AND scrollEnabled = true AND scrollSnapEnabled = true | `scrollSnapToEveryItem` | — |
| flexDirection != none | `flexWrap` | — |
| flexWrap = wrap OR flexWrap = wrap-reverse | `alignContent` | — |
| flexDirection = row OR flexWrap = wrap OR flexWrap = wrap-reverse | `columnGap` | — |
| flexDirection = column OR flexWrap = wrap OR flexWrap = wrap-reverse | `rowGap` | — |
| sizeMode = explicit OR sizeMode = contentHeight OR sizeMode NOT SET | `width` | — |
| sizeMode = explicit OR sizeMode = contentWidth OR sizeMode NOT SET | `height` | — |
| pointerEventsMode = explicit | `pointerEventsEnabled` | — |
| borderStyle = solid OR borderStyle = dashed OR borderStyle = dotted  | `borderWidth`, `borderColor` | — |
| borderLeftStyle = solid OR borderLeftStyle = dashed OR borderLeftStyle = dotted OR borderStyle = solid OR borderStyle = dashed OR borderStyle = dotted  | `borderLeftWidth`, `borderLeftColor` | — |
| borderTopStyle = solid OR borderTopStyle = dashed OR borderTopStyle = dotted OR borderStyle = solid OR borderStyle = dashed OR borderStyle = dotted  | `borderTopWidth`, `borderTopColor` | — |
| borderRightStyle = solid OR borderRightStyle = dashed OR borderRightStyle = dotted OR borderStyle = solid OR borderStyle = dashed OR borderStyle = dotted  | `borderRightWidth`, `borderRightColor` | — |
| borderBottomStyle = solid OR borderBottomStyle = dashed OR borderBottomStyle = dotted OR borderStyle = solid OR borderStyle = dashed OR borderStyle = dotted  | `borderBottomWidth`, `borderBottomColor` | — |
| boxShadowEnabled = true | `boxShadowOffsetX`, `boxShadowOffsetY`, `boxShadowInset`, `boxShadowBlurRadius`, `boxShadowSpreadRadius`, `boxShadowColor` | — |

## Ports at runtime

Group's port list is largely static, but several port groups are conditional on parameter values (declared-port-groups): scroll-related ports appear when scrolling is enabled, advanced-dimension ports depend on the size mode, and visual-state variants add ports per state. An authoring tool should treat the catalog's input list as the superset and expect the editor to expose subsets based on the node's current parameters.

## Patterns

- Component root: a single Group at the top of every visual component, `flexDirection` column.
- Scroll list: outer Group with scrolling enabled and `clip` true, Repeater inside.

## Watch out for

- Deeply nesting a Group per style tweak; set padding/margins on the existing Group instead.

## Examples

**List page: Repeater fed by Query Records**

The canonical data-list shape. Query Records (DbCollection2) fetches a database class and exposes the result on its `items` array output; the Repeater (For Each) consumes that array and instantiates its `template` component once per record. Each record's properties are delivered to the item component through Component Inputs whose names match the record's property names — the item component reads them like any other input. The Repeater and its item template component are separate components by design.

**Validate an input before acting on a click**

The idiomatic gate shape: a Button click does not act directly — it evaluates a Condition. The Condition's boolean comes from an Expression that checks the text input's current value, so the same click either proceeds (ontrue) or reveals an error message (isfalse drives the error Text's visibility as a level, not a pulse). Note the two kinds of flow: text/booleans are values, onClick/eval/ontrue are momentary signals.

## Related nodes

[Text](./text.md), [Image](./image.md), [Repeater](./for-each.md), [Component Children](./component-children.md), [Columns](./net-noodl-visual-columns.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
