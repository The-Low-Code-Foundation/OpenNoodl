# SUBTASK-001: Smart Frames

**Parent Task**: TASK-000J Canvas Organization System  
**Estimate**: 16-24 hours  
**Priority**: 1 (Foundation for other features)  
**Dependencies**: None

---

## Overview

Smart Frames evolve the existing Comment system into visual containers that actually contain their nodes. When a frame moves, nodes inside move with it. When nodes inside expand, the frame grows to accommodate them.

### The Problem

Current comment boxes are purely visual - they provide no functional grouping. Users draw boxes around related nodes, but:
- Moving the box doesn't move the nodes
- Nodes expanding overlap the box boundaries
- There's no way to collapse a group to reduce visual clutter

### The Solution

Convert comment boxes into "Smart Frames" that:
- Track which nodes are inside them
- Move contained nodes when the frame moves
- Auto-resize to fit contents
- Can collapse to hide contents while preserving connections

---

## Backward Compatibility

**Critical Requirement**: Existing projects must work unchanged.

| Scenario | Behavior |
|----------|----------|
| Load legacy project | Comment boxes render exactly as before |
| Comment with no nodes dragged in | Behaves as passive comment (no changes) |
| Drag node INTO comment | Comment becomes Smart Frame, node added to group |
| Drag node OUT of Smart Frame | Node removed from group |
| Drag ALL nodes out | Smart Frame reverts to passive comment |

This means:
- `containedNodeIds` defaults to `undefined` (not empty array)
- Empty/undefined `containedNodeIds` = passive comment behavior
- Populated `containedNodeIds` = Smart Frame behavior

---

## Feature Capabilities

### Core Behaviors

| Capability | Description |
|------------|-------------|
| **Opt-in containment** | Drag node into frame to add; drag out to remove |
| **Group movement** | Moving frame moves all contained nodes |
| **Auto-resize** | Frame grows/shrinks to fit contained nodes + padding |
| **Collapse/Expand** | Toggle to show only title bar |
| **Connection preservation** | Collapsed frames show connection dots on edges |

### Visual Design

**Normal State:**
```
┌─── Login Flow ────────────────────────┐
│                                       │
│  ┌────────┐    ┌────────┐   ┌──────┐ │
│  │ Email  │───►│Validate│──►│Login │ │
│  └────────┘    └────────┘   └──────┘ │
│                                       │
└───────────────────────────────────────┘
```

**Collapsed State:**
```
┌─── Login Flow ───●────────●─────────►
                   ▲        ▲
            input dots    output dots
```

### Collapse Behavior Details

When collapsed:
1. Frame height reduces to title bar only (~30px)
2. Frame width remains unchanged
3. Contained nodes are hidden (not rendered)
4. Connections to/from contained nodes:
   - Calculate intersection with frame edge
   - Render as dots on the frame edge
   - Dots indicate where connections enter/exit
5. Clicking frame expands it again

---

## Data Model

### Extended Comment Interface

```typescript
interface Comment {
  // Existing fields (unchanged)
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: CommentFillStyle;
  color: string;
  largeFont?: boolean;
  
  // New Smart Frame fields
  containedNodeIds?: string[];  // undefined = passive, populated = Smart Frame
  isCollapsed?: boolean;        // default false
  autoResize?: boolean;         // default true for Smart Frames
}
```

### New CommentsModel Methods

```typescript
class CommentsModel {
  // Existing methods...
  
  /**
   * Add a node to a Smart Frame
   * If comment has no containedNodeIds, initializes the array
   */
  addNodeToFrame(commentId: string, nodeId: string): void;
  
  /**
   * Remove a node from a Smart Frame
   * If this empties containedNodeIds, sets to undefined (reverts to comment)
   */
  removeNodeFromFrame(commentId: string, nodeId: string): void;
  
  /**
   * Toggle collapsed state
   */
  toggleCollapse(commentId: string): void;
  
  /**
   * Check if a comment is functioning as a Smart Frame
   */
  isSmartFrame(comment: Comment): boolean;
  
  /**
   * Find which frame contains a given node (if any)
   */
  getFrameContainingNode(nodeId: string): Comment | null;
  
  /**
   * Update frame bounds based on contained nodes
   */
  updateFrameBounds(commentId: string, nodes: NodeGraphEditorNode[], padding: number): void;
}
```

---

## Implementation Sessions

### Session 1.1: Data Model Extension (2-3 hours)

**Goal**: Extend Comment interface and add model methods.

**Tasks**:
1. Add new fields to Comment interface in `commentsmodel.ts`
2. Implement `addNodeToFrame()`:
   ```typescript
   addNodeToFrame(commentId: string, nodeId: string): void {
     const comment = this.getComment(commentId);
     if (!comment) return;
     
     if (!comment.containedNodeIds) {
       comment.containedNodeIds = [];
     }
     
     if (!comment.containedNodeIds.includes(nodeId)) {
       comment.containedNodeIds.push(nodeId);
       this.setComment(commentId, comment, { undo: true, label: 'add node to frame' });
     }
   }
   ```
3. Implement `removeNodeFromFrame()`:
   ```typescript
   removeNodeFromFrame(commentId: string, nodeId: string): void {
     const comment = this.getComment(commentId);
     if (!comment?.containedNodeIds) return;
     
     const index = comment.containedNodeIds.indexOf(nodeId);
     if (index > -1) {
       comment.containedNodeIds.splice(index, 1);
       
       // Revert to passive comment if empty
       if (comment.containedNodeIds.length === 0) {
         comment.containedNodeIds = undefined;
       }
       
       this.setComment(commentId, comment, { undo: true, label: 'remove node from frame' });
     }
   }
   ```
4. Implement helper methods (`isSmartFrame`, `getFrameContainingNode`, `toggleCollapse`)
5. Verify backward compatibility: load legacy project, confirm no changes

**Files to modify**:
- `packages/noodl-editor/src/editor/src/models/commentsmodel.ts`

**Success criteria**:
- [ ] New fields added to interface
- [ ] All methods implemented
- [ ] Legacy projects load without changes
- [ ] Unit tests pass

---

### Session 1.2: Basic Containment - Drag In (2-3 hours)

**Goal**: Detect when a node is dropped inside a comment and add it to the frame.

**Tasks**:
1. Create `SmartFrameUtils.ts` with geometry helpers:
   ```typescript
   export function isPointInFrame(point: Point, frame: Comment): boolean {
     return (
       point.x >= frame.x &&
       point.x <= frame.x + frame.width &&
       point.y >= frame.y &&
       point.y <= frame.y + frame.height
     );
   }
   
   export function isNodeInFrame(node: NodeGraphEditorNode, frame: Comment): boolean {
     const nodeCenter = {
       x: node.global.x + node.nodeSize.width / 2,
       y: node.global.y + node.nodeSize.height / 2
     };
     return isPointInFrame(nodeCenter, frame);
   }
   ```
2. In `nodegrapheditor.ts`, modify node drag-end handler:
   ```typescript
   // After node position is finalized
   const comments = this.commentLayer.model.getComments();
   for (const comment of comments) {
     if (isNodeInFrame(node, comment)) {
       // Check if not already in this frame
       const currentFrame = this.commentLayer.model.getFrameContainingNode(node.model.id);
       if (currentFrame?.id !== comment.id) {
         // Remove from old frame if any
         if (currentFrame) {
           this.commentLayer.model.removeNodeFromFrame(currentFrame.id, node.model.id);
         }
         // Add to new frame
         this.commentLayer.model.addNodeToFrame(comment.id, node.model.id);
       }
       break;
     }
   }
   ```
3. Add visual feedback: brief highlight on frame when node added

**Files to create**:
- `packages/noodl-editor/src/editor/src/views/CommentLayer/SmartFrameUtils.ts`

**Files to modify**:
- `packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts`

**Success criteria**:
- [ ] Dragging node into comment adds it to containedNodeIds
- [ ] Visual feedback shows node was added
- [ ] Undo works correctly

---

### Session 1.3: Basic Containment - Drag Out (2 hours)

**Goal**: Detect when a node is dragged out of its frame and remove it.

**Tasks**:
1. Track node's original frame at drag start:
   ```typescript
   startDraggingNode(node: NodeGraphEditorNode) {
     // ... existing code
     this.dragStartFrame = this.commentLayer.model.getFrameContainingNode(node.model.id);
   }
   ```
2. On drag end, check if node left its frame:
   ```typescript
   // In drag end handler
   if (this.dragStartFrame) {
     if (!isNodeInFrame(node, this.dragStartFrame)) {
       this.commentLayer.model.removeNodeFromFrame(this.dragStartFrame.id, node.model.id);
     }
   }
   ```
3. Handle edge case: node dragged from one frame directly into another
4. Clear `dragStartFrame` after drag completes

**Files to modify**:
- `packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts`

**Success criteria**:
- [ ] Dragging node out of frame removes it from containedNodeIds
- [ ] Frame with no nodes reverts to passive comment
- [ ] Direct frame-to-frame transfer works

---

### Session 1.4: Group Movement (2-3 hours)

**Goal**: When a Smart Frame is moved, move all contained nodes with it.

**Tasks**:
1. In `commentlayer.ts`, detect Smart Frame drag:
   ```typescript
   // When comment drag starts
   onCommentDragStart(comment: Comment) {
     this.draggingSmartFrame = this.model.isSmartFrame(comment);
     this.dragStartPosition = { x: comment.x, y: comment.y };
   }
   ```
2. Calculate and apply delta to contained nodes:
   ```typescript
   onCommentDragEnd(comment: Comment) {
     if (this.draggingSmartFrame && comment.containedNodeIds) {
       const dx = comment.x - this.dragStartPosition.x;
       const dy = comment.y - this.dragStartPosition.y;
       
       // Move all contained nodes
       for (const nodeId of comment.containedNodeIds) {
         const node = this.nodegraphEditor.findNodeWithId(nodeId);
         if (node) {
           node.model.setPosition(node.x + dx, node.y + dy, { undo: false });
         }
       }
       
       // Create single undo action for the whole operation
       UndoQueue.instance.push(new UndoActionGroup({
         label: 'move frame',
         // ... undo/redo logic
       }));
     }
   }
   ```
3. Ensure node positions are saved after frame drag
4. Handle undo: single undo should revert frame AND all nodes

**Files to modify**:
- `packages/noodl-editor/src/editor/src/views/commentlayer.ts`
- `packages/noodl-editor/src/editor/src/views/CommentLayer/CommentForeground.tsx`

**Success criteria**:
- [ ] Moving Smart Frame moves all contained nodes
- [ ] Undo reverts entire group movement
- [ ] Passive comments still move independently

---

### Session 1.5: Auto-Resize (2-3 hours)

**Goal**: Frame automatically resizes to fit contained nodes.

**Tasks**:
1. Add bounds calculation to `SmartFrameUtils.ts`:
   ```typescript
   export function calculateFrameBounds(
     nodes: NodeGraphEditorNode[],
     padding: number = 20
   ): { x: number; y: number; width: number; height: number } {
     if (nodes.length === 0) return null;
     
     let minX = Infinity, minY = Infinity;
     let maxX = -Infinity, maxY = -Infinity;
     
     for (const node of nodes) {
       minX = Math.min(minX, node.global.x);
       minY = Math.min(minY, node.global.y);
       maxX = Math.max(maxX, node.global.x + node.nodeSize.width);
       maxY = Math.max(maxY, node.global.y + node.nodeSize.height);
     }
     
     return {
       x: minX - padding,
       y: minY - padding - 30, // Extra for title bar
       width: maxX - minX + padding * 2,
       height: maxY - minY + padding * 2 + 30
     };
   }
   ```
2. Subscribe to node changes in `nodegrapheditor.ts`:
   ```typescript
   // When node size changes (ports added/removed)
   onNodeSizeChanged(node: NodeGraphEditorNode) {
     const frame = this.commentLayer.model.getFrameContainingNode(node.model.id);
     if (frame && frame.autoResize !== false) {
       this.updateFrameBounds(frame);
     }
   }
   ```
3. Apply minimum size constraints (don't shrink below title width)
4. Throttle updates during rapid changes

**Files to modify**:
- `packages/noodl-editor/src/editor/src/views/CommentLayer/SmartFrameUtils.ts`
- `packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts`
- `packages/noodl-editor/src/editor/src/models/commentsmodel.ts`

**Success criteria**:
- [ ] Adding port to contained node causes frame to grow
- [ ] Removing port causes frame to shrink
- [ ] Moving node within frame adjusts bounds if needed
- [ ] Minimum size maintained

---

### Session 1.6: Collapse UI (2 hours)

**Goal**: Add collapse/expand button to Smart Frame controls.

**Tasks**:
1. In `CommentForeground.tsx`, add collapse button:
   ```tsx
   {props.isSmartFrame && (
     <IconButton
       icon={props.isCollapsed ? IconName.ChevronDown : IconName.ChevronUp}
       buttonSize={IconButtonSize.Bigger}
       onClick={() => props.toggleCollapse()}
     />
   )}
   ```
2. Pass `isSmartFrame` and `isCollapsed` as props
3. Implement `toggleCollapse` handler:
   ```typescript
   toggleCollapse: () => {
     props.updateComment(
       { isCollapsed: !props.isCollapsed },
       { commit: true, label: 'toggle frame collapse' }
     );
   }
   ```
4. Style the button appropriately

**Files to modify**:
- `packages/noodl-editor/src/editor/src/views/CommentLayer/CommentForeground.tsx`
- `packages/noodl-editor/src/editor/src/views/commentlayer.ts`

**Success criteria**:
- [ ] Collapse button only shows for Smart Frames
- [ ] Clicking toggles isCollapsed state
- [ ] Undo works

---

### Session 1.7: Collapsed Rendering (3-4 hours)

**Goal**: Render collapsed state and connection dots.

**Tasks**:
1. In `CommentBackground.tsx`, handle collapsed state:
   ```tsx
   const height = props.isCollapsed ? 30 : props.height;
   
   return (
     <div
       className={`comment-layer-comment background ${props.isCollapsed ? 'collapsed' : ''} ...`}
       style={{
         ...colorStyle,
         width: props.width,
         height: height,
         transform
       }}
     >
       <div className="content">{props.text}</div>
     </div>
   );
   ```
2. In `nodegrapheditor.ts`, skip rendering nodes in collapsed frames:
   ```typescript
   paint() {
     // Get collapsed frame node IDs
     const collapsedNodeIds = new Set<string>();
     for (const comment of this.commentLayer.model.getComments()) {
       if (comment.isCollapsed && comment.containedNodeIds) {
         comment.containedNodeIds.forEach(id => collapsedNodeIds.add(id));
       }
     }
     
     // Skip rendering collapsed nodes
     this.forEachNode((node) => {
       if (!collapsedNodeIds.has(node.model.id)) {
         node.paint(ctx, paintRect);
       }
     });
   }
   ```
3. Calculate connection dots:
   ```typescript
   // In SmartFrameUtils.ts
   export function getConnectionDotsForCollapsedFrame(
     frame: Comment,
     connections: Connection[],
     nodeIdSet: Set<string>
   ): ConnectionDot[] {
     const dots: ConnectionDot[] = [];
     
     for (const conn of connections) {
       const fromInFrame = nodeIdSet.has(conn.fromId);
       const toInFrame = nodeIdSet.has(conn.toId);
       
       if (fromInFrame && !toInFrame) {
         // Outgoing connection - dot on right edge
         dots.push({
           x: frame.x + frame.width,
           y: frame.y + 15, // Center of title bar
           type: 'output'
         });
       } else if (!fromInFrame && toInFrame) {
         // Incoming connection - dot on left edge
         dots.push({
           x: frame.x,
           y: frame.y + 15,
           type: 'input'
         });
       }
     }
     
     return dots;
   }
   ```
4. Render dots in connection paint or comment layer

**Files to modify**:
- `packages/noodl-editor/src/editor/src/views/CommentLayer/CommentBackground.tsx`
- `packages/noodl-editor/src/editor/src/views/CommentLayer/CommentLayer.css`
- `packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts`
- `packages/noodl-editor/src/editor/src/views/CommentLayer/SmartFrameUtils.ts`

**Success criteria**:
- [ ] Collapsed frame shows only title bar
- [ ] Nodes inside collapsed frame are hidden
- [ ] Connection dots appear on frame edges
- [ ] Expanding frame shows nodes again

---

### Session 1.8: Polish & Edge Cases (2 hours)

**Goal**: Handle edge cases and polish the feature.

**Tasks**:
1. Handle deleting a Smart Frame:
   - Contained nodes should remain (become uncontained)
   - Clear containedNodeIds before deletion
2. Handle deleting a contained node:
   - Remove from containedNodeIds automatically
   - Subscribe to node deletion events
3. Handle copy/paste of Smart Frame:
   - Include contained nodes in copy
   - Update node IDs in paste
4. Handle copy/paste of individual contained node:
   - Pasted node should not be in any frame
5. Performance test with 20+ nodes in one frame
6. Test undo/redo for all operations
7. Update tooltips if needed

**Files to modify**:
- `packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts`
- `packages/noodl-editor/src/editor/src/models/commentsmodel.ts`

**Success criteria**:
- [ ] All edge cases handled gracefully
- [ ] No console errors
- [ ] Performance acceptable with many nodes
- [ ] Undo/redo works for all operations

---

## Testing Checklist

### Backward Compatibility
- [ ] Load project created before Smart Frames feature
- [ ] All existing comments render correctly
- [ ] Comment colors preserved
- [ ] Comment text preserved
- [ ] Comment fill styles preserved
- [ ] Manual resize still works
- [ ] No new fields added to saved file unless frame is used

### Containment
- [ ] Drag node into empty comment → becomes Smart Frame
- [ ] Drag second node into same frame → both contained
- [ ] Drag node out of frame → removed from containment
- [ ] Drag all nodes out → reverts to passive comment
- [ ] Drag node directly from frame A to frame B → transfers correctly
- [ ] Node dragged partially overlapping frame → uses center point for detection

### Group Movement
- [ ] Move Smart Frame → all nodes move
- [ ] Move passive comment → only comment moves
- [ ] Undo frame move → frame and all nodes revert
- [ ] Move frame containing 10+ nodes → performance acceptable

### Auto-Resize
- [ ] Add port to contained node → frame grows
- [ ] Remove port from contained node → frame shrinks
- [ ] Move node to edge of frame → frame expands
- [ ] Move node toward center → frame shrinks (with minimum)
- [ ] Rapid port changes → no flickering, throttled updates

### Collapse/Expand
- [ ] Collapse button only appears for Smart Frames
- [ ] Click collapse → frame collapses to title bar
- [ ] Nodes hidden when collapsed
- [ ] Connection dots visible on collapsed frame
- [ ] Click expand → frame expands, nodes visible
- [ ] Undo collapse → expands again

### Edge Cases
- [ ] Delete Smart Frame → contained nodes remain
- [ ] Delete contained node → removed from frame
- [ ] Copy/paste Smart Frame → nodes included
- [ ] Copy/paste contained node → not in any frame
- [ ] Empty Smart Frame (all nodes deleted) → reverts to comment

---

## Files Summary

### Create
```
packages/noodl-editor/src/editor/src/views/CommentLayer/SmartFrameUtils.ts
```

### Modify
```
packages/noodl-editor/src/editor/src/models/commentsmodel.ts
packages/noodl-editor/src/editor/src/views/CommentLayer/CommentLayerView.tsx
packages/noodl-editor/src/editor/src/views/CommentLayer/CommentForeground.tsx
packages/noodl-editor/src/editor/src/views/CommentLayer/CommentBackground.tsx
packages/noodl-editor/src/editor/src/views/CommentLayer/CommentLayer.css
packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts
packages/noodl-editor/src/editor/src/views/commentlayer.ts
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking legacy projects | Extensive backward compat testing; containedNodeIds defaults undefined |
| Performance with many nodes | Throttle auto-resize; optimize bounds calculation |
| Complex undo/redo | Use UndoActionGroup for compound operations |
| Connection dot positions | Start simple (left/right edges); improve later if needed |
| Collapsed state persistence | Ensure isCollapsed saves/loads correctly |
