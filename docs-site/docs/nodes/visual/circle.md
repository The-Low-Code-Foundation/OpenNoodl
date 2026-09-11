---
title: "Shape"
---
An SVG circle or arc with fill, stroke and start/end angles — the quick way to dots, rings and progress arcs.

Circle draws a circular shape as inline SVG. `size` is the diameter in pixels; `fillEnabled`/`fillColor` and `strokeEnabled`/`strokeColor`/`strokeWidth` control the two paint layers independently. `startAngle` and `endAngle` (degrees, measured clockwise from 12 o'clock, defaults 0–360) cut the shape into an arc: a partial angle range with fill gives a pie slice, with stroke only it gives an arc — driving `endAngle` from a number is the standard way to build a progress ring. It cannot have children; like other visual nodes it reports `onClick`, hover and pointer signals.

## When to use it

Status dots, avatars' presence badges, decorative shapes, and progress rings/pie indicators. For rectangular surfaces or anything that needs children use Group (with corner radius for rounded shapes); for pictures use Image; for glyphs use net.noodl.visual.icon.

## At a glance

| | |
|---|---|
| Category | Visual |
| Type name | `Circle` |
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
| `blockTouch` | Boolean | — | Stops every pointer event that lands here from reaching the nodes this one sits inside. Blunt: it takes hover and pointer-down with it, so reach for Click Bubbling first if it is only clicks you want to keep in |
| `clickBubbling` | Enum (`auto`, `always`, `never`) | `auto` | Whether a click here also fires Click on the nodes this one sits inside. Automatic keeps it here as soon as this node's own Click is connected, so a button inside a clickable card runs the button and not the card; Always is the older behaviour where both run; Never keeps every click here, wired or not. Note that an element at zero opacity takes no pointer events at all |
| `cornerRadius` | Number | `0` | Rounds the corners of the straight-edged shapes, in pixels; it stops at the roundest the shape can be |
| `cssClassName` | String | `` | Extra CSS class names to put on this element, for styling from a stylesheet you supply |
| `endAngle` | Number | `360` | Where the arc ends, in degrees clockwise from the top; 360 is a full circle |
| `fillColor` | Color | `red` | Colour of the inside of the circle, which has no effect while Fill is off |
| `fillEnabled` | Boolean | `true` | Draws the inside of the circle; turn it off for an outline only |
| `marginBottom` | Number | — | Space outside the element's bottom edge, between it and its neighbours |
| `marginLeft` | Number | — | Space outside the element's left edge, between it and its neighbours |
| `marginRight` | Number | — | Space outside the element's right edge, between it and its neighbours |
| `marginTop` | Number | — | Space outside the element's top edge, between it and its neighbours |
| `mixBlendMode` | Enum (`normal`, `multiply`, `screen`, `overlay`, `darken`, `lighten`, `color-dodge`, `color-burn`, `hard-light`, `soft-light`, `difference`, `exclusion`, `hue`, `saturation`, `color`, `luminosity`) | `normal` | How this element's colours blend with whatever is painted behind it |
| `mounted` | Boolean | `true` | Removes the element from the page entirely when false, unlike Visible which leaves its space behind |
| `opacity` | Number | `1` | How opaque this element is, from 0 for invisible to 1 for solid |
| `pointerEventsEnabled` | Boolean | `true` | When disabled, mouse and touch events pass through to whatever is behind this element |
| `pointerEventsMode` | Enum (`inherit`, `explicit`) | `inherit` | Whether pointer handling is inherited from the parent or set explicitly on this element |
| `points` | Number | `5` | How many sides a Polygon has, or how many points a Star has; the minimum is 3 |
| `position` | Enum (`relative`, `absolute`, `sticky`, `fixed`) | `relative` | How the element is placed: In Layout follows its siblings, Absolute ignores them, Sticky pins to the parent edge on overflow, Fixed stays put and takes no space |
| `shape` | Enum (`circle`, `square`, `triangle`, `polygon`, `star`, `svg`) | `circle` | Which outline this element draws inside its Size × Size box |
| `size` | Number | `100` | Diameter of the circle in pixels; it sets both width and height |
| `startAngle` | Number | `0` | Where the arc begins, in degrees clockwise from the top |
| `strokeColor` | Color | `black` | Colour of the outline |
| `strokeEnabled` | Boolean | `false` | Draws an outline around the circle; the two ports below do nothing while it is off |
| `strokeLineCap` | Enum (`butt`, `round`) | `butt` | Shape of the outline ends when Start and End Angle make an arc rather than a full circle |
| `strokeWidth` | Number | `10` | Thickness of the outline in pixels, drawn centred on the circle edge |
| `styleCss` | String | `/* background-color: red; */` | Raw CSS declarations applied to this element, overriding the styling ports above |
| `svgSource` | String | `` | Your own SVG markup, drawn inside the Size box. Script, event handlers, styles, animation and remote references are removed before it renders |
| `transformOriginX` | Number | `50` | Horizontal point the element rotates and scales around, as a fraction of its width |
| `transformOriginY` | Number | `50` | Vertical point the element rotates and scales around, as a fraction of its height |
| `transformRotation` | Number | `0` | Rotates the element clockwise in degrees, without affecting the layout |
| `transformScale` | Number | `1` | Scales the element about its transform origin; 1 leaves it unscaled |
| `transformX` | Number | `0` | Moves the element right after layout, without moving its siblings |
| `transformY` | Number | `0` | Moves the element down after layout, without moving its siblings |
| `variant` | String | — | Name of a saved variant of this node type to apply, replacing the styling set here |
| `visible` | Boolean | `true` | Hides the element while keeping the space it occupies in the layout |
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
| `pointerDown` | Signal | — | Fires when a mouse button is pressed or a finger touches this element |
| `pointerEnter` | Signal | — | Fires when the pointer moves onto this element, not counting its children |
| `pointerUp` | Signal | — | Fires when the mouse button is released or the finger lifts over this element |
| `willUnmount` | Signal | — | Fires just before this element is removed from the page, while it still exists |

## Dynamic ports

_This node's port list changes at runtime (declared-port-groups); the tables above may be incomplete for a given instance._

Declares conditional/expandable port groups whose visibility depends on parameter values (see declaredPortGroups).

| Condition | Inputs shown | Outputs shown |
|---|---|---|
| shape = circle OR shape NOT SET | `startAngle`, `endAngle`, `strokeLineCap` | — |
| shape = polygon OR shape = star | `points` | — |
| shape = square OR shape = triangle OR shape = polygon OR shape = star | `cornerRadius` | — |
| shape = svg | `svgSource` | — |
| pointerEventsMode = explicit | `pointerEventsEnabled` | — |
| acceptFileDrops = true | `acceptedFileTypes` | `filesDropped`, `filesRejected`, `droppedFile`, `droppedFiles`, `droppedFileName`, `droppedFileType`, `droppedFileSizeInBytes`, `isDragOver` |

## Ports at runtime

Declared-port-groups: the only conditional port is `pointerEventsEnabled`, which appears when `pointerEventsMode` is set to 'explicit'. Everything else in the catalog's port list is always present.

## Patterns

- Progress ring: stroke enabled, fill disabled, a 0–100 value remapped to 0–360 (Number Remapper or Expression) driving `endAngle`.
- Status dot: small `size`, `fillColor` bound from state — cheaper than an image asset.

## Examples

**Media card row: Columns layout with Image, Icon and Circle**

A card layout composed from the visual primitives: Columns (net.noodl.visual.columns) distributes its children by a layout string ('1 2' — the second column twice as wide), the Image shows a picture from a URL/asset on `src`, the Icon (net.noodl.visual.icon) renders a themed glyph, and the Circle doubles as a status dot whose `fillColor` is data-driven. Layout is containment; only the dynamic bits (image source, status color) are wired.

**Draggable chip that snaps back on release**

Drag is a visual container that makes its children draggable. Its `onStop` signal fires when the user releases; wiring it to the `snapToPositionX.do`/`snapToPositionY.do` signal inputs animates the chip back to the configured snap position (0,0 here) over the given duration. `positionX`/`positionY` report the live offset while dragging — here mapped into the label.

## Related nodes

[Group](./group.md), [Image](./image.md), [Icon](./net-noodl-visual-icon.md), [Number Remapper](../math/number-remapper.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
