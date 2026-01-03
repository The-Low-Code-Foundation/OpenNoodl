# Canvas Overlay Mouse Event Handling

## Overview

This document explains how mouse events are handled when overlays sit in front of the canvas. This is complex because events hit the overlay first but sometimes need to be routed to the canvas.

## The Challenge

```
DOM Layering:
┌─────────────────────┐ ← Mouse events hit here first
│ Foreground Overlay  │   (z-index: 2)
├─────────────────────┤
│ Canvas              │   (z-index: 1)
├─────────────────────┤
│ Background Overlay  │   (z-index: 0)
└─────────────────────┘
```

When the user clicks:

1. Does it hit overlay UI (button, resize handle)?
2. Does it hit a node visible through the overlay?
3. Does it hit empty space?

The overlay must intelligently decide whether to handle or forward the event.

## CommentLayer's Solution

### Step 1: Capture All Mouse Events

Attach listeners to the foreground overlay div:

```typescript
setupMouseEventHandling(foregroundDiv: HTMLDivElement) {
  const events = {
    mousedown: 'down',
    mouseup: 'up',
    mousemove: 'move',
    click: 'click'
  };

  for (const eventName in events) {
    foregroundDiv.addEventListener(eventName, (evt) => {
      this.handleMouseEvent(evt, events[eventName]);
    }, true); // Capture phase!
  }
}
```

### Step 2: Check for Overlay UI

```typescript
handleMouseEvent(evt: MouseEvent, type: string) {
  // Is this an overlay control?
  if (evt.target && evt.target.closest('.comment-controls')) {
    // Let it through - user is interacting with overlay UI
    return;
  }

  // Otherwise, check if canvas should handle it...
}
```

### Step 3: Forward to Canvas if Needed

```typescript
// Convert mouse position to canvas coordinates
const tl = this.nodegraphEditor.topLeftCanvasPos;
const pos = {
  x: evt.pageX - tl[0],
  y: evt.pageY - tl[1]
};

// Ask canvas if it wants this event
const consumed = this.nodegraphEditor.mouse(type, pos, evt, {
  eventPropagatedFromCommentLayer: true
});

if (consumed) {
  // Canvas handled it (e.g., hit a node)
  evt.stopPropagation();
  evt.preventDefault();
}
```

## Event Flow Diagram

```
Mouse Click
    ↓
Foreground Overlay receives event
    ↓
Is target .comment-controls?
    ├─ Yes → Let event propagate normally (overlay handles)
    └─ No  → Continue checking
         ↓
    Forward to NodeGraphEditor.mouse()
         ↓
    Did canvas consume event?
         ├─ Yes → Stop propagation (canvas handled)
         └─ No  → Let event propagate (overlay handles)
```

## Preventing Infinite Loops

The `eventPropagatedFromCommentLayer` flag prevents recursion:

```typescript
// In NodeGraphEditor
mouse(type, pos, evt, args) {
  // Don't start another check if this came from overlay
  if (args && args.eventPropagatedFromCommentLayer) {
    // Just check if we hit something
    const hitNode = this.findNodeAtPosition(pos);
    return !!hitNode;
  }

  // Normal mouse handling...
}
```

## Pointer Events CSS

Use `pointer-events` to control which elements receive events:

```css
/* Overlay container - pass through clicks */
.overlay-container {
  pointer-events: none;
}

/* But controls receive clicks */
.overlay-controls {
  pointer-events: auto;
}
```

## Mouse Wheel Handling

Wheel events have special handling:

```typescript
foregroundDiv.addEventListener('wheel', (evt) => {
  // Allow scroll in textarea
  if (evt.target.tagName === 'TEXTAREA' && !evt.ctrlKey && !evt.metaKey) {
    return; // Let it scroll
  }

  // Otherwise zoom the canvas
  const tl = this.nodegraphEditor.topLeftCanvasPos;
  this.nodegraphEditor.handleMouseWheelEvent(evt, {
    offsetX: evt.pageX - tl[0],
    offsetY: evt.pageY - tl[1]
  });
});
```

## Click vs Down/Up

NodeGraphEditor doesn't use `click` events, only `down`/`up`. Handle this:

```typescript
let ignoreNextClick = false;

if (type === 'down' || type === 'up') {
  if (consumed) {
    // Canvas consumed the up/down, so ignore the click that follows
    ignoreNextClick = true;
    setTimeout(() => { ignoreNextClick = false; }, 1000);
  }
}

if (type === 'click' && ignoreNextClick) {
  ignoreNextClick = false;
  evt.stopPropagation();
  evt.preventDefault();
  return;
}
```

## Multi-Select Drag Initiation

Start dragging selected nodes/comments from overlay:

```typescript
if (type === 'down') {
  const hasSelection = this.props.selectedIds.length > 1 || this.nodegraphEditor.selector.active;

  if (hasSelection) {
    const canvasPos = this.nodegraphEditor.relativeCoordsToNodeGraphCords(pos);

    // Check if starting drag on a selected item
    const clickedItem = this.findItemAtPosition(canvasPos);
    if (clickedItem && this.isSelected(clickedItem)) {
      this.nodegraphEditor.startDraggingNodes(this.nodegraphEditor.selector.nodes);
      evt.stopPropagation();
      evt.preventDefault();
    }
  }
}
```

## Common Patterns

### Pattern 1: Overlay Button

```tsx
<button className="overlay-button" onClick={() => this.handleButtonClick()} style={{ pointerEvents: 'auto' }}>
  Delete
</button>
```

The `className` check catches this button, event doesn't forward to canvas.

### Pattern 2: Draggable Overlay Element

```tsx
// Using react-rnd
<Rnd
  position={{ x: comment.x, y: comment.y }}
  onDragStart={() => {
    // Disable canvas mouse events during drag
    this.nodegraphEditor.setMouseEventsEnabled(false);
  }}
  onDragStop={() => {
    // Re-enable canvas mouse events
    this.nodegraphEditor.setMouseEventsEnabled(true);
  }}
>
  {content}
</Rnd>
```

### Pattern 3: Clickthrough SVG Overlay

```tsx
<svg
  style={{
    position: 'absolute',
    pointerEvents: 'none',  // Pass all events through
    ...
  }}
>
  <path d={highlightPath} stroke="blue" />
</svg>
```

## Keyboard Events

Forward keyboard events unless typing in an input:

```typescript
foregroundDiv.addEventListener('keydown', (evt) => {
  if (evt.target.tagName === 'TEXTAREA' || evt.target.tagName === 'INPUT') {
    // Let the input handle it
    return;
  }

  // Forward to KeyboardHandler
  KeyboardHandler.instance.executeCommandMatchingKeyEvent(evt, 'down');
});
```

## Best Practices

### ✅ Do

1. **Use capture phase** - `addEventListener(event, handler, true)`
2. **Check target element** - `evt.target.closest('.my-controls')`
3. **Prevent after handling** - Call `stopPropagation()` and `preventDefault()`
4. **Handle wheel specially** - Allow textarea scroll, forward canvas zoom

### ❌ Don't

1. **Don't forward everything** - Check if overlay should handle first
2. **Don't forget click events** - Handle the click/down/up difference
3. **Don't block all events** - Use `pointer-events: none` strategically
4. **Don't recurse** - Use flags to prevent infinite forwarding

## Debugging Tips

### Log Event Flow

```typescript
handleMouseEvent(evt, type) {
  console.log('Event:', type, 'Target:', evt.target.className);

  const consumed = this.nodegraphEditor.mouse(type, pos, evt, args);

  console.log('Canvas consumed:', consumed);
}
```

### Visualize Hit Areas

```css
/* Temporarily add borders to debug */
.comment-controls {
  border: 2px solid red !important;
}
```

### Check Pointer Events

```typescript
console.log('Pointer events:', window.getComputedStyle(element).pointerEvents);
```

## Related Documentation

- [Main Overview](./CANVAS-OVERLAY-PATTERN.md)
- [Architecture](./CANVAS-OVERLAY-ARCHITECTURE.md)
- [Coordinate Transforms](./CANVAS-OVERLAY-COORDINATES.md)
