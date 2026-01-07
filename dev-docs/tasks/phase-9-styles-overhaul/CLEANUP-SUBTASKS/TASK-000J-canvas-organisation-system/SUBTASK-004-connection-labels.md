# SUBTASK-004: Connection Labels

**Parent Task**: TASK-000J Canvas Organization System  
**Estimate**: 10-14 hours  
**Priority**: 4  
**Dependencies**: None (can be implemented independently)

---

## Overview

Allow users to add text labels to connection lines to document data flow. Labels sit on the bezier curve connecting nodes and can be repositioned along the path.

### The Problem

In complex node graphs:
- It's unclear what data flows through connections
- Users must trace connections to understand data types
- Documentation exists only in users' heads or external docs
- Similar-colored connections are indistinguishable

### The Solution

Add inline labels directly on connection lines:
- Labels describe what data flows through the connection
- Position labels anywhere along the curve
- Labels persist with the project
- Quick to add via hover icon

---

## Feature Capabilities

| Capability | Description |
|------------|-------------|
| **Hover to add** | Icon appears on connection hover for adding labels |
| **Inline editing** | Click icon to add label, type and confirm |
| **On-curve positioning** | Label sits directly on the bezier curve |
| **Draggable** | Slide label along the curve path |
| **Edit existing** | Click label to edit text |
| **Delete** | Clear text or use delete button |
| **Persistence** | Labels saved with project |

---

## Visual Design

### Connection with Label

```
                    ┌─────────┐
┌────────┐         │ user ID │
│ Source │─────────┴─────────┴──────────►│ Target │
└────────┘                                └────────┘
                    ▲
              Label on curve
```

### Label Styling

- **Background**: Semi-transparent, matches connection color
- **Text**: Small (10-11px), high contrast
- **Shape**: Rounded rectangle with padding
- **Border**: Optional subtle border

```css
.connection-label {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 3px;
  background-color: rgba(var(--connection-color), 0.8);
  color: white;
  white-space: nowrap;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

### Add Label Icon

When hovering a connection without a label:
```
           ┌───┐
     ──────│ + │──────►
           └───┘
              ↑
        Add label icon (appears on hover)
        Similar size/style to existing delete "X"
```

### Edit Mode

```
           ┌─────────────────┐
     ──────│ user ID█        │──────►
           └─────────────────┘
                    ↑
           Inline input field
           Cursor visible, typing active
```

---

## Technical Architecture

### Bezier Curve Math

Connections in Noodl use cubic bezier curves. Key formulas:

**Point on cubic bezier at parameter t (0-1):**
```
B(t) = (1-t)³P₀ + 3(1-t)²tP₁ + 3(1-t)t²P₂ + t³P₃
```

Where:
- P₀ = start point (output port position)
- P₁ = first control point
- P₂ = second control point
- P₃ = end point (input port position)
- t = parameter from 0 (start) to 1 (end)

**Tangent (direction) at parameter t:**
```
B'(t) = 3(1-t)²(P₁-P₀) + 6(1-t)t(P₂-P₁) + 3t²(P₃-P₂)
```

### Data Model Extension

```typescript
interface Connection {
  // Existing fields
  fromId: string;
  fromProperty: string;
  toId: string;
  toProperty: string;
  
  // New label field
  label?: ConnectionLabel;
}

interface ConnectionLabel {
  text: string;
  position: number;  // 0-1 along curve, default 0.5 (midpoint)
}
```

### Implementation Architecture

```
packages/noodl-editor/src/editor/src/
├── utils/
│   └── bezier.ts                    # Bezier math utilities
├── views/nodegrapheditor/
│   ├── NodeGraphEditorConnection.ts # Modified for label support
│   └── ConnectionLabel.ts           # Label rendering (new)
└── models/
    └── nodegraphmodel.ts            # Connection model extension
```

---

## Implementation Sessions

### Session 4.1: Bezier Utilities (2 hours)

**Goal**: Create utility functions for bezier curve calculations.

**Tasks**:
1. Create bezier utility module:
   ```typescript
   // packages/noodl-editor/src/editor/src/utils/bezier.ts
   
   export interface Point {
     x: number;
     y: number;
   }
   
   /**
    * Calculate point on cubic bezier curve at parameter t
    */
   export function getPointOnCubicBezier(
     t: number,
     p0: Point,
     p1: Point,
     p2: Point,
     p3: Point
   ): Point {
     const mt = 1 - t;
     const mt2 = mt * mt;
     const mt3 = mt2 * mt;
     const t2 = t * t;
     const t3 = t2 * t;
     
     return {
       x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
       y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y
     };
   }
   
   /**
    * Calculate tangent (direction vector) on cubic bezier at parameter t
    */
   export function getTangentOnCubicBezier(
     t: number,
     p0: Point,
     p1: Point,
     p2: Point,
     p3: Point
   ): Point {
     const mt = 1 - t;
     const mt2 = mt * mt;
     const t2 = t * t;
     
     // Derivative of bezier
     const dx = 3 * mt2 * (p1.x - p0.x) + 6 * mt * t * (p2.x - p1.x) + 3 * t2 * (p3.x - p2.x);
     const dy = 3 * mt2 * (p1.y - p0.y) + 6 * mt * t * (p2.y - p1.y) + 3 * t2 * (p3.y - p2.y);
     
     return { x: dx, y: dy };
   }
   
   /**
    * Find nearest t value on bezier curve to given point
    * Uses iterative refinement for accuracy
    */
   export function getNearestTOnCubicBezier(
     point: Point,
     p0: Point,
     p1: Point,
     p2: Point,
     p3: Point,
     iterations: number = 10
   ): number {
     // Initial coarse search
     let bestT = 0;
     let bestDist = Infinity;
     
     const steps = 20;
     for (let i = 0; i <= steps; i++) {
       const t = i / steps;
       const curvePoint = getPointOnCubicBezier(t, p0, p1, p2, p3);
       const dist = distance(point, curvePoint);
       
       if (dist < bestDist) {
         bestDist = dist;
         bestT = t;
       }
     }
     
     // Refine with binary search
     let low = Math.max(0, bestT - 1 / steps);
     let high = Math.min(1, bestT + 1 / steps);
     
     for (let i = 0; i < iterations; i++) {
       const midLow = (low + bestT) / 2;
       const midHigh = (bestT + high) / 2;
       
       const distLow = distance(point, getPointOnCubicBezier(midLow, p0, p1, p2, p3));
       const distHigh = distance(point, getPointOnCubicBezier(midHigh, p0, p1, p2, p3));
       
       if (distLow < distHigh) {
         high = bestT;
         bestT = midLow;
       } else {
         low = bestT;
         bestT = midHigh;
       }
     }
     
     return bestT;
   }
   
   function distance(a: Point, b: Point): number {
     const dx = a.x - b.x;
     const dy = a.y - b.y;
     return Math.sqrt(dx * dx + dy * dy);
   }
   
   /**
    * Calculate approximate arc length of bezier curve
    * Useful for even label spacing if multiple labels needed
    */
   export function getCubicBezierLength(
     p0: Point,
     p1: Point,
     p2: Point,
     p3: Point,
     steps: number = 100
   ): number {
     let length = 0;
     let prevPoint = p0;
     
     for (let i = 1; i <= steps; i++) {
       const t = i / steps;
       const point = getPointOnCubicBezier(t, p0, p1, p2, p3);
       length += distance(prevPoint, point);
       prevPoint = point;
     }
     
     return length;
   }
   ```
2. Write unit tests for bezier functions:
   ```typescript
   describe('bezier utils', () => {
     it('returns start point at t=0', () => {
       const p0 = { x: 0, y: 0 };
       const p1 = { x: 10, y: 0 };
       const p2 = { x: 20, y: 0 };
       const p3 = { x: 30, y: 0 };
       
       const result = getPointOnCubicBezier(0, p0, p1, p2, p3);
       expect(result.x).toBeCloseTo(0);
       expect(result.y).toBeCloseTo(0);
     });
     
     it('returns end point at t=1', () => {
       // ...
     });
     
     it('finds nearest t to point on curve', () => {
       // ...
     });
   });
   ```

**Files to create**:
- `packages/noodl-editor/src/editor/src/utils/bezier.ts`
- `packages/noodl-editor/src/editor/src/utils/bezier.test.ts`

**Success criteria**:
- [ ] `getPointOnCubicBezier` returns correct points
- [ ] `getNearestTOnCubicBezier` finds accurate t values
- [ ] All unit tests pass

---

### Session 4.2: Data Model Extension (1 hour)

**Goal**: Extend Connection model to support labels.

**Tasks**:
1. Add label interface to connection model:
   ```typescript
   // In nodegraphmodel.ts or connections.ts
   
   export interface ConnectionLabel {
     text: string;
     position: number; // 0-1, default 0.5
   }
   
   // Extend Connection interface
   export interface Connection {
     // ... existing fields
     label?: ConnectionLabel;
   }
   ```
2. Add methods to set/remove labels:
   ```typescript
   class NodeGraphModel {
     setConnectionLabel(
       fromId: string,
       fromProperty: string,
       toId: string,
       toProperty: string,
       label: ConnectionLabel | null
     ): void {
       const connection = this.findConnection(fromId, fromProperty, toId, toProperty);
       if (connection) {
         if (label) {
           connection.label = label;
         } else {
           delete connection.label;
         }
         this.notifyListeners('connectionChanged', { connection });
       }
     }
     
     updateConnectionLabelPosition(
       fromId: string,
       fromProperty: string,
       toId: string,
       toProperty: string,
       position: number
     ): void {
       const connection = this.findConnection(fromId, fromProperty, toId, toProperty);
       if (connection?.label) {
         connection.label.position = Math.max(0.1, Math.min(0.9, position));
         this.notifyListeners('connectionChanged', { connection });
       }
     }
   }
   ```
3. Ensure labels persist in project save/load (should work automatically if added to Connection)
4. Add undo support for label operations

**Files to modify**:
- `packages/noodl-editor/src/editor/src/models/nodegraphmodel.ts`

**Success criteria**:
- [ ] Label field added to Connection interface
- [ ] Set/remove label methods work
- [ ] Labels persist in saved project
- [ ] Undo works for label operations

---

### Session 4.3: Hover State and Add Icon (2-3 hours)

**Goal**: Show add-label icon when hovering a connection.

**Tasks**:
1. Add hover state to NodeGraphEditorConnection:
   ```typescript
   // In NodeGraphEditorConnection.ts
   
   export class NodeGraphEditorConnection {
     // ... existing fields
     public isHovered: boolean = false;
     private addIconBounds: { x: number; y: number; width: number; height: number } | null = null;
     
     setHovered(hovered: boolean): void {
       if (this.isHovered !== hovered) {
         this.isHovered = hovered;
         // Trigger repaint
       }
     }
   }
   ```
2. Implement connection hit-testing (may already exist):
   ```typescript
   isPointNearCurve(point: Point, threshold: number = 10): boolean {
     const { p0, p1, p2, p3 } = this.getControlPoints();
     const nearestT = getNearestTOnCubicBezier(point, p0, p1, p2, p3);
     const nearestPoint = getPointOnCubicBezier(nearestT, p0, p1, p2, p3);
     
     const dx = point.x - nearestPoint.x;
     const dy = point.y - nearestPoint.y;
     return Math.sqrt(dx * dx + dy * dy) <= threshold;
   }
   ```
3. Track hovered connection in nodegrapheditor:
   ```typescript
   // In mouse move handler
   private updateHoveredConnection(pos: Point): void {
     let newHovered: NodeGraphEditorConnection | null = null;
     
     for (const conn of this.connections) {
       if (conn.isPointNearCurve(pos)) {
         newHovered = conn;
         break;
       }
     }
     
     if (this.hoveredConnection !== newHovered) {
       this.hoveredConnection?.setHovered(false);
       this.hoveredConnection = newHovered;
       this.hoveredConnection?.setHovered(true);
       this.repaint();
     }
   }
   ```
4. Render add icon when hovered (and no existing label):
   ```typescript
   // In NodeGraphEditorConnection.paint()
   
   if (this.isHovered && !this.model.label) {
     const midpoint = this.getMidpoint();
     const iconSize = 16;
     
     // Draw icon background
     ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
     ctx.beginPath();
     ctx.arc(midpoint.x, midpoint.y, iconSize / 2 + 2, 0, Math.PI * 2);
     ctx.fill();
     
     // Draw + icon
     ctx.strokeStyle = '#666';
     ctx.lineWidth = 2;
     ctx.beginPath();
     ctx.moveTo(midpoint.x - 4, midpoint.y);
     ctx.lineTo(midpoint.x + 4, midpoint.y);
     ctx.moveTo(midpoint.x, midpoint.y - 4);
     ctx.lineTo(midpoint.x, midpoint.y + 4);
     ctx.stroke();
     
     // Store bounds for click detection
     this.addIconBounds = {
       x: midpoint.x - iconSize / 2,
       y: midpoint.y - iconSize / 2,
       width: iconSize,
       height: iconSize
     };
   }
   ```

**Files to modify**:
- `packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts`
- `packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts`

**Success criteria**:
- [ ] Hovering connection highlights it subtly
- [ ] Add icon appears at midpoint for connections without labels
- [ ] Icon styled consistently with existing delete icon
- [ ] Icon bounds stored for click detection

---

### Session 4.4: Inline Label Input (2-3 hours)

**Goal**: Show input field for adding/editing labels.

**Tasks**:
1. Create label input element (could be DOM overlay or canvas-based):
   ```typescript
   // DOM overlay approach (easier for text input)
   
   private showLabelInput(connection: NodeGraphEditorConnection, position: Point): void {
     // Create input element
     const input = document.createElement('input');
     input.type = 'text';
     input.className = 'connection-label-input';
     input.placeholder = 'Enter label...';
     
     // Position at connection point
     const canvasPos = this.nodeGraphCordsToScreenCoords(position);
     input.style.position = 'absolute';
     input.style.left = `${canvasPos.x}px`;
     input.style.top = `${canvasPos.y}px`;
     input.style.transform = 'translate(-50%, -50%)';
     
     // Pre-fill if editing existing label
     if (connection.model.label) {
       input.value = connection.model.label.text;
     }
     
     // Handle submission
     const submitLabel = () => {
       const text = input.value.trim();
       if (text) {
         const labelPosition = connection.model.label?.position ?? 0.5;
         this.model.setConnectionLabel(
           connection.model.fromId,
           connection.model.fromProperty,
           connection.model.toId,
           connection.model.toProperty,
           { text, position: labelPosition }
         );
       } else if (connection.model.label) {
         // Clear existing label if text is empty
         this.model.setConnectionLabel(
           connection.model.fromId,
           connection.model.fromProperty,
           connection.model.toId,
           connection.model.toProperty,
           null
         );
       }
       input.remove();
       this.activeInput = null;
     };
     
     input.addEventListener('keydown', (e) => {
       if (e.key === 'Enter') {
         submitLabel();
       } else if (e.key === 'Escape') {
         input.remove();
         this.activeInput = null;
       }
     });
     
     input.addEventListener('blur', submitLabel);
     
     // Add to DOM and focus
     this.el.appendChild(input);
     input.focus();
     input.select();
     this.activeInput = input;
   }
   ```
2. Style the input:
   ```css
   .connection-label-input {
     font-size: 11px;
     padding: 4px 8px;
     border: 1px solid var(--theme-color-primary);
     border-radius: 4px;
     background: var(--theme-color-bg-2);
     color: var(--theme-color-fg-highlight);
     outline: none;
     min-width: 80px;
     max-width: 150px;
     z-index: 1000;
   }
   
   .connection-label-input:focus {
     box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
   }
   ```
3. Handle click on add icon:
   ```typescript
   // In mouse click handler
   if (this.hoveredConnection?.addIconBounds) {
     const bounds = this.hoveredConnection.addIconBounds;
     if (
       pos.x >= bounds.x &&
       pos.x <= bounds.x + bounds.width &&
       pos.y >= bounds.y &&
       pos.y <= bounds.y + bounds.height
     ) {
       const midpoint = this.hoveredConnection.getMidpoint();
       this.showLabelInput(this.hoveredConnection, midpoint);
       return true; // Consume event
     }
   }
   ```
4. Add undo support for label creation

**Files to modify**:
- `packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts`
- `packages/noodl-editor/src/editor/src/assets/css/style.css` (or module scss)

**Success criteria**:
- [ ] Clicking add icon shows input field
- [ ] Input positioned at midpoint of connection
- [ ] Enter confirms and creates label
- [ ] Escape cancels without creating label
- [ ] Clicking outside (blur) confirms label
- [ ] Empty text removes existing label

---

### Session 4.5: Label Rendering (2 hours)

**Goal**: Render labels on connection curves.

**Tasks**:
1. Calculate label position on curve:
   ```typescript
   // In NodeGraphEditorConnection
   
   getLabelPosition(): Point | null {
     if (!this.model.label) return null;
     
     const { p0, p1, p2, p3 } = this.getControlPoints();
     return getPointOnCubicBezier(this.model.label.position, p0, p1, p2, p3);
   }
   ```
2. Render label in paint():
   ```typescript
   // In NodeGraphEditorConnection.paint()
   
   if (this.model.label) {
     const position = this.getLabelPosition();
     if (!position) return;
     
     const text = this.model.label.text;
     const padding = { x: 6, y: 3 };
     
     // Measure text
     ctx.font = '10px system-ui, sans-serif';
     const textMetrics = ctx.measureText(text);
     const textWidth = Math.min(textMetrics.width, 100); // Max width
     const textHeight = 12;
     
     // Calculate background bounds
     const bgWidth = textWidth + padding.x * 2;
     const bgHeight = textHeight + padding.y * 2;
     const bgX = position.x - bgWidth / 2;
     const bgY = position.y - bgHeight / 2;
     
     // Draw background
     ctx.fillStyle = this.getLabelBackgroundColor();
     ctx.beginPath();
     this.roundRect(ctx, bgX, bgY, bgWidth, bgHeight, 3);
     ctx.fill();
     
     // Draw text
     ctx.fillStyle = '#ffffff';
     ctx.textAlign = 'center';
     ctx.textBaseline = 'middle';
     ctx.fillText(text, position.x, position.y, 100); // Max width
     
     // Store bounds for interaction
     this.labelBounds = { x: bgX, y: bgY, width: bgWidth, height: bgHeight };
   }
   
   private getLabelBackgroundColor(): string {
     // Use connection color with some opacity
     const baseColor = this.getConnectionColor();
     // Convert to rgba with 0.85 opacity
     return `${baseColor}d9`; // Hex alpha
   }
   
   private roundRect(
     ctx: CanvasRenderingContext2D,
     x: number,
     y: number,
     width: number,
     height: number,
     radius: number
   ): void {
     ctx.moveTo(x + radius, y);
     ctx.lineTo(x + width - radius, y);
     ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
     ctx.lineTo(x + width, y + height - radius);
     ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
     ctx.lineTo(x + radius, y + height);
     ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
     ctx.lineTo(x, y + radius);
     ctx.quadraticCurveTo(x, y, x + radius, y);
   }
   ```
3. Handle text truncation for long labels
4. Ensure labels visible at different zoom levels

**Files to modify**:
- `packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts`

**Success criteria**:
- [ ] Label renders at correct position on curve
- [ ] Label styled with rounded background
- [ ] Label color matches connection color
- [ ] Long text truncated with ellipsis
- [ ] Label visible at reasonable zoom levels

---

### Session 4.6: Label Interaction (2-3 hours)

**Goal**: Enable editing, dragging, and deleting labels.

**Tasks**:
1. Detect click on label:
   ```typescript
   // In nodegrapheditor.ts mouse handler
   
   private getClickedLabel(pos: Point): NodeGraphEditorConnection | null {
     for (const conn of this.connections) {
       if (conn.labelBounds && conn.model.label) {
         const { x, y, width, height } = conn.labelBounds;
         if (pos.x >= x && pos.x <= x + width && pos.y >= y && pos.y <= y + height) {
           return conn;
         }
       }
     }
     return null;
   }
   ```
2. Handle click on label (edit):
   ```typescript
   // In mouse click handler
   const clickedLabelConn = this.getClickedLabel(pos);
   if (clickedLabelConn) {
     const labelPos = clickedLabelConn.getLabelPosition();
     if (labelPos) {
       this.showLabelInput(clickedLabelConn, labelPos);
       return true;
     }
   }
   ```
3. Implement label dragging:
   ```typescript
   // In mouse down handler
   const clickedLabelConn = this.getClickedLabel(pos);
   if (clickedLabelConn) {
     this.draggingLabel = clickedLabelConn;
     return true;
   }
   
   // In mouse move handler
   if (this.draggingLabel) {
     const { p0, p1, p2, p3 } = this.draggingLabel.getControlPoints();
     const newT = getNearestTOnCubicBezier(pos, p0, p1, p2, p3);
     
     // Constrain to avoid endpoints
     const constrainedT = Math.max(0.1, Math.min(0.9, newT));
     
     this.model.updateConnectionLabelPosition(
       this.draggingLabel.model.fromId,
       this.draggingLabel.model.fromProperty,
       this.draggingLabel.model.toId,
       this.draggingLabel.model.toProperty,
       constrainedT
     );
     
     this.repaint();
     return true;
   }
   
   // In mouse up handler
   if (this.draggingLabel) {
     this.draggingLabel = null;
   }
   ```
4. Add delete button on label hover:
   ```typescript
   // When label is hovered, show small X button
   if (this.hoveredLabel && conn === this.hoveredLabel) {
     const deleteX = labelBounds.x + labelBounds.width - 8;
     const deleteY = labelBounds.y;
     
     ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
     ctx.beginPath();
     ctx.arc(deleteX, deleteY, 6, 0, Math.PI * 2);
     ctx.fill();
     
     // Draw X
     ctx.strokeStyle = '#ffffff';
     ctx.lineWidth = 1.5;
     ctx.beginPath();
     ctx.moveTo(deleteX - 2, deleteY - 2);
     ctx.lineTo(deleteX + 2, deleteY + 2);
     ctx.moveTo(deleteX + 2, deleteY - 2);
     ctx.lineTo(deleteX - 2, deleteY + 2);
     ctx.stroke();
     
     this.labelDeleteBounds = { x: deleteX - 6, y: deleteY - 6, width: 12, height: 12 };
   }
   ```
5. Handle delete click:
   ```typescript
   if (this.labelDeleteBounds && this.hoveredLabel) {
     const { x, y, width, height } = this.labelDeleteBounds;
     if (pos.x >= x && pos.x <= x + width && pos.y >= y && pos.y <= y + height) {
       this.model.setConnectionLabel(
         this.hoveredLabel.model.fromId,
         this.hoveredLabel.model.fromProperty,
         this.hoveredLabel.model.toId,
         this.hoveredLabel.model.toProperty,
         null
       );
       return true;
     }
   }
   ```

**Files to modify**:
- `packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts`
- `packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts`

**Success criteria**:
- [ ] Clicking label opens edit input
- [ ] Dragging label moves it along curve
- [ ] Label constrained to 0.1-0.9 range (not at endpoints)
- [ ] Delete button appears on hover
- [ ] Clicking delete removes label
- [ ] Undo works for drag and delete

---

## Testing Checklist

### Adding Labels
- [ ] Hover connection → add icon appears at midpoint
- [ ] Click add icon → input appears
- [ ] Type text and press Enter → label created
- [ ] Type text and click outside → label created
- [ ] Press Escape → input cancelled, no label created
- [ ] Label renders on connection curve

### Editing Labels
- [ ] Click existing label → input appears with current text
- [ ] Edit text and confirm → label updated
- [ ] Clear text and confirm → label deleted

### Dragging Labels
- [ ] Click and drag label → moves along curve
- [ ] Label constrained to not overlap endpoints
- [ ] Position updates smoothly
- [ ] Release → position saved

### Deleting Labels
- [ ] Hover label → delete button appears
- [ ] Click delete button → label removed
- [ ] Alternative: clear text in edit mode → label removed

### Persistence
- [ ] Save project with labels → labels in saved file
- [ ] Load project → labels restored
- [ ] Label positions preserved

### Undo/Redo
- [ ] Undo label creation → label removed
- [ ] Redo → label restored
- [ ] Undo label edit → previous text restored
- [ ] Undo label delete → label restored
- [ ] Undo label drag → previous position restored

### Visual Quality
- [ ] Label readable at zoom 1.0
- [ ] Label readable at zoom 0.5
- [ ] Label hidden at very low zoom (optional)
- [ ] Label color matches connection color
- [ ] Long text truncated properly

### Edge Cases
- [ ] Delete node with labeled connection → label removed
- [ ] Connection with label is deleted → label removed
- [ ] Multiple labels (different connections) → all render correctly
- [ ] Label on curved connection → positioned on actual curve
- [ ] Label on very short connection → still usable

---

## Files Summary

### Create
```
packages/noodl-editor/src/editor/src/utils/bezier.ts
packages/noodl-editor/src/editor/src/utils/bezier.test.ts
```

### Modify
```
packages/noodl-editor/src/editor/src/models/nodegraphmodel.ts
packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts
packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts
packages/noodl-editor/src/editor/src/assets/css/style.css
```

---

## Performance Considerations

### Hit Testing

- Don't test all connections on every mouse move
- Use spatial partitioning or only test visible connections
- Cache connection bounds

```typescript
// Only test connections in viewport
const visibleConnections = this.connections.filter(conn => 
  conn.intersectsRect(this.getViewportBounds())
);
```

### Label Rendering

- Don't render labels that are off-screen
- Skip label rendering at very low zoom (labels unreadable anyway)

```typescript
// Skip labels at low zoom
if (this.getPanAndScale().scale < 0.4) {
  return; // Don't render labels
}
```

### Bezier Calculations

- Cache control points during drag
- Use lower iteration count for real-time dragging

```typescript
// Fast (lower accuracy) for dragging
const t = getNearestTOnCubicBezier(pos, p0, p1, p2, p3, 5);

// Accurate for final position
const t = getNearestTOnCubicBezier(pos, p0, p1, p2, p3, 15);
```

---

## Design Decisions

### Why One Label Per Connection?

Simplicity. Multiple labels would require:
- More complex UI for adding at specific positions
- Handling overlapping labels
- More complex data model

Single label covers 90% of use cases. Can extend later if needed.

### Why Not Label Rotation?

Labels aligned to curve tangent could be rotated to follow the curve direction. However:
- Rotated text is harder to read
- Horizontal text is conventional
- Implementation complexity not worth it

### Why Constrain Position to 0.1-0.9?

At exactly 0 or 1, labels would overlap with node ports. The constraint keeps labels in the "middle" of the connection where they're most readable and don't interfere with ports.

### Why DOM Input vs Canvas Input?

DOM input provides:
- Native text selection and editing
- Proper cursor behavior
- IME support for international input
- Accessibility

Canvas-based text input is significantly more complex to implement correctly.
