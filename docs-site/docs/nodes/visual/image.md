---
title: "Image"
---
Displays an image from a project asset or URL, with fit control, srcSet support and load/error signals.

Image renders an HTML `img` element. `src` takes a project asset path or a full URL (relative paths are resolved against the app's base URL); `srcSet` optionally provides responsive candidate images and `alt` the accessibility text. When `sizeMode` gives the image an explicit size, `objectFit` (Image Fit) chooses how the picture fills that box ('contain' by default, 'cover' for thumbnails). `onLoad` and `onError` are signals that fire when the browser finishes or fails loading the current source. It cannot have children and supports hover visual states for per-state styling.

## When to use it

Any bitmap content: photos, thumbnails, logos, user uploads (a cloud file output connects straight to `src`). For vector glyphs from an icon set use net.noodl.visual.icon; for a decorative background prefer a Group's background image/color so children can sit on top; for video use Video.

## At a glance

| | |
|---|---|
| Category | Visual |
| Type name | `Image` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `acceptFileDrops` | Boolean | `false` | Lets a file dragged from the desktop be dropped onto this element, which reveals the File Drop outputs below |
| `acceptedFileTypes` | String | — | Comma-separated extensions or MIME types this element will take — ".png, .jpg" or "image/*"; leave blank to accept every file. A drop of nothing but rejected files fires Files Rejected instead of Files Dropped |
| `alignX` | Enum (`left`, `center`, `right`) | — | Horizontal alignment of this element within the space its parent gives it |
| `alignY` | Enum (`top`, `center`, `bottom`) | — | Vertical alignment of this element within the space its parent gives it |
| `alt` | String | `` | The alt text is used by screen readers, or if the image can't be downloaded or displayed |
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
| `cssClassName` | String | `` | Extra CSS class names to put on this element, for styling from a stylesheet you supply |
| `height` | Dimension | `100` | Height of the element; how the value is read depends on Size Mode |
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
| `objectFit` | Enum (`fill`, `contain`, `cover`, `none`, `scale-down`) | `contain` | How the image fills its box when the two have different proportions; only available with an explicit size |
| `opacity` | Number | `1` | How opaque this element is, from 0 for invisible to 1 for solid |
| `pointerEventsEnabled` | Boolean | `true` | When disabled, mouse and touch events pass through to whatever is behind this element |
| `pointerEventsMode` | Enum (`inherit`, `explicit`) | `inherit` | Whether pointer handling is inherited from the parent or set explicitly on this element |
| `position` | Enum (`relative`, `absolute`, `sticky`, `fixed`) | `relative` | How the element is placed: In Layout follows its siblings, Absolute ignores them, Sticky pins to the parent edge on overflow, Fixed stays put and takes no space |
| `sizeMode` | Enum (`explicit`, `contentWidth`, `contentHeight`, `contentSize`) | `contentSize` | Whether Width and Height are used as given, or the element sizes itself to fit its contents |
| `src` | Image | — | URL or project file to display; leave blank to show nothing rather than request a missing image |
| `srcSet` | String | — | A srcset list letting the browser pick a resolution, e.g. "small.png 480w, large.png 1080w" |
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

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `boundingHeight` | Number | — | Height this element actually ended up with after layout, in pixels |
| `boundingWidth` | Number | — | Width this element actually ended up with after layout, in pixels |
| `childIndex` | Number | — | This element's position among its parent's children, counting from 0 |
| `droppedFile` | * | — | The first accepted file, in the form an Upload File node takes |
| `droppedFileName` | String | — | Name of the first accepted file, extension included |
| `droppedFileSizeInBytes` | Number | — | Size of the first accepted file, in bytes |
| `droppedFileType` | String | — | MIME type the browser reports for the first accepted file, blank for one it does not recognise |
| `droppedFiles` | Array | — | Every accepted file in the drop, as an array — a drop can carry more than one |
| `isDragOver` | Boolean | — | True while a file is being dragged over this element — wire it to a border or background so the drop zone reacts |
| `screenPositionX` | Number | — | Distance in pixels from the left edge of the window to this element's left edge |
| `screenPositionY` | Number | — | Distance in pixels from the top edge of the window to this element's top edge |
| `this` | Reference | — | A reference to this node itself, for ports that take a node rather than a value |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `didMount` | Signal | — | Fires once this element has been added to the page and can be measured |
| `filesDropped` | Signal | — | Fires when one or more accepted files are dropped here, after every File Drop output is up to date |
| `filesRejected` | Signal | — | Fires when a drop landed here but every file in it was excluded by Accepted file types |
| `hoverEnd` | Signal | — | Fires when the pointer leaves this element |
| `hoverStart` | Signal | — | Fires when the pointer moves over this element or any of its children |
| `onClick` | Signal | — | Fires when this element is clicked or tapped |
| `onLoad` | Signal | — | Fires once the image has finished downloading and is on screen |
| `pointerDown` | Signal | — | Fires when a mouse button is pressed or a finger touches this element |
| `pointerEnter` | Signal | — | Fires when the pointer moves onto this element, not counting its children |
| `pointerUp` | Signal | — | Fires when the mouse button is released or the finger lifts over this element |
| `willUnmount` | Signal | — | Fires just before this element is removed from the page, while it still exists |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `imageError` | String | — | Why the image could not be loaded, naming the source that failed |
| `onError` | Signal | — | Fires when the image could not be loaded, after the reason has been reported on Error |

## Dynamic ports

_This node's port list changes at runtime (declared-port-groups); the tables above may be incomplete for a given instance._

Declares conditional/expandable port groups whose visibility depends on parameter values (see declaredPortGroups).

| Condition | Inputs shown | Outputs shown |
|---|---|---|
| sizeMode = explicit | `objectFit` | — |
| sizeMode = explicit OR sizeMode = contentHeight | `width` | — |
| sizeMode = explicit OR sizeMode = contentWidth | `height` | — |
| pointerEventsMode = explicit | `pointerEventsEnabled` | — |
| acceptFileDrops = true | `acceptedFileTypes` | `filesDropped`, `filesRejected`, `droppedFile`, `droppedFiles`, `droppedFileName`, `droppedFileType`, `droppedFileSizeInBytes`, `isDragOver` |
| borderStyle = solid OR borderStyle = dashed OR borderStyle = dotted  | `borderWidth`, `borderColor` | — |
| borderLeftStyle = solid OR borderLeftStyle = dashed OR borderLeftStyle = dotted OR borderStyle = solid OR borderStyle = dashed OR borderStyle = dotted  | `borderLeftWidth`, `borderLeftColor` | — |
| borderTopStyle = solid OR borderTopStyle = dashed OR borderTopStyle = dotted OR borderStyle = solid OR borderStyle = dashed OR borderStyle = dotted  | `borderTopWidth`, `borderTopColor` | — |
| borderRightStyle = solid OR borderRightStyle = dashed OR borderRightStyle = dotted OR borderStyle = solid OR borderStyle = dashed OR borderStyle = dotted  | `borderRightWidth`, `borderRightColor` | — |
| borderBottomStyle = solid OR borderBottomStyle = dashed OR borderBottomStyle = dotted OR borderStyle = solid OR borderStyle = dashed OR borderStyle = dotted  | `borderBottomWidth`, `borderBottomColor` | — |
| boxShadowEnabled = true | `boxShadowOffsetX`, `boxShadowOffsetY`, `boxShadowInset`, `boxShadowBlurRadius`, `boxShadowSpreadRadius`, `boxShadowColor` | — |

## Ports at runtime

Declared-port-groups: `objectFit`, `width` and `height` appear based on `sizeMode`; per-side border width/color ports appear once a border style is chosen; box-shadow ports appear when `boxShadowEnabled` is true; `pointerEventsEnabled` appears when `pointerEventsMode` is 'explicit'. Treat the catalog's input list as the superset the editor filters by current parameters.

## Patterns

- Inside a Repeater item component: Component Inputs property → `src` to show per-record images.
- Thumbnail grid: explicit size mode + `objectFit` 'cover' so mixed aspect ratios crop instead of distort.

## Watch out for

- Using Image for icon-font glyphs — net.noodl.visual.icon renders them sharper and tintable via `iconColor`.

## Examples

**Media card row: Columns layout with Image, Icon and Circle**

A card layout composed from the visual primitives: Columns (net.noodl.visual.columns) distributes its children by a layout string ('1 2' — the second column twice as wide), the Image shows a picture from a URL/asset on `src`, the Icon (net.noodl.visual.icon) renders a themed glyph, and the Circle doubles as a status dot whose `fillColor` is data-driven. Layout is containment; only the dynamic bits (image source, status color) are wired.

**Card grid: Query Records into a Repeater, in a Columns node that reflows on its own**

The canonical data grid, and the layout decision most often got wrong. Use a Columns node with sizing "autoFit" and a minWidth of 260-320px: it fits as many columns as the CONTAINER holds and reflows by itself, with no breakpoints to maintain. Columns handles a Repeater child correctly — the Repeater draws nothing and adds its items as siblings, so Columns skips it and gives each real item a column box. The card component is width 100% and lets the column size it, which is what makes the SAME card work in this grid, in a 2-up related row, and in a sidebar. Do NOT reach for a Group with flexWrap: a wrapped flex row does not shrink its children, so each item needs a hardcoded percentage track, and — the part that matters — no Group anywhere in the runtime has a breakpoint, so that layout can never collapse on a narrow screen. Record fields reach the item through Component Inputs whose names match the record properties, and wiring a field straight into a Group's visible port is conditional rendering with no logic node.

**Split hero: copy column and image, with a display headline that looks set rather than typed**

Two columns inside the shell, each width 100% so an UNWRAPPED row shrinks them to half each — this is why a plain row works where a wrapped grid does not. The copy column carries the page's one display headline (--display-lg — a fluid clamp() that is 44px on a phone and 96px on a wide desktop — with --font-bold, --leading-none and --tracking-tighter; tight tracking is what makes a large heading look set), an eyebrow above it, a lead paragraph capped at ~520px, and two buttons whose concrete parameters are copied from the style vocabulary because `variant` is a connection-only port. The image gets sizeMode "explicit" plus a width, a height and objectFit "cover" — without explicit sizing those three ports are inert and the photo renders at its natural size.

## Related nodes

[Group](./group.md), [Icon](./net-noodl-visual-icon.md), [Video](./video.md), [Shape](./circle.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
