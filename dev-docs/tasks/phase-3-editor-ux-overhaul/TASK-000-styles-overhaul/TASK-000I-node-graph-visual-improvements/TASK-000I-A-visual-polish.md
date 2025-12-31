# TASK-000I-A: Node Graph Visual Polish

**Parent Task:** TASK-009I Node Graph Visual Improvements  
**Estimated Time:** 8-12 hours  
**Risk Level:** Low  
**Dependencies:** None

---

## Objective

Modernize the visual appearance of nodes on the canvas without changing functionality. This is a purely cosmetic update that improves the perceived quality and modernity of the editor.

---

## Scope

1. **Rounded corners** on all node rectangles
2. **Updated color palette** following design system
3. **Refined connection points** (port dots/arrows)
4. **Port label truncation** with ellipsis for overflow

### Out of Scope

- Node sizing changes
- Layout algorithm changes
- New functionality
- Port grouping (Sub-Task C)

---

## Implementation Phases

### Phase A1: Rounded Corners (2-3 hours)

#### Current Code

In `NodeGraphEditorNode.ts` paint() method:

```typescript
// Background - sharp corners
ctx.fillStyle = nc.header;
ctx.fillRect(x, y, this.nodeSize.width, this.nodeSize.height);

// Border - sharp corners
ctx.rect(x, y, this.nodeSize.width, this.nodeSize.height);
ctx.stroke();
```

#### New Approach

**Create helper file** `canvasHelpers.ts`:

```typescript
/**
 * Draw a rounded rectangle path
 * Uses native roundRect if available, falls back to arcTo
 */
export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number | { tl: number; tr: number; br: number; bl: number }
): void {
  const r = typeof radius === 'number' ? { tl: radius, tr: radius, br: radius, bl: radius } : radius;

  ctx.beginPath();
  ctx.moveTo(x + r.tl, y);
  ctx.lineTo(x + width - r.tr, y);
  ctx.arcTo(x + width, y, x + width, y + r.tr, r.tr);
  ctx.lineTo(x + width, y + height - r.br);
  ctx.arcTo(x + width, y + height, x + width - r.br, y + height, r.br);
  ctx.lineTo(x + r.bl, y + height);
  ctx.arcTo(x, y + height, x, y + height - r.bl, r.bl);
  ctx.lineTo(x, y + r.tl);
  ctx.arcTo(x, y, x + r.tl, y, r.tl);
  ctx.closePath();
}

/**
 * Fill a rounded rectangle
 */
export function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  roundRect(ctx, x, y, width, height, radius);
  ctx.fill();
}

/**
 * Stroke a rounded rectangle
 */
export function strokeRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  roundRect(ctx, x, y, width, height, radius);
  ctx.stroke();
}
```

#### Changes to NodeGraphEditorNode.ts

```typescript
import { fillRoundRect, strokeRoundRect } from './canvasHelpers';

// Constants
const NODE_CORNER_RADIUS = 6;

// In paint() method:

// Background - replace fillRect
ctx.fillStyle = nc.header;
fillRoundRect(ctx, x, y, this.nodeSize.width, this.nodeSize.height, NODE_CORNER_RADIUS);

// Body area - need to clip to rounded shape
ctx.save();
roundRect(ctx, x, y, this.nodeSize.width, this.nodeSize.height, NODE_CORNER_RADIUS);
ctx.clip();
ctx.fillStyle = nc.base;
ctx.fillRect(x, y + titlebarHeight, this.nodeSize.width, this.nodeSize.height - titlebarHeight);
ctx.restore();

// Selection border
if (this.selected || this.borderHighlighted) {
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  strokeRoundRect(ctx, x, y, this.nodeSize.width, this.nodeSize.height, NODE_CORNER_RADIUS);
}

// Error border
if (!health.healthy) {
  ctx.setLineDash([5]);
  ctx.strokeStyle = '#F57569';
  strokeRoundRect(ctx, x - 1, y - 1, this.nodeSize.width + 2, this.nodeSize.height + 2, NODE_CORNER_RADIUS + 1);
  ctx.setLineDash([]);
}
```

#### Locations to Update

1. **Node background** (~line 220)
2. **Node body fill** (~line 230)
3. **Highlight overlay** (~line 240)
4. **Selection border** (~line 290)
5. **Error/unhealthy border** (~line 280)
6. **Annotation borders** (~line 300)

#### Testing

- [ ] Nodes render with rounded corners at 100% zoom
- [ ] Corners visible at 50% zoom
- [ ] Corners not distorted at 150% zoom
- [ ] Selection highlight follows rounded shape
- [ ] Error dashed border follows rounded shape
- [ ] No visual artifacts at corner intersections

---

### Phase A2: Color Palette Update (2-3 hours)

#### File to Modify

`packages/noodl-core-ui/src/styles/custom-properties/colors.css`

#### Current vs Proposed

Document current values first, then update:

```css
/* ===== NODE COLORS ===== */

/* Data nodes - Green */
/* Current: muted olive */
/* Proposed: richer emerald */
--base-color-node-green-900: #052e16;
--base-color-node-green-700: #166534;
--base-color-node-green-600: #16a34a;
--base-color-node-green-500: #22c55e;

/* Visual nodes - Blue */
/* Current: muted blue */
/* Proposed: cleaner slate */
--base-color-node-blue-900: #0f172a;
--base-color-node-blue-700: #334155;
--base-color-node-blue-600: #475569;
--base-color-node-blue-500: #64748b;
--base-color-node-blue-400: #94a3b8;
--base-color-node-blue-300: #cbd5e1;
--base-color-node-blue-200: #e2e8f0;

/* Logic nodes - Grey */
/* Current: flat grey */
/* Proposed: warmer zinc */
--base-color-node-grey-900: #18181b;
--base-color-node-grey-700: #3f3f46;
--base-color-node-grey-600: #52525b;

/* Custom nodes - Pink */
/* Current: magenta */
/* Proposed: refined rose */
--base-color-node-pink-900: #4c0519;
--base-color-node-pink-700: #be123c;
--base-color-node-pink-600: #e11d48;

/* Component nodes - Purple */
/* Current: muted purple */
/* Proposed: cleaner violet */
--base-color-node-purple-900: #2e1065;
--base-color-node-purple-700: #6d28d9;
--base-color-node-purple-600: #7c3aed;
```

#### Process

1. **Document current** - Screenshot and hex values
2. **Design new palette** - Use design system principles
3. **Update CSS variables** - One category at a time
4. **Test contrast** - WCAG AA minimum (4.5:1 for text)
5. **Visual review** - Check all node types

#### Contrast Checking

Use browser dev tools or online checker:

- Header text on header background
- Port labels on body background
- Selection highlight visibility

#### Testing

- [ ] Data nodes (green) - legible, modern
- [ ] Visual nodes (blue) - legible, modern
- [ ] Logic nodes (grey) - legible, modern
- [ ] Custom nodes (pink) - legible, modern
- [ ] Component nodes (purple) - legible, modern
- [ ] All text passes contrast check
- [ ] Colors distinguish node types clearly

---

### Phase A3: Connection Point Styling (2-3 hours)

#### Current Implementation

In `NodeGraphEditorNode.ts` drawPlugs():

```typescript
function dot(side, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x + (side === 'left' ? 0 : _this.nodeSize.width), ty, 4, 0, 2 * Math.PI, false);
  ctx.fill();
}

function arrow(side, color) {
  const dx = side === 'left' ? 4 : -4;
  const cx = x + (side === 'left' ? 0 : _this.nodeSize.width);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - dx, ty - 4);
  ctx.lineTo(cx + dx, ty);
  ctx.lineTo(cx - dx, ty + 4);
  ctx.fill();
}
```

#### Improvements

```typescript
const PORT_RADIUS = 5; // Increased from 4
const PORT_INNER_RADIUS = 2;

function drawPort(side: 'left' | 'right', type: 'dot' | 'arrow', color: string, connected: boolean) {
  const cx = x + (side === 'left' ? 0 : _this.nodeSize.width);

  ctx.save();

  if (type === 'dot') {
    // Outer circle
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, ty, PORT_RADIUS, 0, 2 * Math.PI);
    ctx.fill();

    // Inner highlight (connected state)
    if (connected) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(cx, ty, PORT_INNER_RADIUS, 0, 2 * Math.PI);
      ctx.fill();
    }
  } else {
    // Arrow (signal)
    const dx = side === 'left' ? PORT_RADIUS : -PORT_RADIUS;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx - dx, ty - PORT_RADIUS);
    ctx.lineTo(cx + dx, ty);
    ctx.lineTo(cx - dx, ty + PORT_RADIUS);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}
```

#### Testing

- [ ] Port dots larger and easier to click
- [ ] Connected ports have visual distinction
- [ ] Arrows properly sized
- [ ] Hit detection still works
- [ ] Dragging connections works
- [ ] Hover states visible

---

### Phase A4: Port Label Truncation (2-3 hours)

#### Problem

Long port names overflow the node boundary, appearing outside the node rectangle.

#### Solution

**Add to canvasHelpers.ts:**

```typescript
/**
 * Truncate text to fit within maxWidth, adding ellipsis if needed
 */
export function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }

  const ellipsis = '…';
  let truncated = text;

  while (truncated.length > 0) {
    truncated = truncated.slice(0, -1);
    if (ctx.measureText(truncated + ellipsis).width <= maxWidth) {
      return truncated + ellipsis;
    }
  }

  return ellipsis;
}
```

#### Integration in drawPlugs()

```typescript
// Calculate available width for label
const labelMaxWidth =
  side === 'left'
    ? _this.nodeSize.width / 2 - horizontalSpacing - PORT_RADIUS
    : _this.nodeSize.width / 2 - horizontalSpacing - PORT_RADIUS;

// Truncate if needed
const displayName = truncateText(ctx, p.displayName || p.property, labelMaxWidth);
ctx.fillText(displayName, tx, ty);

// Store full name for tooltip
p.fullDisplayName = p.displayName || p.property;
```

#### Tooltip Integration

Verify existing tooltip system shows full port name on hover. If not working:

```typescript
// In handleMouseEvent, on port hover:
if (p.fullDisplayName !== displayName) {
  PopupLayer.instance.showTooltip({
    content: p.fullDisplayName,
    position: { x: mouseX, y: mouseY }
  });
}
```

#### Testing

- [ ] Long labels truncate with ellipsis
- [ ] Short labels unchanged
- [ ] Truncation respects node width
- [ ] Tooltip shows full name on hover
- [ ] Left and right aligned labels both work
- [ ] No text overflow outside node bounds

---

## Files to Create

```
packages/noodl-editor/src/editor/src/views/nodegrapheditor/
└── canvasHelpers.ts    # Utility functions
```

## Files to Modify

```
packages/noodl-editor/src/editor/src/views/nodegrapheditor/
└── NodeGraphEditorNode.ts    # Main rendering changes

packages/noodl-core-ui/src/styles/custom-properties/
└── colors.css                # Color palette updates
```

---

## Testing Checklist

### Visual Verification

- [ ] Open existing project with many node types
- [ ] All nodes render with rounded corners
- [ ] Colors updated and consistent
- [ ] Port indicators refined
- [ ] Labels truncate properly

### Functional Verification

- [ ] Node selection works
- [ ] Connection dragging works
- [ ] Copy/paste works
- [ ] Undo/redo works
- [ ] Zoom in/out renders correctly

### Performance

- [ ] No noticeable slowdown
- [ ] Smooth panning with 50+ nodes
- [ ] Profile render time if concerned

---

## Success Criteria

- [ ] All nodes have rounded corners (6px radius)
- [ ] Color palette modernized
- [ ] Port indicators larger and cleaner
- [ ] Long labels truncate with ellipsis
- [ ] Full port name visible on hover
- [ ] No visual regressions
- [ ] No functional regressions
- [ ] Performance unchanged

---

## Rollback Plan

If issues arise:

1. Revert `NodeGraphEditorNode.ts` changes
2. Revert `colors.css` changes
3. Delete `canvasHelpers.ts`

All changes are isolated to rendering code with no data model changes.
