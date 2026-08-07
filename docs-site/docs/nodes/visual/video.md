---
title: "Video"
---
Plays video from a URL or MediaStream, with play/pause/restart/reset signals and playback-position output.

Video renders an HTML `video` element. `src` (a string URL or project asset path) or `srcObject` (a MediaStream, e.g. a camera feed) supplies the media; `poster` shows an image before playback; `autoplay`, `loop`, `muted`, `controls` and `volume` map directly onto the element. Playback is driven by four signal inputs: `play` resumes, `pause` pauses, `restart` seeks to the start and plays, `reset` seeks to the start and pauses. Outputs report state: `onPlay`/`onPause`/`onCanPlay` are signals from the element's events, `onTimeUpdate` (Playback Position) is a number holding the current time in seconds, and `videoWidth`/`videoHeight` give the intrinsic size once known.

## When to use it

Embedded video content, background/hero loops, and camera previews (wire a media stream to `srcObject`). For still pictures use Image. Browsers block unmuted autoplay — combine `autoplay` with `muted` for background video, or start playback from a user action via `play`.

## At a glance

| | |
|---|---|
| Category | Visual |
| Type name | `Video` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `alignX` | Enum (`left`, `center`, `right`) | — | Horizontal alignment of this element within the space its parent gives it |
| `alignY` | Enum (`top`, `center`, `bottom`) | — | Vertical alignment of this element within the space its parent gives it |
| `autoplay` | Boolean | — | Starts playing as soon as the video can; most browsers only allow this while Muted is on |
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
| `clickBubbling` | Enum (`auto`, `always`, `never`) | `auto` | Whether a click here also fires Click on the nodes this one sits inside. Automatic keeps it here as soon as this node's own Click is connected, so a button inside a clickable card runs the button and not the card; Always is the older behaviour where both run; Never keeps every click here, wired or not. Note that an element at zero opacity takes no pointer events at all |
| `controls` | Boolean | — | Shows the browser's own play, seek and volume controls |
| `cssClassName` | String | `` | Extra CSS class names to put on this element, for styling from a stylesheet you supply |
| `height` | Dimension | `100` | Height of the element; how the value is read depends on Size Mode |
| `loop` | Boolean | — | Restarts the video automatically when it reaches the end |
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
| `muted` | Boolean | — | Silences the video without changing Volume, and is what lets Autoplay work |
| `objectFit` | Enum (`contain`, `cover`, `fill`, `none`) | `contain` | How the video fills its box when the two have different proportions |
| `objectPositionX` | Number | `50` | Which part of the video stays visible horizontally when Object Fit crops it |
| `objectPositionY` | Number | `50` | Which part of the video stays visible vertically when Object Fit crops it |
| `opacity` | Number | `1` | How opaque this element is, from 0 for invisible to 1 for solid |
| `pointerEventsEnabled` | Boolean | `true` | When disabled, mouse and touch events pass through to whatever is behind this element |
| `pointerEventsMode` | Enum (`inherit`, `explicit`) | `inherit` | Whether pointer handling is inherited from the parent or set explicitly on this element |
| `position` | Enum (`relative`, `absolute`, `sticky`, `fixed`) | `relative` | How the element is placed: In Layout follows its siblings, Absolute ignores them, Sticky pins to the parent edge on overflow, Fixed stays put and takes no space |
| `poster` | Image | — | Still image shown until the video has enough data to play; leave blank to show nothing |
| `sizeMode` | Enum (`explicit`, `contentWidth`, `contentHeight`, `contentSize`) | `contentSize` | Whether Width and Height are used as given, or the element sizes itself to fit its contents |
| `src` | String | — | URL or project file to play; leave blank to load nothing rather than fail on a missing source |
| `srcObject` | Mediastream | `null` | A live MediaStream to play, from a camera or screen capture, instead of a URL |
| `styleCss` | String | `/* background-color: red; */` | Raw CSS declarations applied to this element, overriding the styling ports above |
| `transformOriginX` | Number | `50` | Horizontal point the element rotates and scales around, as a fraction of its width |
| `transformOriginY` | Number | `50` | Vertical point the element rotates and scales around, as a fraction of its height |
| `transformRotation` | Number | `0` | Rotates the element clockwise in degrees, without affecting the layout |
| `transformScale` | Number | `1` | Scales the element about its transform origin; 1 leaves it unscaled |
| `transformX` | Number | `0` | Moves the element right after layout, without moving its siblings |
| `transformY` | Number | `0` | Moves the element down after layout, without moving its siblings |
| `variant` | String | — | Name of a saved variant of this node type to apply, replacing the styling set here |
| `visible` | Boolean | `true` | Hides the element while keeping the space it occupies in the layout |
| `volume` | Number | `1` | Playback volume from 0 to 1 |
| `width` | Dimension | `100` | Width of the element; how the value is read depends on Size Mode |
| `zIndex` | Number | — | Paint order among overlapping siblings; higher numbers paint on top |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `pause` | Signal | — | Pauses playback |
| `play` | Signal | — | Starts or resumes playback; fired before the element exists, it is held until the element exists rather than dropped |
| `reset` | Signal | — | Stops playback and seeks to the beginning |
| `restart` | Signal | — | Seeks to the beginning and plays, then fires Done |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `boundingHeight` | Number | — | Height this element actually ended up with after layout, in pixels |
| `boundingWidth` | Number | — | Width this element actually ended up with after layout, in pixels |
| `childIndex` | Number | — | This element's position among its parent's children, counting from 0 |
| `onTimeUpdate` | Number | — | How far into the video playback has reached, in seconds |
| `onVideoElementCreated` | Domelement | — | The underlying video element, for a Group to scroll to or a script to reach |
| `screenPositionX` | Number | — | Distance in pixels from the left edge of the window to this element's left edge |
| `screenPositionY` | Number | — | Distance in pixels from the top edge of the window to this element's top edge |
| `this` | Reference | — | A reference to this node itself, for ports that take a node rather than a value |
| `videoHeight` | Number | — | Natural height of the video in pixels, known once it has loaded |
| `videoWidth` | Number | — | Natural width of the video in pixels, known once it has loaded |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `didMount` | Signal | — | Fires once this element has been added to the page and can be measured |
| `done` | Signal | — | Fires once a Video Action has been carried out by the element |
| `hoverEnd` | Signal | — | Fires when the pointer leaves this element |
| `hoverStart` | Signal | — | Fires when the pointer moves over this element or any of its children |
| `onCanPlay` | Signal | — | Fires once enough of the video has loaded to start playing |
| `onClick` | Signal | — | Fires when this element is clicked or tapped |
| `onPause` | Signal | — | Fires when playback pauses |
| `onPlay` | Signal | — | Fires when playback starts or resumes |
| `pointerDown` | Signal | — | Fires when a mouse button is pressed or a finger touches this element |
| `pointerEnter` | Signal | — | Fires when the pointer moves onto this element, not counting its children |
| `pointerUp` | Signal | — | Fires when the mouse button is released or the finger lifts over this element |
| `willUnmount` | Signal | — | Fires just before this element is removed from the page, while it still exists |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `failure` | Signal | — | Fires when the action never reached the element, because it has still not mounted |
| `onPlaybackFailure` | Signal | — | Fires when the video could not be loaded or played, after the reason has been reported on Error |
| `playbackError` | String | — | Why playback failed — either the browser refused to autoplay, or the source could not be decoded |

## Dynamic ports

_This node's port list changes at runtime (declared-port-groups); the tables above may be incomplete for a given instance._

Declares conditional/expandable port groups whose visibility depends on parameter values (see declaredPortGroups).

| Condition | Inputs shown | Outputs shown |
|---|---|---|
| sizeMode = explicit OR sizeMode = contentHeight | `width` | — |
| sizeMode = explicit OR sizeMode = contentWidth | `height` | — |
| pointerEventsMode = explicit | `pointerEventsEnabled` | — |
| borderStyle = solid OR borderStyle = dashed OR borderStyle = dotted  | `borderWidth`, `borderColor` | — |
| borderLeftStyle = solid OR borderLeftStyle = dashed OR borderLeftStyle = dotted OR borderStyle = solid OR borderStyle = dashed OR borderStyle = dotted  | `borderLeftWidth`, `borderLeftColor` | — |
| borderTopStyle = solid OR borderTopStyle = dashed OR borderTopStyle = dotted OR borderStyle = solid OR borderStyle = dashed OR borderStyle = dotted  | `borderTopWidth`, `borderTopColor` | — |
| borderRightStyle = solid OR borderRightStyle = dashed OR borderRightStyle = dotted OR borderStyle = solid OR borderStyle = dashed OR borderStyle = dotted  | `borderRightWidth`, `borderRightColor` | — |
| borderBottomStyle = solid OR borderBottomStyle = dashed OR borderBottomStyle = dotted OR borderStyle = solid OR borderStyle = dashed OR borderStyle = dotted  | `borderBottomWidth`, `borderBottomColor` | — |

## Ports at runtime

Declared-port-groups: `width`/`height` appear based on `sizeMode`, per-side border width/color ports appear once a border style is chosen, and `pointerEventsEnabled` appears when `pointerEventsMode` is 'explicit'. The playback and event ports are always present.

## Patterns

- Button `onClick` → `play`: user-initiated playback that satisfies browser autoplay policies.
- Background hero: `autoplay` + `muted` + `loop` true, `controls` false, `objectFit` 'cover'.

## Watch out for

- Expecting `autoplay` alone to start sound-on playback — browsers refuse; either set `muted` or trigger `play` from a user gesture.

## Examples

**Wrapper component: Component Children marks the insertion point**

Component Children is a placeholder with no ports: whatever children are given to an *instance* of the component are rendered where the placeholder sits. Here '/Media Frame' is a reusable framed panel — title bar on top, content slot below — and the consumer drops a Video inside its instance. The video's play/pause wiring lives at the consumer level; the frame knows nothing about its content.

## Related nodes

[Image](./image.md), [Group](./group.md), [Button](./net-noodl-controls-button.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
