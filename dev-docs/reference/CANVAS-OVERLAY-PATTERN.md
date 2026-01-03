# Canvas Overlay Pattern

## Overview

**Status:** ✅ Proven Pattern (CommentLayer is production-ready)  
**Location:** `packages/noodl-editor/src/editor/src/views/commentlayer.ts`  
**Created:** Phase 4 PREREQ-003

This document describes the pattern for creating React overlays that float above the HTML5 Canvas in the Node Graph Editor. The pattern is proven and production-tested via CommentLayer.

## What This Pattern Enables

React components that:

- Float over the HTML5 Canvas
- Stay synchronized with canvas pan/zoom
- Handle mouse events intelligently (overlay vs canvas)
- Integrate with the existing EventDispatcher system
- Use modern React 19 APIs

## Why This Matters

Phase 4 visualization views need this pattern:

- **VIEW-005: Data Lineage** - Glowing path highlights
- **VIEW-006: Impact Radar** - Dependency visualization
- **VIEW-007: Semantic Layers** - Node visibility filtering

All of these require React UI floating over the canvas with proper coordinate transformation and event handling.

## Documentation Structure

This pattern is documented across several focused files:

1. **[Architecture Overview](./CANVAS-OVERLAY-ARCHITECTURE.md)** - How overlays integrate with NodeGraphEditor
2. **[Coordinate Transforms](./CANVAS-OVERLAY-COORDINATES.md)** - Canvas space ↔ Screen space conversion
3. **[Mouse Event Handling](./CANVAS-OVERLAY-EVENTS.md)** - Intelligent event routing
4. **[React Integration](./CANVAS-OVERLAY-REACT.md)** - React 19 patterns and lifecycle
5. **[Code Examples](./CANVAS-OVERLAY-EXAMPLES.md)** - Practical implementation examples

## Quick Start

### Minimal Overlay Example

```typescript
import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { NodeGraphEditor } from './nodegrapheditor';

class SimpleOverlay {
  private root: Root;
  private container: HTMLDivElement;

  constructor(private nodegraphEditor: NodeGraphEditor) {}

  renderTo(container: HTMLDivElement) {
    this.container = container;
    this.root = createRoot(container);
    this.render();
  }

  setPanAndScale(panAndScale: { x: number; y: number; scale: number }) {
    const transform = `scale(${panAndScale.scale}) translate(${panAndScale.x}px, ${panAndScale.y}px)`;
    this.container.style.transform = transform;
  }

  private render() {
    this.root.render(<div>My Overlay Content</div>);
  }

  dispose() {
    if (this.root) {
      this.root.unmount();
    }
  }
}
```

### Integration with NodeGraphEditor

```typescript
// In nodegrapheditor.ts
this.myOverlay = new SimpleOverlay(this);
this.myOverlay.renderTo(overlayDiv);

// Update on pan/zoom
this.myOverlay.setPanAndScale(this.getPanAndScale());
```

## Key Insights from CommentLayer

### 1. CSS Transform Strategy (Brilliant!)

The entire overlay stays in sync via a single CSS transform on the container:

```typescript
const transform = `scale(${scale}) translate(${x}px, ${y}px)`;
container.style.transform = transform;
```

No complex calculations per element - the browser handles it all!

### 2. React Root Reuse

Create roots once, reuse for all re-renders:

```typescript
if (!this.root) {
  this.root = createRoot(this.container);
}
this.root.render(<MyComponent {...props} />);
```

### 3. Two-Layer System

CommentLayer uses two layers:

- **Background layer** - Behind canvas (e.g., colored comment boxes)
- **Foreground layer** - In front of canvas (e.g., comment controls, resize handles)

This allows visual layering: comments behind nodes, but controls in front.

### 4. Mouse Event Forwarding

Complex but powerful: overlay determines if clicks should go to canvas or stay in overlay. See [Mouse Event Handling](./CANVAS-OVERLAY-EVENTS.md) for details.

## Common Gotchas

### ❌ Don't: Create new roots on every render

```typescript
// BAD - memory leak!
render() {
  this.root = createRoot(this.container);
  this.root.render(<Component />);
}
```

### ✅ Do: Create once, reuse

```typescript
// GOOD
constructor() {
  this.root = createRoot(this.container);
}
render() {
  this.root.render(<Component />);
}
```

### ❌ Don't: Manually calculate positions for every element

```typescript
// BAD - complex and slow
elements.forEach((el) => {
  el.style.left = (el.x + pan.x) * scale + 'px';
  el.style.top = (el.y + pan.y) * scale + 'px';
});
```

### ✅ Do: Use container transform

```typescript
// GOOD - browser handles it
container.style.transform = `scale(${scale}) translate(${pan.x}px, ${pan.y}px)`;
```

## Next Steps

- Read [Architecture Overview](./CANVAS-OVERLAY-ARCHITECTURE.md) to understand integration
- Review [CommentLayer source](../../packages/noodl-editor/src/editor/src/views/commentlayer.ts) for full example
- Check [Code Examples](./CANVAS-OVERLAY-EXAMPLES.md) for specific patterns

## Related Documentation

- [CommentLayer Implementation Analysis](./LEARNINGS.md#canvas-overlay-pattern)
- [Phase 4 Prerequisites](../tasks/phase-4-canvas-visualisation-views/PREREQ-003-canvas-overlay-pattern/)
- [NodeGraphEditor Integration](./CODEBASE-MAP.md#node-graph-editor)
