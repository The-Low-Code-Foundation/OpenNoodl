# SUBTASK-003: Vertical Snap + Push

**Parent Task**: TASK-000J Canvas Organization System  
**Estimate**: 12-16 hours  
**Priority**: 3  
**Dependencies**: None (can be implemented independently)

---

## Overview

A system for vertically aligning and attaching nodes so that when one expands, nodes below it automatically push down, maintaining spacing and preventing overlap.

### The Problem

When nodes expand vertically (due to new ports being added):
- They overlap nodes below them
- Carefully arranged vertical stacks become messy
- Users must manually reposition nodes after every change
- The "flow" of logic gets disrupted

### The Solution

Allow users to **vertically attach** nodes into stacks:
- Attached nodes maintain spacing when moved
- When a node expands, nodes below push down automatically
- Visual feedback shows when nodes can be attached
- Easy to detach when needed

### Why Vertical Only?

Horizontal attachment would interfere with connection lines:
- Connections flow left-to-right (outputs → inputs)
- Nodes need horizontal spacing for connection visibility
- Horizontal "snapping" would cover connection endpoints

Vertical stacking works naturally because:
- Many parallel logic paths are arranged vertically
- Vertical expansion is the main layout-breaking problem
- Doesn't interfere with connection rendering

---

## Feature Capabilities

| Capability | Description |
|------------|-------------|
| **Edge proximity detection** | Visual feedback when dragging near attachable edges |
| **Attachment creation** | Drop on highlighted edge to attach |
| **Push on expand** | When node grows, attached nodes below shift down |
| **Chain insertion** | Drop between attached nodes to insert into chain |
| **Detachment** | Context menu option to remove from stack |
| **Alignment guides** | Visual guides when edges align (even without attachment) |

---

## Visual Design

### Attachment Visualization

**Proximity Detection (during drag):**
```
┌────────────┐
│   Node A   │
└────────────┘  ← bottom edge glows when Node X is near
      
   [Node X]     ← being dragged
      
┌────────────┐
│   Node B   │  ← top edge glows when Node X is near
└────────────┘
```

**Attached State:**
```
┌────────────┐
│   Node A   │
└────────────┘
      ┃         ← subtle vertical line indicating attachment
      ┃
┌────────────┐
│   Node B   │
└────────────┘
      ┃
      ┃
┌────────────┐
│   Node C   │
└────────────┘
```

**Push Behavior:**
```
Before:                    After Node A expands:
┌────────────┐             ┌────────────┐
│   Node A   │             │   Node A   │
└────────────┘             │  (grew)    │
      ┃                    │            │
┌────────────┐             └────────────┘
│   Node B   │                   ┃
└────────────┘             ┌────────────┐
      ┃                    │   Node B   │  ← pushed down
┌────────────┐             └────────────┘
│   Node C   │                   ┃
└────────────┘             ┌────────────┐
                           │   Node C   │  ← also pushed down
                           └────────────┘
```

### Edge Highlight Style

- **Glow effect**: Box shadow or gradient
- **Color**: Accent color (e.g., blue #3b82f6) at 50% opacity
- **Width**: Extends slightly beyond node edges
- **Height**: ~4px

```css
.edge-highlight-bottom {
  position: absolute;
  bottom: -2px;
  left: -4px;
  right: -4px;
  height: 4px;
  background: linear-gradient(to bottom, rgba(59, 130, 246, 0.5), transparent);
  border-radius: 2px;
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.6);
}
```

### Alignment Guide Style

- **Color**: Light gray or accent color at 30% opacity
- **Style**: Dashed line
- **Extends**: Full canvas width (or reasonable extent)

---

## Data Model

### Attachment Storage

```typescript
interface VerticalAttachment {
  id: string;           // Unique attachment ID
  topNodeId: string;    // Node on top
  bottomNodeId: string; // Node on bottom
  spacing: number;      // Pixel gap between nodes
}

// Storage options:

// Option A: Separate AttachmentsModel
class AttachmentsModel {
  private attachments: Map<string, VerticalAttachment>;
  
  createAttachment(topId: string, bottomId: string, spacing: number): void;
  removeAttachment(attachmentId: string): void;
  getAttachedBelow(nodeId: string): string | null;
  getAttachedAbove(nodeId: string): string | null;
  getAttachmentChain(nodeId: string): string[];
  getAttachmentBetween(topId: string, bottomId: string): VerticalAttachment | null;
}

// Option B: Store on NodeGraphNode model
interface NodeGraphNode {
  // ... existing fields
  attachedAbove?: string;  // ID of node this is attached below
  attachedBelow?: string;  // ID of node attached below this
  attachmentSpacing?: number;
}
```

**Recommendation**: Use Option A (separate AttachmentsModel) for cleaner separation of concerns and easier debugging.

### Persistence

Attachments should persist with the project:
```typescript
// In component save/load
{
  "nodes": [...],
  "connections": [...],
  "comments": [...],
  "attachments": [
    { "id": "att_1", "topNodeId": "node_a", "bottomNodeId": "node_b", "spacing": 20 },
    { "id": "att_2", "topNodeId": "node_b", "bottomNodeId": "node_c", "spacing": 20 }
  ]
}
```

---

## Implementation Sessions

### Session 3.1: Attachment Data Model (2 hours)

**Goal**: Create AttachmentsModel and wire up persistence.

**Tasks**:
1. Create `AttachmentsModel` class:
   ```typescript
   // packages/noodl-editor/src/editor/src/models/attachmentsmodel.ts
   
   import { EventEmitter } from '@noodl-utils/eventemitter';
   
   interface VerticalAttachment {
     id: string;
     topNodeId: string;
     bottomNodeId: string;
     spacing: number;
   }
   
   export class AttachmentsModel extends EventEmitter {
     private attachments: Map<string, VerticalAttachment> = new Map();
     
     createAttachment(topId: string, bottomId: string, spacing: number): VerticalAttachment {
       // Check for circular dependencies
       if (this.wouldCreateCycle(topId, bottomId)) {
         throw new Error('Cannot create circular attachment');
       }
       
       const id = `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
       const attachment: VerticalAttachment = { id, topNodeId: topId, bottomNodeId: bottomId, spacing };
       
       this.attachments.set(id, attachment);
       this.emit('attachmentCreated', attachment);
       return attachment;
     }
     
     removeAttachment(attachmentId: string): void {
       const attachment = this.attachments.get(attachmentId);
       if (attachment) {
         this.attachments.delete(attachmentId);
         this.emit('attachmentRemoved', attachment);
       }
     }
     
     getAttachedBelow(nodeId: string): string | null {
       for (const att of this.attachments.values()) {
         if (att.topNodeId === nodeId) return att.bottomNodeId;
       }
       return null;
     }
     
     getAttachedAbove(nodeId: string): string | null {
       for (const att of this.attachments.values()) {
         if (att.bottomNodeId === nodeId) return att.topNodeId;
       }
       return null;
     }
     
     getAttachmentChain(nodeId: string): string[] {
       const chain: string[] = [];
       
       // Go up to find the top
       let current = nodeId;
       while (this.getAttachedAbove(current)) {
         current = this.getAttachedAbove(current)!;
       }
       
       // Now go down to build the chain
       chain.push(current);
       while (this.getAttachedBelow(current)) {
         current = this.getAttachedBelow(current)!;
         chain.push(current);
       }
       
       return chain;
     }
     
     private wouldCreateCycle(topId: string, bottomId: string): boolean {
       // Check if bottomId is already above topId in any chain
       let current = topId;
       while (this.getAttachedAbove(current)) {
         current = this.getAttachedAbove(current)!;
         if (current === bottomId) return true;
       }
       return false;
     }
     
     // Serialization
     toJSON(): VerticalAttachment[] {
       return Array.from(this.attachments.values());
     }
     
     fromJSON(data: VerticalAttachment[]): void {
       this.attachments.clear();
       for (const att of data) {
         this.attachments.set(att.id, att);
       }
     }
   }
   ```
2. Integrate with NodeGraphModel for persistence
3. Write unit tests for chain detection and cycle prevention

**Files to create**:
- `packages/noodl-editor/src/editor/src/models/attachmentsmodel.ts`

**Files to modify**:
- `packages/noodl-editor/src/editor/src/models/nodegraphmodel.ts` (add attachments to save/load)

**Success criteria**:
- [ ] AttachmentsModel class implemented
- [ ] Cycle detection works
- [ ] Chain traversal works
- [ ] Attachments persist with project

---

### Session 3.2: Edge Proximity Detection (2-3 hours)

**Goal**: Detect when a dragged node is near another node's top or bottom edge.

**Tasks**:
1. Define proximity threshold constant:
   ```typescript
   const ATTACHMENT_THRESHOLD = 20; // pixels
   ```
2. In `nodegrapheditor.ts`, during node drag:
   ```typescript
   private detectEdgeProximity(draggingNode: NodeGraphEditorNode): EdgeProximity | null {
     const dragBounds = {
       x: draggingNode.global.x,
       y: draggingNode.global.y,
       width: draggingNode.nodeSize.width,
       height: draggingNode.nodeSize.height
     };
     
     let closest: EdgeProximity | null = null;
     let closestDistance = ATTACHMENT_THRESHOLD;
     
     this.forEachNode((node) => {
       if (node === draggingNode) return;
       
       const nodeBounds = {
         x: node.global.x,
         y: node.global.y,
         width: node.nodeSize.width,
         height: node.nodeSize.height
       };
       
       // Check horizontal overlap (nodes should be roughly aligned)
       const horizontalOverlap = 
         dragBounds.x < nodeBounds.x + nodeBounds.width &&
         dragBounds.x + dragBounds.width > nodeBounds.x;
       
       if (!horizontalOverlap) return;
       
       // Check distance from dragging node's bottom to target's top
       const distToTop = Math.abs(
         (dragBounds.y + dragBounds.height) - nodeBounds.y
       );
       
       if (distToTop < closestDistance) {
         closestDistance = distToTop;
         closest = {
           targetNode: node,
           edge: 'top',
           distance: distToTop
         };
       }
       
       // Check distance from dragging node's top to target's bottom
       const distToBottom = Math.abs(
         dragBounds.y - (nodeBounds.y + nodeBounds.height)
       );
       
       if (distToBottom < closestDistance) {
         closestDistance = distToBottom;
         closest = {
           targetNode: node,
           edge: 'bottom',
           distance: distToBottom
         };
       }
     });
     
     return closest;
   }
   ```
3. Track proximity state during drag:
   ```typescript
   private currentProximity: EdgeProximity | null = null;
   
   // In drag move handler
   this.currentProximity = this.detectEdgeProximity(draggingNode);
   this.repaint(); // Trigger repaint to show highlight
   ```
4. Clear proximity on drag end

**Files to modify**:
- `packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts`

**Success criteria**:
- [ ] Proximity detected when node near top edge
- [ ] Proximity detected when node near bottom edge
- [ ] Only detects when nodes horizontally overlap
- [ ] Nearest edge prioritized if multiple options

---

### Session 3.3: Visual Feedback (2 hours)

**Goal**: Show visual glow on edges that can be attached to.

**Tasks**:
1. Add highlighted edge state to NodeGraphEditorNode:
   ```typescript
   // In NodeGraphEditorNode.ts
   public highlightedEdge: 'top' | 'bottom' | null = null;
   ```
2. Modify paint() to render highlight:
   ```typescript
   paint(ctx: CanvasRenderingContext2D, paintRect: Rect) {
     // ... existing paint code
     
     // Draw edge highlight if active
     if (this.highlightedEdge) {
       ctx.save();
       
       const highlightColor = 'rgba(59, 130, 246, 0.5)';
       const glowColor = 'rgba(59, 130, 246, 0.3)';
       const highlightHeight = 4;
       const extend = 4; // Extend beyond node edges
       
       if (this.highlightedEdge === 'bottom') {
         const y = this.global.y + this.nodeSize.height;
         
         // Glow
         ctx.shadowColor = glowColor;
         ctx.shadowBlur = 8;
         ctx.shadowOffsetY = 2;
         
         // Highlight bar
         ctx.fillStyle = highlightColor;
         ctx.fillRect(
           this.global.x - extend,
           y - 2,
           this.nodeSize.width + extend * 2,
           highlightHeight
         );
       } else if (this.highlightedEdge === 'top') {
         const y = this.global.y;
         
         ctx.shadowColor = glowColor;
         ctx.shadowBlur = 8;
         ctx.shadowOffsetY = -2;
         
         ctx.fillStyle = highlightColor;
         ctx.fillRect(
           this.global.x - extend,
           y - highlightHeight + 2,
           this.nodeSize.width + extend * 2,
           highlightHeight
         );
       }
       
       ctx.restore();
     }
     
     // Continue with rest of painting...
   }
   ```
3. Update highlights based on proximity during drag:
   ```typescript
   // In nodegrapheditor.ts drag handler
   // Clear previous highlights
   this.forEachNode((node) => {
     node.highlightedEdge = null;
   });
   
   // Set new highlight
   if (this.currentProximity) {
     const { targetNode, edge } = this.currentProximity;
     targetNode.highlightedEdge = edge;
   }
   ```
4. Clear all highlights on drag end

**Files to modify**:
- `packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNode.ts`
- `packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts`

**Success criteria**:
- [ ] Bottom edge glows when dragging node above
- [ ] Top edge glows when dragging node below
- [ ] Glow has nice shadow/blur effect
- [ ] Highlights clear after drag

---

### Session 3.4: Attachment Creation (2-3 hours)

**Goal**: Create attachments when dropping on highlighted edges.

**Tasks**:
1. On drag end, check for active proximity:
   ```typescript
   // In drag end handler
   if (this.currentProximity) {
     const { targetNode, edge } = this.currentProximity;
     const draggingNode = this.draggingNodes[0]; // Assuming single node drag
     
     // Determine top and bottom based on edge
     let topNodeId: string, bottomNodeId: string;
     if (edge === 'top') {
       // Dragging node is above target
       topNodeId = draggingNode.model.id;
       bottomNodeId = targetNode.model.id;
     } else {
       // Dragging node is below target
       topNodeId = targetNode.model.id;
       bottomNodeId = draggingNode.model.id;
     }
     
     // Calculate spacing
     const topNode = edge === 'top' ? draggingNode : targetNode;
     const bottomNode = edge === 'top' ? targetNode : draggingNode;
     const spacing = bottomNode.global.y - (topNode.global.y + topNode.nodeSize.height);
     
     // Create attachment
     this.attachmentsModel.createAttachment(topNodeId, bottomNodeId, Math.max(spacing, 10));
     
     // Snap node to exact position
     this.snapToAttachment(draggingNode, topNodeId, bottomNodeId);
   }
   ```
2. Handle insertion between existing attached nodes:
   ```typescript
   private handleChainInsertion(
     draggingNode: NodeGraphEditorNode,
     targetNode: NodeGraphEditorNode,
     edge: 'top' | 'bottom'
   ): void {
     if (edge === 'top') {
       // Check if target has something attached above
       const aboveId = this.attachmentsModel.getAttachedAbove(targetNode.model.id);
       if (aboveId) {
         // Remove existing attachment
         const existingAtt = this.attachmentsModel.getAttachmentBetween(aboveId, targetNode.model.id);
         if (existingAtt) {
           this.attachmentsModel.removeAttachment(existingAtt.id);
         }
         
         // Insert new node: above -> dragging -> target
         this.attachmentsModel.createAttachment(aboveId, draggingNode.model.id, existingAtt?.spacing || 20);
       }
       
       // Attach dragging to target
       this.attachmentsModel.createAttachment(draggingNode.model.id, targetNode.model.id, 20);
     }
     // Similar logic for 'bottom' edge...
   }
   ```
3. Add undo support for attachment creation
4. Show visual confirmation (brief flash or toast)

**Files to modify**:
- `packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts`

**Success criteria**:
- [ ] Dropping on highlighted edge creates attachment
- [ ] Correct top/bottom assignment based on edge
- [ ] Spacing calculated from actual positions
- [ ] Insertion between attached nodes works
- [ ] Undo removes attachment

---

### Session 3.5: Push Calculation (2-3 hours)

**Goal**: When a node resizes, push attached nodes down.

**Tasks**:
1. Subscribe to node size changes:
   ```typescript
   // In nodegrapheditor.ts or component initialization
   EventDispatcher.instance.on(
     ['Model.portAdded', 'Model.portRemoved'],
     (args) => this.handleNodeSizeChange(args.model),
     this
   );
   ```
2. Implement push calculation:
   ```typescript
   private handleNodeSizeChange(nodeModel: NodeGraphNode): void {
     const node = this.findNodeWithId(nodeModel.id);
     if (!node) return;
     
     // Get all nodes attached below this one
     const chain = this.attachmentsModel.getAttachmentChain(nodeModel.id);
     const nodeIndex = chain.indexOf(nodeModel.id);
     
     if (nodeIndex === -1 || nodeIndex === chain.length - 1) return;
     
     // Calculate expected position for next node
     const attachment = this.attachmentsModel.getAttachmentBetween(
       nodeModel.id,
       chain[nodeIndex + 1]
     );
     
     if (!attachment) return;
     
     const expectedY = node.global.y + node.nodeSize.height + attachment.spacing;
     const nextNode = this.findNodeWithId(chain[nodeIndex + 1]);
     
     if (!nextNode) return;
     
     const deltaY = expectedY - nextNode.global.y;
     
     if (Math.abs(deltaY) < 1) return; // No significant change
     
     // Push all nodes below
     for (let i = nodeIndex + 1; i < chain.length; i++) {
       const pushNode = this.findNodeWithId(chain[i]);
       if (pushNode) {
         pushNode.model.setPosition(pushNode.x, pushNode.y + deltaY, { undo: false });
         pushNode.setPosition(pushNode.x, pushNode.y + deltaY);
       }
     }
     
     this.relayout();
     this.repaint();
   }
   ```
3. Handle recursive push (pushing a node that has nodes attached below it)
4. Add debouncing to prevent excessive updates during rapid changes

**Files to modify**:
- `packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts`

**Success criteria**:
- [ ] Adding port pushes attached nodes down
- [ ] Removing port pulls attached nodes up (closer)
- [ ] Full chain pushes correctly (A→B→C, A grows, B and C both move)
- [ ] No infinite loops or excessive recalculation

---

### Session 3.6: Detachment (2 hours)

**Goal**: Allow users to remove nodes from attachment chains.

**Tasks**:
1. Add context menu item:
   ```typescript
   // In node context menu creation
   if (this.attachmentsModel.getAttachedAbove(node.model.id) || 
       this.attachmentsModel.getAttachedBelow(node.model.id)) {
     menuItems.push({
       label: 'Detach from Stack',
       onClick: () => this.detachNode(node)
     });
   }
   ```
2. Implement detach logic:
   ```typescript
   private detachNode(node: NodeGraphEditorNode): void {
     const nodeId = node.model.id;
     const aboveId = this.attachmentsModel.getAttachedAbove(nodeId);
     const belowId = this.attachmentsModel.getAttachedBelow(nodeId);
     
     // Remove attachment above (if exists)
     if (aboveId) {
       const att = this.attachmentsModel.getAttachmentBetween(aboveId, nodeId);
       if (att) this.attachmentsModel.removeAttachment(att.id);
     }
     
     // Remove attachment below (if exists)
     if (belowId) {
       const att = this.attachmentsModel.getAttachmentBetween(nodeId, belowId);
       if (att) this.attachmentsModel.removeAttachment(att.id);
     }
     
     // Reconnect above and below if both existed
     if (aboveId && belowId) {
       const aboveNode = this.findNodeWithId(aboveId);
       const belowNode = this.findNodeWithId(belowId);
       
       if (aboveNode && belowNode) {
         // Calculate new spacing (closing the gap)
         const spacing = belowNode.global.y - (aboveNode.global.y + aboveNode.nodeSize.height);
         this.attachmentsModel.createAttachment(aboveId, belowId, spacing);
         
         // Move below node up to close gap
         const targetY = aboveNode.global.y + aboveNode.nodeSize.height + 20; // Default spacing
         const deltaY = targetY - belowNode.global.y;
         
         // Move entire sub-chain
         const chain = this.attachmentsModel.getAttachmentChain(belowId);
         const startIndex = chain.indexOf(belowId);
         
         for (let i = startIndex; i < chain.length; i++) {
           const moveNode = this.findNodeWithId(chain[i]);
           if (moveNode) {
             moveNode.model.setPosition(moveNode.x, moveNode.y + deltaY, { undo: false });
             moveNode.setPosition(moveNode.x, moveNode.y + deltaY);
           }
         }
       }
     }
     
     this.relayout();
     this.repaint();
   }
   ```
3. Add undo support for detachment
4. Consider animation for gap closing (optional)

**Files to modify**:
- `packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts`

**Success criteria**:
- [ ] Context menu shows "Detach from Stack" for attached nodes
- [ ] Detaching middle node reconnects above and below
- [ ] Gap closes after detachment
- [ ] Detaching end node removes single attachment
- [ ] Undo restores attachment and positions

---

### Session 3.7: Alignment Guides (2 hours, optional)

**Goal**: Show alignment guides when dragging near aligned edges.

**Tasks**:
1. Detect aligned edges during drag:
   ```typescript
   private detectAlignedEdges(draggingNode: NodeGraphEditorNode): AlignmentGuide[] {
     const guides: AlignmentGuide[] = [];
     const tolerance = 5; // pixels
     
     const dragBounds = {
       left: draggingNode.global.x,
       right: draggingNode.global.x + draggingNode.nodeSize.width,
       top: draggingNode.global.y,
       bottom: draggingNode.global.y + draggingNode.nodeSize.height
     };
     
     this.forEachNode((node) => {
       if (node === draggingNode) return;
       
       const nodeBounds = {
         left: node.global.x,
         right: node.global.x + node.nodeSize.width,
         top: node.global.y,
         bottom: node.global.y + node.nodeSize.height
       };
       
       // Check left edges align
       if (Math.abs(dragBounds.left - nodeBounds.left) < tolerance) {
         guides.push({ type: 'vertical', position: nodeBounds.left });
       }
       
       // Check right edges align
       if (Math.abs(dragBounds.right - nodeBounds.right) < tolerance) {
         guides.push({ type: 'vertical', position: nodeBounds.right });
       }
       
       // Check top edges align
       if (Math.abs(dragBounds.top - nodeBounds.top) < tolerance) {
         guides.push({ type: 'horizontal', position: nodeBounds.top });
       }
       
       // Check bottom edges align
       if (Math.abs(dragBounds.bottom - nodeBounds.bottom) < tolerance) {
         guides.push({ type: 'horizontal', position: nodeBounds.bottom });
       }
     });
     
     return guides;
   }
   ```
2. Render guides in paint():
   ```typescript
   private paintAlignmentGuides(ctx: CanvasRenderingContext2D): void {
     if (!this.alignmentGuides?.length) return;
     
     ctx.save();
     ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
     ctx.lineWidth = 1;
     ctx.setLineDash([5, 5]);
     
     for (const guide of this.alignmentGuides) {
       ctx.beginPath();
       
       if (guide.type === 'vertical') {
         ctx.moveTo(guide.position, this.graphAABB.minY - 100);
         ctx.lineTo(guide.position, this.graphAABB.maxY + 100);
       } else {
         ctx.moveTo(this.graphAABB.minX - 100, guide.position);
         ctx.lineTo(this.graphAABB.maxX + 100, guide.position);
       }
       
       ctx.stroke();
     }
     
     ctx.restore();
   }
   ```
3. Clear guides on drag end

**Files to modify**:
- `packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts`

**Success criteria**:
- [ ] Vertical guides appear when left/right edges align
- [ ] Horizontal guides appear when top/bottom edges align
- [ ] Guides visually distinct from attachment highlights
- [ ] Guides clear after drag

---

## Testing Checklist

### Attachment Creation
- [ ] Drag node near another's bottom edge → edge highlights
- [ ] Drag node near another's top edge → edge highlights
- [ ] Drop on highlighted edge → attachment created
- [ ] Attachment stored in model
- [ ] Attachment persists after save/reload

### Chain Behavior
- [ ] Create chain of 3+ nodes
- [ ] Moving top node moves all attached nodes
- [ ] Expanding top node pushes all down
- [ ] Expanding middle node pushes nodes below

### Insertion
- [ ] Drag node between two attached nodes
- [ ] Both edges highlight (or nearest one)
- [ ] Drop inserts node into chain
- [ ] Original chain reconnected through new node

### Detachment
- [ ] Context menu shows "Detach from Stack" for attached nodes
- [ ] Detach middle node → chain reconnects
- [ ] Detach top node → remaining chain intact
- [ ] Detach bottom node → remaining chain intact
- [ ] Gap closes after detachment

### Undo/Redo
- [ ] Undo attachment creation → attachment removed
- [ ] Redo → attachment restored
- [ ] Undo detachment → attachment restored
- [ ] Undo push → positions restored

### Edge Cases
- [ ] Circular attachment prevented (A→B→C→A impossible)
- [ ] Deleting attached node removes from chain
- [ ] Very long chain (10+ nodes) works correctly
- [ ] Node in Smart Frame can still be attached
- [ ] Copy/paste of attached node creates independent node

### Alignment Guides (if implemented)
- [ ] Vertical guide shows when left edges align
- [ ] Vertical guide shows when right edges align
- [ ] Horizontal guide shows when top edges align
- [ ] Horizontal guide shows when bottom edges align
- [ ] Multiple guides can show simultaneously
- [ ] Guides clear after drag ends

---

## Files Summary

### Create
```
packages/noodl-editor/src/editor/src/models/attachmentsmodel.ts
```

### Modify
```
packages/noodl-editor/src/editor/src/models/nodegraphmodel.ts
packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts
packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNode.ts
```

---

## Performance Considerations

### Proximity Detection

- Only check nearby nodes (use spatial partitioning for large graphs)
- Cache node bounds during drag
- Don't recalculate on every mouse move (throttle to ~30fps)

```typescript
// Throttled proximity check
const checkProximity = throttle(() => {
  this.currentProximity = this.detectEdgeProximity(draggingNode);
  this.repaint();
}, 33); // ~30fps
```

### Push Calculation

- Debounce size change handlers
- Only recalculate affected chain, not all attachments
- Cache chain lookups

```typescript
// Debounced size change handler
const handleSizeChange = debounce((nodeModel) => {
  this.pushAttachedNodes(nodeModel);
}, 100);
```

### Alignment Guides

- Limit to nodes within viewport
- Use Set to deduplicate guides at same position
- Don't render guides that extend far off-screen

---

## Design Decisions

### Why Not Auto-Attach on Overlap?

Users may intentionally overlap nodes temporarily. Requiring drop on highlighted edge gives user control and prevents unwanted attachments.

### Why Fixed Spacing?

Spacing is captured at attachment creation time. This preserves the user's intentional layout while maintaining relative positions during push operations.

Could make spacing adjustable in future (drag to resize gap).

### Why Reconnect on Detach?

If A→B→C and B is detached, users usually want A→C (close the gap) rather than leaving A and C unattached. This matches mental model of "removing from the middle".

Users can manually detach A from C afterward if they want separation.
