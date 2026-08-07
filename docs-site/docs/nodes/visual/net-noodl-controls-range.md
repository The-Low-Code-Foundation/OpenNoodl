---
title: "Slider"
---
Slider control: picks a number between min and max by dragging a thumb; value and valuePercent stream out live.

The Slider renders a draggable range input bounded by `min`/`max` with `step` granularity. `value` (the number) and `valuePercent` (0–100 regardless of bounds) update continuously while dragging; `onChange` fires per change. Thumb and track are styleable separately, and the standard control surface (enabled, focus/hover/pressed states) applies.

## When to use it

Continuous or stepped numeric input where feel matters more than precision: volume, brightness, price ranges. For exact numeric entry pair it with (or replace it by) a Text Input.

## At a glance

| | |
|---|---|
| Category | Visual |
| Type name | `net.noodl.controls.range` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `alignX` | Enum (`left`, `center`, `right`) | — | Horizontal alignment of this element within the space its parent gives it |
| `alignY` | Enum (`top`, `center`, `bottom`) | — | Vertical alignment of this element within the space its parent gives it |
| `blockTouch` | Boolean | — | Stops every pointer event that lands on this control from reaching the nodes it sits inside. Blunt: it takes hover and pointer-down with it, so reach for Click Bubbling first if it is only clicks you want to keep in |
| `clickBubbling` | Enum (`auto`, `always`, `never`) | `auto` | Whether a click on this control also fires Click on the nodes it sits inside. Automatic keeps it here as soon as this control's own Click is connected, so a Favourite button inside a clickable card runs Favourite and not the card; Always is the older behaviour where both run; Never keeps every click here, wired or not |
| `cssClassName` | String | `` | Extra CSS class names to put on this element, for styling from a stylesheet you supply |
| `enabled` | Boolean | `true` | Lets the user interact with this control; when off it still renders and occupies its space but ignores clicks, touches and typing |
| `marginBottom` | Number | — | Space outside the element's bottom edge, between it and its neighbours |
| `marginLeft` | Number | — | Space outside the element's left edge, between it and its neighbours |
| `marginRight` | Number | — | Space outside the element's right edge, between it and its neighbours |
| `marginTop` | Number | — | Space outside the element's top edge, between it and its neighbours |
| `max` | Number | `100` | Value at the far right of the track; the current value is clamped down to it if it is above |
| `min` | Number | `0` | Value at the far left of the track; the current value is clamped up to it if it is below |
| `mixBlendMode` | Enum (`normal`, `multiply`, `screen`, `overlay`, `darken`, `lighten`, `color-dodge`, `color-burn`, `hard-light`, `soft-light`, `difference`, `exclusion`, `hue`, `saturation`, `color`, `luminosity`) | `normal` | How this element's colours blend with whatever is painted behind it |
| `mounted` | Boolean | `true` | Removes the element from the page entirely when false, unlike Visible which leaves its space behind |
| `opacity` | Number | `1` | How opaque this element is, from 0 for invisible to 1 for solid |
| `paddingBottom` | Number | `0` | Space inside the element's bottom edge, between it and its content |
| `paddingLeft` | Number | `0` | Space inside the element's left edge, between it and its content |
| `paddingRight` | Number | `0` | Space inside the element's right edge, between it and its content |
| `paddingTop` | Number | `0` | Space inside the element's top edge, between it and its content |
| `position` | Enum (`relative`, `absolute`, `sticky`, `fixed`) | `relative` | How the element is placed: In Layout follows its siblings, Absolute ignores them, Sticky pins to the parent edge on overflow, Fixed stays put and takes no space |
| `step` | Number | `1` | Smallest amount the handle can move by, so the value lands on multiples of it |
| `styleCss` | String | `/* background-color: red; */` | Raw CSS declarations applied to this element, overriding the styling ports above |
| `thumbBorderBottomColor` | Color | — | Colour of the bottom edge of the handle you drag only, overriding Thumb Border Color |
| `thumbBorderBottomLeftRadius` | Number | — | How rounded the bottom left corner of the handle you drag is, overriding Thumb Corner Radius |
| `thumbBorderBottomRightRadius` | Number | — | How rounded the bottom right corner of the handle you drag is, overriding Thumb Corner Radius |
| `thumbBorderBottomStyle` | Enum (`none`, `solid`, `dotted`, `dashed`) | — | Line style for the bottom edge of the handle you drag only, overriding Thumb Border Style; None hides that edge |
| `thumbBorderBottomWidth` | Number | — | Thickness in pixels of the bottom edge of the handle you drag, which has no effect while that edge's Border Style is None |
| `thumbBorderColor` | Color | `#000000` | Colour of the border around the handle you drag, which has no effect while Thumb Border Style is None |
| `thumbBorderLeftColor` | Color | — | Colour of the left edge of the handle you drag only, overriding Thumb Border Color |
| `thumbBorderLeftStyle` | Enum (`none`, `solid`, `dotted`, `dashed`) | — | Line style for the left edge of the handle you drag only, overriding Thumb Border Style; None hides that edge |
| `thumbBorderLeftWidth` | Number | — | Thickness in pixels of the left edge of the handle you drag, which has no effect while that edge's Border Style is None |
| `thumbBorderRadius` | Number | `0` | How rounded all four corners of the handle you drag are; half its width and height makes it a circle |
| `thumbBorderRightColor` | Color | — | Colour of the right edge of the handle you drag only, overriding Thumb Border Color |
| `thumbBorderRightStyle` | Enum (`none`, `solid`, `dotted`, `dashed`) | — | Line style for the right edge of the handle you drag only, overriding Thumb Border Style; None hides that edge |
| `thumbBorderRightWidth` | Number | — | Thickness in pixels of the right edge of the handle you drag, which has no effect while that edge's Border Style is None |
| `thumbBorderStyle` | Enum (`none`, `solid`, `dotted`, `dashed`) | `none` | Line style for all four edges of the handle you drag; None hides the border and leaves its Width and Color inactive |
| `thumbBorderTopColor` | Color | — | Colour of the top edge of the handle you drag only, overriding Thumb Border Color |
| `thumbBorderTopLeftRadius` | Number | — | How rounded the top left corner of the handle you drag is, overriding Thumb Corner Radius |
| `thumbBorderTopRightRadius` | Number | — | How rounded the top right corner of the handle you drag is, overriding Thumb Corner Radius |
| `thumbBorderTopStyle` | Enum (`none`, `solid`, `dotted`, `dashed`) | — | Line style for the top edge of the handle you drag only, overriding Thumb Border Style; None hides that edge |
| `thumbBorderTopWidth` | Number | — | Thickness in pixels of the top edge of the handle you drag, which has no effect while that edge's Border Style is None |
| `thumbBorderWidth` | Number | `0` | Thickness in pixels of the border around the handle you drag, which has no effect while Thumb Border Style is None |
| `thumbBoxShadowBlurRadius` | Number | `5` | How soft the shadow edge is; 0 gives a hard edge |
| `thumbBoxShadowColor` | Color | `#00000033` | Colour of the shadow, usually a mostly-transparent black |
| `thumbBoxShadowEnabled` | Boolean | — | Draws a shadow behind the handle you drag; the rest of this group does nothing while it is off |
| `thumbBoxShadowInset` | Boolean | `false` | Draws the shadow inside the element instead of behind it, for a recessed look |
| `thumbBoxShadowOffsetX` | Number | `0` | How far right the shadow sits from the element; negative values move it left |
| `thumbBoxShadowOffsetY` | Number | `0` | How far down the shadow sits from the element; negative values move it up |
| `thumbBoxShadowSpreadRadius` | Number | `2` | Grows the shadow outwards before it is blurred; negative values shrink it |
| `thumbColor` | Color | `#000000` | Fill colour of the handle |
| `thumbHeight` | Number | `16` | Height of the handle the user drags |
| `thumbWidth` | Number | `16` | Width of the handle the user drags |
| `trackActiveColor` | Color | `#f0f0f0` | Colour of the part of the track between Min and the handle |
| `trackBorderBottomColor` | Color | — | Colour of the bottom edge of the bar the handle slides along only, overriding Track Border Color |
| `trackBorderBottomLeftRadius` | Number | — | How rounded the bottom left corner of the bar the handle slides along is, overriding Track Corner Radius |
| `trackBorderBottomRightRadius` | Number | — | How rounded the bottom right corner of the bar the handle slides along is, overriding Track Corner Radius |
| `trackBorderBottomStyle` | Enum (`none`, `solid`, `dotted`, `dashed`) | — | Line style for the bottom edge of the bar the handle slides along only, overriding Track Border Style; None hides that edge |
| `trackBorderBottomWidth` | Number | — | Thickness in pixels of the bottom edge of the bar the handle slides along, which has no effect while that edge's Border Style is None |
| `trackBorderColor` | Color | `#000000` | Colour of the border around the bar the handle slides along, which has no effect while Track Border Style is None |
| `trackBorderLeftColor` | Color | — | Colour of the left edge of the bar the handle slides along only, overriding Track Border Color |
| `trackBorderLeftStyle` | Enum (`none`, `solid`, `dotted`, `dashed`) | — | Line style for the left edge of the bar the handle slides along only, overriding Track Border Style; None hides that edge |
| `trackBorderLeftWidth` | Number | — | Thickness in pixels of the left edge of the bar the handle slides along, which has no effect while that edge's Border Style is None |
| `trackBorderRadius` | Number | `0` | How rounded all four corners of the bar the handle slides along are; half its width and height makes it a circle |
| `trackBorderRightColor` | Color | — | Colour of the right edge of the bar the handle slides along only, overriding Track Border Color |
| `trackBorderRightStyle` | Enum (`none`, `solid`, `dotted`, `dashed`) | — | Line style for the right edge of the bar the handle slides along only, overriding Track Border Style; None hides that edge |
| `trackBorderRightWidth` | Number | — | Thickness in pixels of the right edge of the bar the handle slides along, which has no effect while that edge's Border Style is None |
| `trackBorderStyle` | Enum (`none`, `solid`, `dotted`, `dashed`) | `none` | Line style for all four edges of the bar the handle slides along; None hides the border and leaves its Width and Color inactive |
| `trackBorderTopColor` | Color | — | Colour of the top edge of the bar the handle slides along only, overriding Track Border Color |
| `trackBorderTopLeftRadius` | Number | — | How rounded the top left corner of the bar the handle slides along is, overriding Track Corner Radius |
| `trackBorderTopRightRadius` | Number | — | How rounded the top right corner of the bar the handle slides along is, overriding Track Corner Radius |
| `trackBorderTopStyle` | Enum (`none`, `solid`, `dotted`, `dashed`) | — | Line style for the top edge of the bar the handle slides along only, overriding Track Border Style; None hides that edge |
| `trackBorderTopWidth` | Number | — | Thickness in pixels of the top edge of the bar the handle slides along, which has no effect while that edge's Border Style is None |
| `trackBorderWidth` | Number | `0` | Thickness in pixels of the border around the bar the handle slides along, which has no effect while Track Border Style is None |
| `trackBoxShadowBlurRadius` | Number | `5` | How soft the shadow edge is; 0 gives a hard edge |
| `trackBoxShadowColor` | Color | `#00000033` | Colour of the shadow, usually a mostly-transparent black |
| `trackBoxShadowEnabled` | Boolean | — | Draws a shadow behind the bar the handle slides along; the rest of this group does nothing while it is off |
| `trackBoxShadowInset` | Boolean | `false` | Draws the shadow inside the element instead of behind it, for a recessed look |
| `trackBoxShadowOffsetX` | Number | `0` | How far right the shadow sits from the element; negative values move it left |
| `trackBoxShadowOffsetY` | Number | `0` | How far down the shadow sits from the element; negative values move it up |
| `trackBoxShadowSpreadRadius` | Number | `2` | Grows the shadow outwards before it is blurred; negative values shrink it |
| `trackColor` | Color | `#f0f0f0` | Colour of the part of the track the handle has not reached yet |
| `trackHeight` | Number | `6` | Thickness of the bar the handle slides along |
| `transformOriginX` | Number | `50` | Horizontal point the element rotates and scales around, as a fraction of its width |
| `transformOriginY` | Number | `50` | Vertical point the element rotates and scales around, as a fraction of its height |
| `transformRotation` | Number | `0` | Rotates the element clockwise in degrees, without affecting the layout |
| `transformScale` | Number | `1` | Scales the element about its transform origin; 1 leaves it unscaled |
| `transformX` | Number | `0` | Moves the element right after layout, without moving its siblings |
| `transformY` | Number | `0` | Moves the element down after layout, without moving its siblings |
| `value` | Number | — | Moves the handle to this value, clamped to Min and Max; changing it from the graph does not fire Changed. An empty value leaves the handle where it is |
| `variant` | String | — | Name of a saved variant of this node type to apply, replacing the styling set here |
| `visible` | Boolean | `true` | Hides the element while keeping the space it occupies in the layout |
| `width` | Number | `100` | Overall width of the slider, which is the length of the track plus the handle |
| `zIndex` | Number | — | Paint order among overlapping siblings; higher numbers paint on top |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `boundingHeight` | Number | — | Height this element actually ended up with after layout, in pixels |
| `boundingWidth` | Number | — | Width this element actually ended up with after layout, in pixels |
| `childIndex` | Number | — | This element's position among its parent's children, counting from 0 |
| `enabled` | Boolean | — | Reports back whether this control is currently accepting interaction, following the Enabled input |
| `focusState` | Boolean | — | True while this control holds keyboard focus, so typing and Enter go to it |
| `hoverState` | Boolean | — | True while the pointer is over this control; stays false on touch devices with no pointer |
| `pressedState` | Boolean | — | True while a mouse button or finger is held down on this control, and false again the moment it is released or slides off |
| `screenPositionX` | Number | — | Distance in pixels from the left edge of the window to this element's left edge |
| `screenPositionY` | Number | — | Distance in pixels from the top edge of the window to this element's top edge |
| `this` | Reference | — | A reference to this node itself, for ports that take a node rather than a value |
| `value` | Number | — | The value the handle is currently at, between Min and Max, as a number |
| `valuePercent` | Number | — | Where the handle sits as a whole number from 0 to 100, regardless of Min and Max |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `didMount` | Signal | — | Fires once this element has been added to the page and can be measured |
| `hoverEnd` | Signal | — | Fires when the pointer leaves this control, including when it leaves while a button is still held |
| `hoverStart` | Signal | — | Fires when the pointer moves onto this control |
| `onBlur` | Signal | — | Fires when keyboard focus leaves this control, which is the usual place to validate what was entered |
| `onChange` | Signal | — | Fires when the user moves the handle; a value arriving on the Value input does not fire it |
| `onFocus` | Signal | — | Fires the moment this control takes keyboard focus, whether from a click, a tab or a Focus action |
| `pointerDown` | Signal | — | Fires as a mouse button or finger goes down on this control, before any click has completed |
| `pointerUp` | Signal | — | Fires when the mouse button or finger is lifted, and also when a touch is cancelled by the system |
| `willUnmount` | Signal | — | Fires just before this element is removed from the page, while it still exists |

## Dynamic ports

_This node's port list changes at runtime (declared-port-groups); the tables above may be incomplete for a given instance._

Declares conditional/expandable port groups whose visibility depends on parameter values (see declaredPortGroups).

| Condition | Inputs shown | Outputs shown |
|---|---|---|
| trackBorderStyle = solid OR trackBorderStyle = dashed OR trackBorderStyle = dotted  | `trackBorderWidth`, `trackBorderColor` | — |
| trackBorderLeftStyle = solid OR trackBorderLeftStyle = dashed OR trackBorderLeftStyle = dotted OR borderStyle = solid OR borderStyle = dashed OR borderStyle = dotted  | `trackBorderLeftWidth`, `trackBorderLeftColor` | — |
| trackBorderTopStyle = solid OR trackBorderTopStyle = dashed OR trackBorderTopStyle = dotted OR borderStyle = solid OR borderStyle = dashed OR borderStyle = dotted  | `trackBorderTopWidth`, `trackBorderTopColor` | — |
| trackBorderRightStyle = solid OR trackBorderRightStyle = dashed OR trackBorderRightStyle = dotted OR borderStyle = solid OR borderStyle = dashed OR borderStyle = dotted  | `trackBorderRightWidth`, `trackBorderRightColor` | — |
| trackBorderBottomStyle = solid OR trackBorderBottomStyle = dashed OR trackBorderBottomStyle = dotted OR borderStyle = solid OR borderStyle = dashed OR borderStyle = dotted  | `trackBorderBottomWidth`, `trackBorderBottomColor` | — |
| trackBoxShadowEnabled = true | `trackBoxShadowOffsetX`, `trackBoxShadowOffsetY`, `trackBoxShadowInset`, `trackBoxShadowBlurRadius`, `trackBoxShadowSpreadRadius`, `trackBoxShadowColor` | — |
| thumbBorderStyle = solid OR thumbBorderStyle = dashed OR thumbBorderStyle = dotted  | `thumbBorderWidth`, `thumbBorderColor` | — |
| thumbBorderLeftStyle = solid OR thumbBorderLeftStyle = dashed OR thumbBorderLeftStyle = dotted OR borderStyle = solid OR borderStyle = dashed OR borderStyle = dotted  | `thumbBorderLeftWidth`, `thumbBorderLeftColor` | — |
| thumbBorderTopStyle = solid OR thumbBorderTopStyle = dashed OR thumbBorderTopStyle = dotted OR borderStyle = solid OR borderStyle = dashed OR borderStyle = dotted  | `thumbBorderTopWidth`, `thumbBorderTopColor` | — |
| thumbBorderRightStyle = solid OR thumbBorderRightStyle = dashed OR thumbBorderRightStyle = dotted OR borderStyle = solid OR borderStyle = dashed OR borderStyle = dotted  | `thumbBorderRightWidth`, `thumbBorderRightColor` | — |
| thumbBorderBottomStyle = solid OR thumbBorderBottomStyle = dashed OR thumbBorderBottomStyle = dotted OR borderStyle = solid OR borderStyle = dashed OR borderStyle = dotted  | `thumbBorderBottomWidth`, `thumbBorderBottomColor` | — |
| thumbBoxShadowEnabled = true | `thumbBoxShadowOffsetX`, `thumbBoxShadowOffsetY`, `thumbBoxShadowInset`, `thumbBoxShadowBlurRadius`, `thumbBoxShadowSpreadRadius`, `thumbBoxShadowColor` | — |

## Ports at runtime

Declared-port-groups: label and per-visual-state styling ports appear per configuration.

## Watch out for

- Writing to a backend on every `onChange` while dragging — debounce with a Timer first.

## Examples

**Settings form: the standard input controls bound to values**

One of each core control: Text Input's live string comes out of `onTextChanged`, Checkbox exposes `checked` (level) plus `onChange` (edge), Dropdown (net.noodl.controls.options) takes an items list and emits the selected `value`, Slider (net.noodl.controls.range) emits a numeric `value` between `min`/`max`, and a Radio Button Group reports the `value` of whichever child Radio Button is selected. Values flow into a live summary — no submit step needed for value binding.

## Related nodes

[Text Input](./net-noodl-controls-textinput.md), [Number Remapper](../math/number-remapper.md), [Delay](../utilities/timer.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
