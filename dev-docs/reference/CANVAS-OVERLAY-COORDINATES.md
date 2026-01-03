# Canvas Overlay Coordinate Transforms

## Overview

This document explains how coordinate transformation works between canvas space and screen space in overlay systems.

## Coordinate Systems

### Canvas Space (Graph Space)

- **Origin**: Arbitrary (user-defined)
- **Units**: Graph units (nodes have x, y positions)
- **Affected by**: Nothing - absolute positions in the graph
- **Example**: Node at `{ x: 500, y: 300 }` in canvas space

### Screen Space (Pixel Space)

- **Origin**: Top-left of the canvas element
- **Units**: CSS pixels
- **Affected by**: Pan and zoom transformations
- **Example**: Same node might be at `{ x: 800, y: 450 }` on screen when zoomed in

## The Transform Strategy

CommentLayer uses CSS transforms on the container to handle all coordinate transformation automatically:

```typescript
setPanAndScale(viewport: { x: number; y: number; scale: number }) {
  const transform = `scale(${viewport.scale}) translate(${viewport.x}px, ${viewport.y}px)`;
  this.container.style.transform = transform;
}
```

### Why This Is Brilliant

1. **No per-element calculations** - Set transform once on container
2. **Browser-optimized** - Hardware accelerated CSS transforms
3. **Simple** - Child elements automatically transform
4. **Performant** - Avoids layout thrashing

### How It Works

```
User pans/zooms canvas
    ↓
NodeGraphEditor.paint() called
    ↓
overlay.setPanAndScale({ x, y, scale })
    ↓
CSS transform applied to container
    ↓
Browser automatically transforms all children
```

## Transform Math (If You Need It)

Sometimes you need manual transformations (e.g., calculating if a point hits an element):

### Canvas to Screen

```typescript
function canvasToScreen(
  canvasPoint: { x: number; y: number },
  viewport: { x: number; y: number; scale: number }
): { x: number; y: number } {
  return {
    x: (canvasPoint.x + viewport.x) * viewport.scale,
    y: (canvasPoint.y + viewport.y) * viewport.scale
  };
}
```

**Example:**

```typescript
const nodePos = { x: 100, y: 200 }; // Canvas space
const viewport = { x: 50, y: 30, scale: 1.5 };

const screenPos = canvasToScreen(nodePos, viewport);
// Result: { x: 225, y: 345 }
```

### Screen to Canvas

```typescript
function screenToCanvas(
  screenPoint: { x: number; y: number },
  viewport: { x: number; y: number; scale: number }
): { x: number; y: number } {
  return {
    x: screenPoint.x / viewport.scale - viewport.x,
    y: screenPoint.y / viewport.scale - viewport.y
  };
}
```

**Example:**

```typescript
const clickPos = { x: 225, y: 345 }; // Screen pixels
const viewport = { x: 50, y: 30, scale: 1.5 };

const canvasPos = screenToCanvas(clickPos, viewport);
// Result: { x: 100, y: 200 }
```

## React Component Positioning

### Using Transform (Preferred)

React components positioned in canvas space:

```tsx
function OverlayElement({ x, y, children }: Props) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x, // Canvas coordinates
        top: y
        // Parent container handles transform!
      }}
    >
      {children}
    </div>
  );
}
```

The parent container's CSS transform automatically converts canvas coords to screen coords.

### Manual Calculation (Avoid)

Only if you must position outside the transformed container:

```tsx
function OverlayElement({ x, y, viewport, children }: Props) {
  const screenPos = canvasToScreen({ x, y }, viewport);

  return (
    <div
      style={{
        position: 'absolute',
        left: screenPos.x,
        top: screenPos.y
      }}
    >
      {children}
    </div>
  );
}
```

## Common Patterns

### Pattern 1: Node Overlay Badge

Show a badge on a specific node:

```tsx
function NodeBadge({ nodeId, nodegraphEditor }: Props) {
  const node = nodegraphEditor.nodeGraphModel.findNodeWithId(nodeId);

  if (!node) return null;

  // Use canvas coordinates directly
  return (
    <div
      style={{
        position: 'absolute',
        left: node.x + node.w, // Right edge of node
        top: node.y
      }}
    >
      <Badge>!</Badge>
    </div>
  );
}
```

### Pattern 2: Connection Path Highlight

Highlight a connection between two nodes:

```tsx
function ConnectionHighlight({ fromNode, toNode }: Props) {
  // Calculate path in canvas space
  const path = `M ${fromNode.x} ${fromNode.y} L ${toNode.x} ${toNode.y}`;

  return (
    <svg
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none'
      }}
    >
      <path d={path} stroke="blue" strokeWidth={3} />
    </svg>
  );
}
```

### Pattern 3: Mouse Hit Testing

Determine if a click hits an overlay element:

```typescript
function handleMouseDown(evt: MouseEvent) {
  // Get click position relative to canvas
  const canvasElement = this.nodegraphEditor.canvasElement;
  const rect = canvasElement.getBoundingClientRect();

  const screenPos = {
    x: evt.clientX - rect.left,
    y: evt.clientY - rect.top
  };

  // Convert to canvas space for hit testing
  const canvasPos = this.nodegraphEditor.relativeCoordsToNodeGraphCords(screenPos);

  // Check if click hits any of our elements
  const hitElement = this.elements.find((el) => pointInsideRectangle(canvasPos, el.bounds));
}
```

## Scale Considerations

### Scale-Dependent Sizes

Some overlay elements should scale with the canvas:

```tsx
// Node comment - scales with canvas
<div
  style={{
    position: 'absolute',
    left: node.x,
    top: node.y,
    width: 200, // Canvas units - scales automatically
    fontSize: 14 // Canvas units - scales automatically
  }}
>
  {comment}
</div>
```

### Scale-Independent Sizes

Some elements should stay the same pixel size regardless of zoom:

```tsx
// Control button - stays same size
<div
  style={{
    position: 'absolute',
    left: node.x,
    top: node.y,
    width: 20 / viewport.scale, // Inverse scale
    height: 20 / viewport.scale,
    fontSize: 12 / viewport.scale
  }}
>
  ×
</div>
```

## Best Practices

### ✅ Do

1. **Use container transform** - Let CSS do the work
2. **Store positions in canvas space** - Easier to reason about
3. **Calculate once** - Transform in render, not on every frame
4. **Cache viewport** - Store current viewport for calculations

### ❌ Don't

1. **Don't recalculate on every mouse move** - Only when needed
2. **Don't mix coordinate systems** - Be consistent
3. **Don't forget about scale** - Always consider zoom level
4. **Don't transform twice** - Either container OR manual, not both

## Debugging Tips

### Visualize Coordinate Systems

```tsx
function CoordinateDebugger({ viewport }: Props) {
  return (
    <>
      {/* Canvas origin */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 10,
          height: 10,
          background: 'red'
        }}
      />

      {/* Grid lines every 100 canvas units */}
      {Array.from({ length: 20 }, (_, i) => (
        <line key={i} x1={i * 100} y1={0} x2={i * 100} y2={2000} stroke="rgba(255,0,0,0.1)" />
      ))}
    </>
  );
}
```

### Log Transforms

```typescript
console.log('Canvas pos:', { x: node.x, y: node.y });
console.log('Viewport:', viewport);
console.log('Screen pos:', canvasToScreen({ x: node.x, y: node.y }, viewport));
```

## Related Documentation

- [Main Overview](./CANVAS-OVERLAY-PATTERN.md)
- [Architecture](./CANVAS-OVERLAY-ARCHITECTURE.md)
- [Mouse Events](./CANVAS-OVERLAY-EVENTS.md)
