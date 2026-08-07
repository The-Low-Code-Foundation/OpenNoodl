---
title: "Icon"
---
Displays a glyph from a project icon font, or an image, at a given size — tintable via color for font icons.

Icon renders a single icon. With `iconSourceType` (Type) set to 'icon' (the default) it shows a glyph from an icon set enabled in the project — `iconIconSource` (Icon Source) identifies the glyph (a CSS class plus code) and `iconColor` tints it, `iconSize` setting the font size in pixels. With `iconSourceType` 'image' it instead shows `iconImageSource` (Image Source) as a square image of `iconSize`; `iconColor` has no effect on images. The node cannot have children and carries the usual margin/padding, alignment and transform parameters (with a default 5px padding on all sides).

## When to use it

Decorative or informative glyphs next to text, in cards, headers and list rows. For a clickable icon button prefer net.noodl.controls.button with its icon settings (states and accessibility included) — or wire this node's parent Group's `onClick`. For full pictures use Image.

## At a glance

| | |
|---|---|
| Category | Visual |
| Type name | `net.noodl.visual.icon` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `alignX` | Enum (`left`, `center`, `right`) | — | Horizontal alignment of this element within the space its parent gives it |
| `alignY` | Enum (`top`, `center`, `bottom`) | — | Vertical alignment of this element within the space its parent gives it |
| `cssClassName` | String | `` | Extra CSS class names to put on this element, for styling from a stylesheet you supply |
| `iconColor` | Color | `#FFFFFF` | Colour of the icon |
| `iconIconSource` | Icon | — | Which glyph to show, picked from an installed icon set |
| `iconImageSource` | Image | — | Image file to show instead of an icon-set glyph |
| `iconSize` | Number | `16` | Height of the icon |
| `iconSourceType` | Enum (`image`, `icon`) | `icon` | Whether the icon comes from an installed icon set or from an image file, which decides the source port below |
| `marginBottom` | Number | — | Space outside the element's bottom edge, between it and its neighbours |
| `marginLeft` | Number | — | Space outside the element's left edge, between it and its neighbours |
| `marginRight` | Number | — | Space outside the element's right edge, between it and its neighbours |
| `marginTop` | Number | — | Space outside the element's top edge, between it and its neighbours |
| `mixBlendMode` | Enum (`normal`, `multiply`, `screen`, `overlay`, `darken`, `lighten`, `color-dodge`, `color-burn`, `hard-light`, `soft-light`, `difference`, `exclusion`, `hue`, `saturation`, `color`, `luminosity`) | `normal` | How this element's colours blend with whatever is painted behind it |
| `mounted` | Boolean | `true` | Removes the element from the page entirely when false, unlike Visible which leaves its space behind |
| `opacity` | Number | `1` | How opaque this element is, from 0 for invisible to 1 for solid |
| `paddingBottom` | Number | `0` | Space inside the element's bottom edge, between it and its content |
| `paddingLeft` | Number | `0` | Space inside the element's left edge, between it and its content |
| `paddingRight` | Number | `0` | Space inside the element's right edge, between it and its content |
| `paddingTop` | Number | `0` | Space inside the element's top edge, between it and its content |
| `position` | Enum (`relative`, `absolute`, `sticky`, `fixed`) | `relative` | How the element is placed: In Layout follows its siblings, Absolute ignores them, Sticky pins to the parent edge on overflow, Fixed stays put and takes no space |
| `styleCss` | String | `/* background-color: red; */` | Raw CSS declarations applied to this element, overriding the styling ports above |
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
| useIcon = true OR useIcon NOT SET | `iconSourceType`, `iconSize` | — |
| #js (params.useIcon===true \|\| params.useIcon===undefined) && params.iconSourceType === 'image' | `iconImageSource` | — |
| #js (params.useIcon===true \|\| params.useIcon===undefined) && params.iconSourceType === 'icon' | `iconIconSource`, `iconColor` | — |

## Ports at runtime

Declared-port-groups keyed on `iconSourceType`: 'icon' exposes `iconIconSource` and `iconColor`, 'image' exposes `iconImageSource`; `iconSize` and `iconSourceType` are always shown. (An internal `useIcon` flag defaults to true and has no editor input on this node.)

## Patterns

- Icon + Text in a row Group: the standard labeled-metadata row in cards and lists.
- Bind `iconColor` from state (e.g. a Condition's boolean via a Switch/States color) to reflect status.

## Examples

**Media card row: Columns layout with Image, Icon and Circle**

A card layout composed from the visual primitives: Columns (net.noodl.visual.columns) distributes its children by a layout string ('1 2' — the second column twice as wide), the Image shows a picture from a URL/asset on `src`, the Icon (net.noodl.visual.icon) renders a themed glyph, and the Circle doubles as a status dot whose `fillColor` is data-driven. Layout is containment; only the dynamic bits (image source, status color) are wired.

## Related nodes

[Image](./image.md), [Text](./text.md), [Circle](./circle.md), [Button](./net-noodl-controls-button.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
