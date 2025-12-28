# PREREQ-003: Document Canvas Overlay Pattern

## Overview

**Priority:** HIGH  
**Estimate:** 1-2 days  
**Status:** Not started  
**Blocked by:** PREREQ-001 (Webpack caching)  
**Can parallelize with:** PREREQ-002

---

## The Good News

**CommentLayer already works as a React overlay on the canvas!**

This proves the overlay pattern is viable. This task is about:
1. Understanding how CommentLayer works
2. Documenting the pattern
3. Creating reusable infrastructure for other overlays

---

## What CommentLayer Does

CommentLayer renders React components that:
- Float over the HTML5 Canvas
- Respond to pan/zoom (stay in correct position)
- Integrate with selection system
- Support user interaction (click, drag)

This is exactly what we need for:
- VIEW-005: Data Lineage (path highlighting + panel)
- VIEW-006: Impact Radar (dependency highlighting + panel)
- VIEW-007: Semantic Layers (node visibility filtering)

---

## Investigation Tasks

### 1. Study CommentLayer Implementation

**File:** `packages/noodl-editor/src/editor/src/views/nodegrapheditor/commentlayer.ts`

Document:
- How it creates the overlay container
- How it subscribes to pan/zoom changes
- How it transforms coordinates between canvas space and screen space
- How it handles React rendering lifecycle

### 2. Identify Integration Points

Find where CommentLayer connects to:
- NodeGraphEditor (the main canvas class)
- Pan/zoom events
- Selection events
- Mouse events

### 3. Extract Reusable Patterns

Create shared utilities that any overlay can use:
- Coordinate transformation
- Pan/zoom subscription
- Overlay container management

---

## Expected Findings

### Coordinate Transformation

The canvas has its own coordinate system. Overlays need to convert between:
- **Canvas coordinates** - Position in the node graph space
- **Screen coordinates** - Position on the user's screen

```typescript
// Expected pattern (to verify):
function canvasToScreen(point: Point, viewport: Viewport): Point {
  return {
    x: (point.x + viewport.pan.x) * viewport.scale,
    y: (point.y + viewport.pan.y) * viewport.scale
  };
}

function screenToCanvas(point: Point, viewport: Viewport): Point {
  return {
    x: point.x / viewport.scale - viewport.pan.x,
    y: point.y / viewport.scale - viewport.pan.y
  };
}
```

### Pan/Zoom Subscription

The overlay needs to re-render when viewport changes:

```typescript
// Expected pattern (to verify):
nodeGraphEditor.on('viewportChanged', ({ pan, scale }) => {
  this.updateOverlayPositions(pan, scale);
});
```

### React Rendering

The overlay renders React over the canvas:

```typescript
// Expected pattern (to verify):
class CanvasOverlay {
  private container: HTMLDivElement;
  private root: Root;
  
  constructor(parentElement: HTMLElement) {
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;  // Allow clicks through to canvas
    `;
    parentElement.appendChild(this.container);
    this.root = createRoot(this.container);
  }
  
  render(props: OverlayProps) {
    this.root.render(<OverlayComponent {...props} />);
  }
}
```

---

## Deliverables

### 1. Documentation

Create `CANVAS-OVERLAY-PATTERN.md` documenting:
- How CommentLayer works
- The coordinate transformation system
- The event subscription pattern
- Common gotchas and solutions

### 2. Shared Infrastructure

Create reusable overlay utilities:

```typescript
// packages/noodl-editor/src/editor/src/views/CanvasOverlays/

// CanvasOverlayBase.ts - Base class for overlays
export abstract class CanvasOverlayBase {
  protected viewport: Viewport;
  protected root: Root;
  
  abstract render(): void;
  
  protected canvasToScreen(point: Point): Point;
  protected screenToCanvas(point: Point): Point;
  protected subscribeToViewport(callback: ViewportCallback): Unsubscribe;
}

// OverlayContainer.tsx - React component for overlay positioning
export function OverlayContainer({ 
  children, 
  viewport 
}: OverlayContainerProps): JSX.Element;

// useViewportTransform.ts - Hook for overlays
export function useViewportTransform(): {
  pan: Point;
  scale: number;
  canvasToScreen: (point: Point) => Point;
  screenToCanvas: (point: Point) => Point;
};
```

### 3. Example Implementation

Create a minimal test overlay that:
- Renders a simple React component over the canvas
- Updates position correctly on pan/zoom
- Handles click events properly

---

## Implementation Steps

### Phase 1: Study (4-6 hours)

1. Read through `commentlayer.ts` thoroughly
2. Add comments explaining each section
3. Trace the data flow from canvas events to React render
4. Identify all integration points

### Phase 2: Document (2-4 hours)

1. Write `CANVAS-OVERLAY-PATTERN.md`
2. Include code examples
3. Document gotchas discovered

### Phase 3: Extract Utilities (4-6 hours)

1. Create `CanvasOverlays/` directory
2. Extract coordinate transformation utilities
3. Create base class or hooks for overlays
4. Write tests for utilities

### Phase 4: Verify (2 hours)

1. Create minimal test overlay
2. Verify it works with pan/zoom
3. Verify click handling works

---

## Files to Study

```
packages/noodl-editor/src/editor/src/views/nodegrapheditor/
├── commentlayer.ts              # Main overlay implementation
├── CommentLayer/
│   ├── CommentLayerView.tsx     # React component
│   ├── CommentForeground.tsx
│   └── CommentBackground.tsx
└── nodegrapheditor.ts           # Integration point
```

---

## Success Criteria

1. CommentLayer pattern fully documented
2. Coordinate transformation utilities created and tested
3. Base overlay class/hooks created
4. Test overlay works correctly with pan/zoom
5. Documentation sufficient for implementing VIEW-005, 006, 007
