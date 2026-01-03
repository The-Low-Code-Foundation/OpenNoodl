# Canvas Overlay React Integration

## Overview

This document covers React 19 specific patterns for canvas overlays, including root management, lifecycle, and common gotchas.

## React 19 Root API

CommentLayer uses the modern React 19 `createRoot` API:

```typescript
import { createRoot, Root } from 'react-dom/client';

class MyOverlay {
  private backgroundRoot: Root;
  private foregroundRoot: Root;

  renderTo(backgroundDiv: HTMLDivElement, foregroundDiv: HTMLDivElement) {
    // Create roots once
    this.backgroundRoot = createRoot(backgroundDiv);
    this.foregroundRoot = createRoot(foregroundDiv);

    // Render
    this._renderReact();
  }

  private _renderReact() {
    this.backgroundRoot.render(<Background {...this.props} />);
    this.foregroundRoot.render(<Foreground {...this.props} />);
  }

  dispose() {
    this.backgroundRoot.unmount();
    this.foregroundRoot.unmount();
  }
}
```

## Key Pattern: Root Reuse

**✅ Create once, render many times:**

```typescript
// Good - root created once in constructor/setup
constructor() {
  this.root = createRoot(this.container);
}

updateData() {
  // Reuse existing root
  this.root.render(<Component data={this.newData} />);
}
```

**❌ Never recreate roots:**

```typescript
// Bad - memory leak!
updateData() {
  this.root = createRoot(this.container); // Creates new root every time
  this.root.render(<Component data={this.newData} />);
}
```

## State Management

### Props Pattern (CommentLayer's Approach)

Store state in the overlay class, pass as props:

```typescript
class DataLineageOverlay {
  private props: {
    paths: DataPath[];
    selectedPath: string | null;
    viewport: Viewport;
  };

  constructor() {
    this.props = {
      paths: [],
      selectedPath: null,
      viewport: { x: 0, y: 0, scale: 1 }
    };
  }

  setSelectedPath(pathId: string) {
    this.props.selectedPath = pathId;
    this.render();
  }

  private render() {
    this.root.render(<LineageView {...this.props} />);
  }
}
```

### React State (If Needed)

For complex overlays, use React state internally:

```typescript
function LineageView({ paths, onPathSelect }: Props) {
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div>
      {paths.map((path) => (
        <PathHighlight
          key={path.id}
          path={path}
          isHovered={hoveredPath === path.id}
          onMouseEnter={() => setHoveredPath(path.id)}
          onMouseLeave={() => setHoveredPath(null)}
          onClick={() => onPathSelect(path.id)}
        />
      ))}
    </div>
  );
}
```

## Scale Prop Special Case

**Important:** react-rnd needs `scale` prop on mount for proper setup:

```typescript
setPanAndScale(viewport: Viewport) {
  const transform = `scale(${viewport.scale}) translate(${viewport.x}px, ${viewport.y}px)`;
  this.container.style.transform = transform;

  // Must re-render if scale changed (for react-rnd)
  if (this.props.scale !== viewport.scale) {
    this.props.scale = viewport.scale;
    this._renderReact();
  }
}
```

From CommentLayer:

```tsx
// react-rnd requires "scale" to be set when this mounts
if (props.scale === undefined) {
  return null; // Don't render until scale is set
}
```

## Async Rendering Workaround

React effects that trigger renders cause warnings. Use setTimeout:

```typescript
renderTo(container: HTMLDivElement) {
  this.container = container;
  this.root = createRoot(container);

  // Ugly workaround to avoid React warnings
  // when mounting inside another React effect
  setTimeout(() => {
    this._renderReact();
  }, 1);
}
```

## Performance Optimization

### Memoization

```tsx
import { memo, useMemo } from 'react';

const PathHighlight = memo(function PathHighlight({ path, viewport }: Props) {
  // Expensive path calculation
  const svgPath = useMemo(() => {
    return calculateSVGPath(path.nodes, viewport);
  }, [path.nodes, viewport.scale]); // Re-calc only when needed

  return <path d={svgPath} stroke="blue" strokeWidth={3} />;
});
```

### Virtualization

For many overlay elements (100+), consider virtualization:

```tsx
import { FixedSizeList } from 'react-window';

function ManyOverlayElements({ items, viewport }: Props) {
  return (
    <FixedSizeList height={viewport.height} itemCount={items.length} itemSize={50} width={viewport.width}>
      {({ index, style }) => (
        <div style={style}>
          <OverlayElement item={items[index]} />
        </div>
      )}
    </FixedSizeList>
  );
}
```

## Common Patterns

### Pattern 1: Conditional Rendering Based on Scale

```tsx
function AdaptiveOverlay({ scale }: Props) {
  // Hide detailed UI when zoomed out
  if (scale < 0.5) {
    return <SimplifiedView />;
  }

  return <DetailedView />;
}
```

### Pattern 2: Portal for Tooltips

Tooltips should escape the transformed container:

```tsx
import { createPortal } from 'react-dom';

function OverlayWithTooltip({ tooltip }: Props) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <>
      <div onMouseEnter={() => setShowTooltip(true)}>Hover me</div>

      {showTooltip &&
        createPortal(
          <Tooltip>{tooltip}</Tooltip>,
          document.body // Render outside transformed container
        )}
    </>
  );
}
```

### Pattern 3: React + External Library (react-rnd)

CommentLayer uses react-rnd for draggable comments:

```tsx
import { Rnd } from 'react-rnd';

<Rnd
  position={{ x: comment.x, y: comment.y }}
  size={{ width: comment.w, height: comment.h }}
  scale={scale} // Pass viewport scale
  onDragStop={(e, d) => {
    updateComment(
      comment.id,
      {
        x: d.x,
        y: d.y
      },
      { commit: true }
    );
  }}
  onResizeStop={(e, direction, ref, delta, position) => {
    updateComment(
      comment.id,
      {
        x: position.x,
        y: position.y,
        w: ref.offsetWidth,
        h: ref.offsetHeight
      },
      { commit: true }
    );
  }}
>
  {content}
</Rnd>;
```

## Gotchas

### ❌ Gotcha 1: Transform Affects Event Coordinates

```tsx
// Event coordinates are in screen space, not canvas space
function handleClick(evt: React.MouseEvent) {
  // Wrong - these are screen coordinates
  console.log(evt.clientX, evt.clientY);

  // Need to convert to canvas space
  const canvasPos = screenToCanvas({ x: evt.clientX, y: evt.clientY }, viewport);
}
```

### ❌ Gotcha 2: CSS Transform Affects Children

All children inherit the container transform. For fixed-size UI:

```tsx
<div
  style={{
    // This size will be scaled by container transform
    width: 20 / scale, // Compensate for scale
    height: 20 / scale
  }}
>
  Fixed size button
</div>
```

### ❌ Gotcha 3: React Dev Tools Performance

React Dev Tools can slow down overlays with many elements. Disable in production builds.

## Best Practices

### ✅ Do

1. **Create roots once** - In constructor/renderTo, not on every render
2. **Memoize expensive calculations** - Use useMemo for complex math
3. **Use React.memo for components** - Especially for list items
4. **Handle scale changes** - Re-render when scale changes (for react-rnd)

### ❌ Don't

1. **Don't recreate roots** - Causes memory leaks
2. **Don't render before scale is set** - react-rnd breaks
3. **Don't forget to unmount** - Call `root.unmount()` in dispose()
4. **Don't use useState in overlay class** - Use class properties + props

## Related Documentation

- [Main Overview](./CANVAS-OVERLAY-PATTERN.md)
- [Architecture](./CANVAS-OVERLAY-ARCHITECTURE.md)
- [Mouse Events](./CANVAS-OVERLAY-EVENTS.md)
- [Coordinate Transforms](./CANVAS-OVERLAY-COORDINATES.md)
