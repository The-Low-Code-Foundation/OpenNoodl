---
title: "Drag"
---
Makes its child subtree draggable along X and/or Y, reporting position and drag signals, with animated snap-to-position.

Drag is a visual container: whatever you place inside it can be dragged with the pointer. `axis` restricts movement ('x' by default, 'y' or 'both'), `enabled` turns dragging on/off, and `useParentBounds` (Constrain to parent, default true) keeps the content inside its parent's box. While dragging, `positionX`/`positionY` (Drag X/Y) hold the current offset in pixels and `deltaX`/`deltaY` the per-move change; `onStart` (Drag Started), `onDrag` (Drag Moved) and `onStop` (Drag Ended) are signals bracketing the gesture. The position can also be driven from the graph: setting `inputPositionX`/`inputPositionY` (Start Drag X/Y) moves the content and updates the outputs, and the `snapToPositionX.do`/`snapToPositionY.do` signals animate to `snapToPositionX.value` over `snapToPositionX.duration` milliseconds (default 300).

## When to use it

Sliders, swipeable cards, drawers, reorder handles — any direct-manipulation gesture where you need the live drag offset. For scrolling content use a Group with scrolling enabled instead; for purely programmatic motion use an Animation on a node's Pos X/Y rather than a Drag no one touches.

## At a glance

| | |
|---|---|
| Category | Visual |
| Type name | `Drag` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `axis` | Enum (`x`, `y`, `both`) | `x` | Which axes dragging is allowed on |
| `cssClassName` | String | `` | Extra CSS class names to put on this element, for styling from a stylesheet you supply |
| `enabled` | Boolean | `true` | Lets the user drag this element; when off it still renders and still responds to the Snap actions |
| `inputPositionX` | Number | — | Sets the X position the element starts at, before any dragging |
| `inputPositionY` | Number | — | Sets the Y position the element starts at, before any dragging |
| `mounted` | Boolean | `true` | Removes the element from the page entirely when false, unlike Visible which leaves its space behind |
| `scale` | Number | `1` | Divides pointer movement before it becomes element movement, so 2 makes the element move half as far as the pointer |
| `snapToPositionX.duration` | Number | `300` | How long the X snap animation takes, in milliseconds |
| `snapToPositionX.value` | Number | `0` | X position the element animates to when Snap To Position X — Do fires. An empty value leaves the current position alone |
| `snapToPositionY.duration` | Number | `300` | How long the Y snap animation takes, in milliseconds |
| `snapToPositionY.value` | Number | `0` | Y position the element animates to when Snap To Position Y — Do fires. An empty value leaves the current position alone |
| `styleCss` | String | `/* background-color: red; */` | Raw CSS declarations applied to this element, overriding the styling ports above |
| `useParentBounds` | Boolean | `true` | Stops the element being dragged outside its parent's bounds |
| `variant` | String | — | Name of a saved variant of this node type to apply, replacing the styling set here |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `snapToPositionX.do` | Signal | — | Animates the element to Value on the X axis; does nothing if it is already there |
| `snapToPositionY.do` | Signal | — | Animates the element to Value on the Y axis; does nothing if it is already there |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `boundingHeight` | Number | — | Height this element actually ended up with after layout, in pixels |
| `boundingWidth` | Number | — | Width this element actually ended up with after layout, in pixels |
| `childIndex` | Number | — | This element's position among its parent's children, counting from 0 |
| `childrenCount` | Number | — | How many child elements are currently mounted inside this one |
| `deltaX` | Number | — | How far the element moved on X since the last Drag Moved |
| `deltaY` | Number | — | How far the element moved on Y since the last Drag Moved |
| `positionX` | Number | — | Current X position of the element relative to where it started |
| `positionY` | Number | — | Current Y position of the element relative to where it started |
| `screenPositionX` | Number | — | Distance in pixels from the left edge of the window to this element's left edge |
| `screenPositionY` | Number | — | Distance in pixels from the top edge of the window to this element's top edge |
| `this` | Reference | — | A reference to this node itself, for ports that take a node rather than a value |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `didMount` | Signal | — | Fires once this element has been added to the page and can be measured |
| `done` | Signal | — | Fires once a snap animation has been started on the element |
| `onDrag` | Signal | — | Fires on every frame the element moves while being dragged |
| `onStart` | Signal | — | Fires when the user starts dragging |
| `onStop` | Signal | — | Fires when the user releases the element, including when the pointer leaves the window |
| `willUnmount` | Signal | — | Fires just before this element is removed from the page, while it still exists |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `failure` | Signal | — | Fires when the snap never reached the element, because it has still not mounted |

## Patterns

- Snap back: `onStop` → `snapToPositionX.do` with `snapToPositionX.value` 0 — released content animates home.
- Swipe threshold: `positionX` → Expression/Condition deciding on `onStop` whether to snap to the open or closed position.

## Watch out for

- Rebuilding a scroll view out of Drag — a Group with scrolling enabled handles momentum, wheel and touch for free.

## Examples

**Draggable chip that snaps back on release**

Drag is a visual container that makes its children draggable. Its `onStop` signal fires when the user releases; wiring it to the `snapToPositionX.do`/`snapToPositionY.do` signal inputs animates the chip back to the configured snap position (0,0 here) over the given duration. `positionX`/`positionY` report the live offset while dragging — here mapped into the label.

## Related nodes

[Group](./group.md), [Animation](../animation/animation.md), [Condition](../logic/condition.md), [States](../animation/states.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
