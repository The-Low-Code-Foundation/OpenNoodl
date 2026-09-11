---
title: "Text Input"
---
Single-line or multi-line text entry control with label, icon, placeholder and focus handling; outputs the text as the user types.

The Text Input control renders an editable text field (or text area, or email/number/password/URL input, chosen by the `type` enum). Its main product is `onTextChanged` (display name 'Text'), a string output that updates continuously as the user types; the `textChanged` signal fires on every such change and `onEnter` fires when the user presses Enter. Text can also be written programmatically: the `startValue` (Text) input holds the field text, and the `set` signal applies it on demand. Optional label and icon sections, per-state styling and focus control (`focus`/`blur` signals, `focusState` output) are built in.

## When to use it

Any free-text entry. Use `type` instead of separate nodes for email/number/password fields. For multi-line text set `type` to textArea. For choosing among fixed options use a Dropdown (net.noodl.controls.options) or Radio Button Group instead. The legacy `Text Input` type is superseded by this control.

## At a glance

| | |
|---|---|
| Category | Visual |
| Type name | `net.noodl.controls.textinput` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `alignX` | Enum (`left`, `center`, `right`) | — | Horizontal alignment of this element within the space its parent gives it |
| `alignY` | Enum (`top`, `center`, `bottom`) | — | Vertical alignment of this element within the space its parent gives it |
| `backgroundColor` | Color | `transparent` | Fill colour of the field |
| `blockTouch` | Boolean | — | Stops every pointer event that lands on this control from reaching the nodes it sits inside. Blunt: it takes hover and pointer-down with it, so reach for Click Bubbling first if it is only clicks you want to keep in |
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
| `boxSizing` | Enum (`border-box`, `content-box`) | `border-box` | Whether Width and Height include this element's padding and border, or only its content |
| `clickBubbling` | Enum (`auto`, `always`, `never`) | `auto` | Whether a click on this control also fires Click on the nodes it sits inside. Automatic keeps it here as soon as this control's own Click is connected, so a Favourite button inside a clickable card runs Favourite and not the card; Always is the older behaviour where both run; Never keeps every click here, wired or not |
| `color` | Color | — | Colour of the text itself, not of the element behind it |
| `cssClassName` | String | `` | Extra CSS class names to put on this element, for styling from a stylesheet you supply |
| `enabled` | Boolean | `true` | Lets the user interact with this control; when off it still renders and occupies its space but ignores clicks, touches and typing |
| `fontFamily` | Font | — | Typeface to render the text in, either a web-safe family name or a font file added to the project |
| `fontSize` | Number | — | Height of the text, in pixels |
| `fontStyle` | Enum (`normal`, `italic`) | `normal` | Renders the text upright or italic |
| `fontVariantNumeric` | Enum (`normal`, `tabular-nums`) | `normal` | Tabular draws every digit at the same width so columns of numbers align; Normal follows the font |
| `fontWeight` | Number | `Auto` | How heavy the text is drawn, from 100 (thin) to 900 (black); leave as Auto to use the weight the font family sets |
| `height` | Dimension | `100` | Height of the element; how the value is read depends on Size Mode |
| `iconColor` | Color | `#000000` | Colour of the icon |
| `iconIconSource` | Icon | — | Which glyph to show, picked from an installed icon set |
| `iconImageSource` | Image | — | Image file to show instead of an icon-set glyph |
| `iconPlacement` | Enum (`left`, `right`) | `left` | Which side of the label the icon sits on, with Icon Spacing as the gap between them |
| `iconSize` | Number | `16` | Height of the icon |
| `iconSourceType` | Enum (`image`, `icon`) | `icon` | Whether the icon comes from an installed icon set or from an image file, which decides the source port below |
| `iconSpacing` | Number | `10` | Gap between the icon and the text beside it |
| `label` | String | `Label` | Text shown on this element |
| `labelSpacing` | Number | `10` | Gap between the label and the edges around it |
| `labelcolor` | Color | — | Colour of the text itself, not of the element behind it |
| `labelfontFamily` | Font | — | Typeface to render the text in, either a web-safe family name or a font file added to the project |
| `labelfontSize` | Number | — | Height of the text, in pixels |
| `labelfontStyle` | Enum (`normal`, `italic`) | `normal` | Renders the text upright or italic |
| `labelfontVariantNumeric` | Enum (`normal`, `tabular-nums`) | `normal` | Tabular draws every digit at the same width so columns of numbers align; Normal follows the font |
| `labelfontWeight` | Number | `Auto` | How heavy the text is drawn, from 100 (thin) to 900 (black); leave as Auto to use the weight the font family sets |
| `labelletterSpacing` | Number | `Auto` | Extra space added between characters; leave as Auto to use the spacing built into the font |
| `labellineHeight` | Number | `Auto` | Vertical space each line of text occupies; leave as Auto to follow the font |
| `labeltextStyle` | TextStyle | `None` | Applies one of the project's saved text styles; the individual font ports below override whatever it sets |
| `labeltextTransform` | Enum (`none`, `uppercase`, `lowercase`, `capitalize`) | `none` | Forces the text to upper case, lower case or capitalised without changing the underlying value |
| `letterSpacing` | Number | `Auto` | Extra space added between characters; leave as Auto to use the spacing built into the font |
| `lineHeight` | Number | `Auto` | Vertical space each line of text occupies; leave as Auto to follow the font |
| `marginBottom` | Number | — | Space outside the element's bottom edge, between it and its neighbours |
| `marginLeft` | Number | — | Space outside the element's left edge, between it and its neighbours |
| `marginRight` | Number | — | Space outside the element's right edge, between it and its neighbours |
| `marginTop` | Number | — | Space outside the element's top edge, between it and its neighbours |
| `maxHeight` | Number | — | Largest height the element may grow to, taking priority over Height |
| `maxLength` | Number | — | Largest number of characters the user can type; it does not truncate a value arriving on Text |
| `maxWidth` | Number | — | Largest width the element may grow to, taking priority over Width |
| `minHeight` | Number | — | Smallest height the element may shrink to, taking priority over Height |
| `minWidth` | Number | — | Smallest width the element may shrink to, taking priority over Width |
| `mixBlendMode` | Enum (`normal`, `multiply`, `screen`, `overlay`, `darken`, `lighten`, `color-dodge`, `color-burn`, `hard-light`, `soft-light`, `difference`, `exclusion`, `hue`, `saturation`, `color`, `luminosity`) | `normal` | How this element's colours blend with whatever is painted behind it |
| `mounted` | Boolean | `true` | Removes the element from the page entirely when false, unlike Visible which leaves its space behind |
| `opacity` | Number | `1` | How opaque this element is, from 0 for invisible to 1 for solid |
| `paddingBottom` | Number | `0` | Space inside the element's bottom edge, between it and its content |
| `paddingLeft` | Number | `0` | Space inside the element's left edge, between it and its content |
| `paddingRight` | Number | `0` | Space inside the element's right edge, between it and its content |
| `paddingTop` | Number | `0` | Space inside the element's top edge, between it and its content |
| `placeHolderOpacity` | Number | `0.5` | How faded the placeholder text is, from 0 to 1 |
| `placeholder` | String | `` | Greyed-out hint shown while the field is empty |
| `position` | Enum (`relative`, `absolute`, `sticky`, `fixed`) | `relative` | How the element is placed: In Layout follows its siblings, Absolute ignores them, Sticky pins to the parent edge on overflow, Fixed stays put and takes no space |
| `sizeMode` | Enum (`explicit`, `contentWidth`, `contentHeight`, `contentSize`) | `contentSize` | Whether Width and Height are used as given, or the element sizes itself to fit its contents |
| `startValue` | * | — | The value to put in the field. Applied as it arrives, unless you untick it under Run On Value Change, in which case it waits for a Set pulse |
| `styleCss` | String | `/* background-color: red; */` | Raw CSS declarations applied to this element, overriding the styling ports above |
| `textAlignX` | Enum (`left`, `center`, `right`) | `left` | Aligns the typed text within the field |
| `textStyle` | TextStyle | `None` | Applies one of the project's saved text styles; the individual font ports below override whatever it sets |
| `textTransform` | Enum (`none`, `uppercase`, `lowercase`, `capitalize`) | `none` | Forces the text to upper case, lower case or capitalised without changing the underlying value |
| `transformOriginX` | Number | `50` | Horizontal point the element rotates and scales around, as a fraction of its width |
| `transformOriginY` | Number | `50` | Vertical point the element rotates and scales around, as a fraction of its height |
| `transformRotation` | Number | `0` | Rotates the element clockwise in degrees, without affecting the layout |
| `transformScale` | Number | `1` | Scales the element about its transform origin; 1 leaves it unscaled |
| `transformX` | Number | `0` | Moves the element right after layout, without moving its siblings |
| `transformY` | Number | `0` | Moves the element down after layout, without moving its siblings |
| `type` | Enum (`text`, `textArea`, `email`, `number`, `password`, `url`) | `text` | What kind of value the field accepts, which also changes the on-screen keyboard on touch devices |
| `useIcon` | Boolean | `false` | Shows an icon on this element |
| `useLabel` | Boolean | `false` | Shows a text label on this element |
| `variant` | String | — | Name of a saved variant of this node type to apply, replacing the styling set here |
| `visible` | Boolean | `true` | Hides the element while keeping the space it occupies in the layout |
| `width` | Dimension | `100` | Width of the element; how the value is read depends on Size Mode |
| `zIndex` | Number | — | Paint order among overlapping siblings; higher numbers paint on top |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `blur` | Signal | — | Takes keyboard focus away from this field, which is what fires Blurred |
| `clear` | Signal | — | Empties the field |
| `focus` | Signal | — | Puts the keyboard cursor in this field |
| `set` | Signal | — | Writes the current Value into the field now. This is additional to Value applying as it arrives; untick Value under Run On Value Change to stop that |

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
| `onTextChanged` | * | — | What the field currently contains, updated as the user types. A number when Type is Number, otherwise text |
| `pressedState` | Boolean | — | True while a mouse button or finger is held down on this control, and false again the moment it is released or slides off |
| `screenPositionX` | Number | — | Distance in pixels from the left edge of the window to this element's left edge |
| `screenPositionY` | Number | — | Distance in pixels from the top edge of the window to this element's top edge |
| `this` | Reference | — | A reference to this node itself, for ports that take a node rather than a value |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `didMount` | Signal | — | Fires once this element has been added to the page and can be measured |
| `done` | Signal | — | Fires when Set, Clear, Focus or Blur did something |
| `hoverEnd` | Signal | — | Fires when the pointer leaves this control, including when it leaves while a button is still held |
| `hoverStart` | Signal | — | Fires when the pointer moves onto this control |
| `onBlur` | Signal | — | Fires when keyboard focus leaves this control, which is the usual place to validate what was entered |
| `onEnter` | Signal | — | Fires when the user presses Enter in the field, which is the usual place to submit |
| `onFocus` | Signal | — | Fires the moment this control takes keyboard focus, whether from a click, a tab or a Focus action |
| `pointerDown` | Signal | — | Fires as a mouse button or finger goes down on this control, before any click has completed |
| `pointerUp` | Signal | — | Fires when the mouse button or finger is lifted, and also when a touch is cancelled by the system |
| `textChanged` | Signal | — | Fires whenever the Value output changes, so a graph can sequence off the new value rather than poll it |
| `unchanged` | Signal | — | Fires when a Set or Clear left the field as it was — most often a Set while the field has focus, which is deliberately absorbed so it cannot overwrite what is being typed |
| `willUnmount` | Signal | — | Fires just before this element is removed from the page, while it still exists |

## Dynamic ports

_This node's port list changes at runtime (declared-port-groups, runtime-discovered); the tables above may be incomplete for a given instance._

The port list above is complete — this node mints no ports. It republishes its own two value ports (`startValue`, `onTextChanged`) per instance with a narrowed type: `number` when the `type` parameter is `number`, `string` for every other Type. They are declared `*` statically because nothing outside a connected editor can narrow them.

| Condition | Inputs shown | Outputs shown |
|---|---|---|
| sizeMode = explicit OR sizeMode = contentHeight | `width` | — |
| sizeMode = explicit OR sizeMode = contentWidth | `height` | — |
| useIcon = true | `iconSourceType`, `iconSize`, `iconPlacement`, `iconSpacing` | — |
| useIcon = true AND iconSourceType = image | `iconImageSource` | — |
| useIcon = true AND iconSourceType = icon | `iconIconSource`, `iconColor` | — |
| useLabel = true | `label`, `labeltextStyle`, `labelfontFamily`, `labelfontSize`, `labelfontWeight`, `labelfontStyle`, `labelcolor`, `labelletterSpacing`, `labellineHeight`, `labeltextTransform`, `labelfontVariantNumeric`, `labelSpacing` | — |
| borderStyle = solid OR borderStyle = dashed OR borderStyle = dotted  | `borderWidth`, `borderColor` | — |
| borderLeftStyle = solid OR borderLeftStyle = dashed OR borderLeftStyle = dotted OR borderStyle = solid OR borderStyle = dashed OR borderStyle = dotted  | `borderLeftWidth`, `borderLeftColor` | — |
| borderTopStyle = solid OR borderTopStyle = dashed OR borderTopStyle = dotted OR borderStyle = solid OR borderStyle = dashed OR borderStyle = dotted  | `borderTopWidth`, `borderTopColor` | — |
| borderRightStyle = solid OR borderRightStyle = dashed OR borderRightStyle = dotted OR borderStyle = solid OR borderStyle = dashed OR borderStyle = dotted  | `borderRightWidth`, `borderRightColor` | — |
| borderBottomStyle = solid OR borderBottomStyle = dashed OR borderBottomStyle = dotted OR borderStyle = solid OR borderStyle = dashed OR borderStyle = dotted  | `borderBottomWidth`, `borderBottomColor` | — |
| boxShadowEnabled = true | `boxShadowOffsetX`, `boxShadowOffsetY`, `boxShadowInset`, `boxShadowBlurRadius`, `boxShadowSpreadRadius`, `boxShadowColor` | — |

## Ports at runtime

Declared-port-groups: `width`/`height` appear per `sizeMode`, icon ports per `useIcon`/`iconSourceType`, label styling ports when `useLabel` is true, and border/shadow ports per border-style and `boxShadowEnabled` settings. The catalog list is the superset; the editor shows the subset matching current parameters.

## Patterns

- `onTextChanged` → an Expression or Condition: validate as the user types.
- `onEnter` → the same action as the submit button's `onClick`: keyboard-friendly forms.
- A stored value → `startValue` with a load signal → `set`: prefill a form when data arrives.

## Watch out for

- Polling the text with a timer — `onTextChanged` is already live; wire it directly.
- Wiring `textChanged` (signal) where the text string is wanted; use `onTextChanged`.

## Examples

**Settings form: the standard input controls bound to values**

One of each core control: Text Input's live string comes out of `onTextChanged`, Checkbox exposes `checked` (level) plus `onChange` (edge), Dropdown (net.noodl.controls.options) takes an items list and emits the selected `value`, Slider (net.noodl.controls.range) emits a numeric `value` between `min`/`max`, and a Radio Button Group reports the `value` of whichever child Radio Button is selected. Values flow into a live summary — no submit step needed for value binding.

**Check an email is well-formed and not already taken**

Sign-up validation as a chain of small truths rather than one function: an `Expression` says the field is non-empty, a `JavaScriptFunction` says it looks like an address, and a `DbCollection2` query says nobody has it yet — and an `And` node combines them into the one boolean the button enables on. The `Timer` in front of the query is the detail worth copying: it debounces, so the database is asked once the typing stops instead of once per keystroke. ⚠️ The two `Inverter` nodes read as clutter until you notice what they buy — 'no user came back' is the success case here, and inverting it keeps every input to the `And` meaning 'this is fine', which is what makes the combination readable at all.

## Related nodes

[Button](./net-noodl-controls-button.md), [Dropdown](./net-noodl-controls-options.md), [Condition](../logic/condition.md), [Expression](../custom-code/expression.md), [Text](./text.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
