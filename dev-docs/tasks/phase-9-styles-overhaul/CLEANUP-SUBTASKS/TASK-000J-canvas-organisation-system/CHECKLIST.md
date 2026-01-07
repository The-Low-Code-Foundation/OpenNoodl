# TASK-000J Implementation Checklist

## Pre-Implementation

- [ ] Read full README.md specification
- [ ] Review existing comment layer code (`packages/noodl-editor/src/editor/src/views/CommentLayer/`)
- [ ] Review node graph editor code (`packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts`)
- [ ] Review connection rendering (`packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts`)
- [ ] Create feature branch: `feature/canvas-organization`
- [ ] Verify tests pass on main before starting

---

## Phase 1: Smart Frames (16-24 hours)

### Session 1.1: Data Model Extension (2-3 hours)

- [ ] Extend `Comment` interface in `commentsmodel.ts`:
  - [ ] Add `containedNodeIds?: string[]`
  - [ ] Add `isCollapsed?: boolean`
  - [ ] Add `autoResize?: boolean`
- [ ] Add helper methods to `CommentsModel`:
  - [ ] `addNodeToFrame(commentId: string, nodeId: string)`
  - [ ] `removeNodeFromFrame(commentId: string, nodeId: string)`
  - [ ] `isSmartFrame(comment: Comment): boolean`
  - [ ] `getFrameContainingNode(nodeId: string): Comment | null`
- [ ] Verify backward compatibility: load legacy project, confirm comments work
- [ ] Write unit tests for new model methods

### Session 1.2: Basic Containment - Drag In (2-3 hours)

- [ ] In `nodegrapheditor.ts`, on node drag-end:
  - [ ] Check if final position is inside any comment bounds
  - [ ] If inside and not already contained: call `addNodeToFrame()`
  - [ ] Visual feedback: brief highlight on frame when node added
- [ ] Create `SmartFrameUtils.ts`:
  - [ ] `isPointInFrame(point: Point, frame: Comment): boolean`
  - [ ] `isNodeInFrame(node: NodeGraphEditorNode, frame: Comment): boolean`
- [ ] Test: drag node into comment → node ID appears in containedNodeIds
- [ ] Test: existing comments without containedNodeIds still work normally

### Session 1.3: Basic Containment - Drag Out (2 hours)

- [ ] In `nodegrapheditor.ts`, on node drag-end:
  - [ ] Check if node was in a frame and is now outside
  - [ ] If dragged out: call `removeNodeFromFrame()`
- [ ] Test: drag node out of Smart Frame → node ID removed from containedNodeIds
- [ ] Test: dragging all nodes out → comment reverts to passive (optional visual indicator)
- [ ] Handle edge case: node dragged to overlap two frames

### Session 1.4: Group Movement (2-3 hours)

- [ ] In `commentlayer.ts`, detect when Smart Frame is being dragged
- [ ] Calculate movement delta (dx, dy)
- [ ] Apply delta to all contained nodes:
  - [ ] Get node IDs from `containedNodeIds`
  - [ ] Find corresponding `NodeGraphEditorNode` instances
  - [ ] Update positions
- [ ] Ensure node positions are saved after frame drag ends
- [ ] Test: move Smart Frame → all contained nodes move together
- [ ] Test: undo group movement → frame and nodes return to original positions

### Session 1.5: Auto-Resize (2-3 hours)

- [ ] Create `calculateFrameBounds(nodeIds: string[], padding: number): Bounds` in SmartFrameUtils
- [ ] Subscribe to node size/position changes in `nodegrapheditor.ts`
- [ ] When a contained node changes, recalculate frame bounds
- [ ] Update frame dimensions (with minimum size constraints)
- [ ] Add padding constant (e.g., 20px on each side)
- [ ] Test: add port to contained node → frame grows
- [ ] Test: remove port from contained node → frame shrinks
- [ ] Test: move node within frame → frame adjusts if needed

### Session 1.6: Collapse UI (2 hours)

- [ ] In `CommentForeground.tsx`, add collapse/expand button to controls
  - [ ] Only show for Smart Frames (containedNodeIds.length > 0)
  - [ ] Use appropriate icon (chevron up/down or collapse icon)
- [ ] Implement `toggleCollapse()` in CommentsModel
- [ ] Store `isCollapsed` state
- [ ] Test: click collapse → isCollapsed becomes true
- [ ] Test: click expand → isCollapsed becomes false

### Session 1.7: Collapsed Rendering (3-4 hours)

- [ ] In `CommentBackground.tsx`, handle collapsed state:
  - [ ] Render only title bar (fixed height, e.g., 30px)
  - [ ] Keep full width
  - [ ] Different visual style for collapsed state
- [ ] In `nodegrapheditor.ts`:
  - [ ] When rendering, check if node's containing frame is collapsed
  - [ ] If collapsed: don't render the node
- [ ] Calculate connection entry/exit points for collapsed frames:
  - [ ] Find connections where source or target is in collapsed frame
  - [ ] Calculate intersection point with frame edge
  - [ ] Render dot at that position
- [ ] Test: collapse frame → nodes hidden, connections show dots
- [ ] Test: expand frame → nodes visible again

### Session 1.8: Polish & Edge Cases (2 hours)

- [ ] Handle deleting a Smart Frame (contained nodes should remain)
- [ ] Handle deleting a contained node (remove from containedNodeIds)
- [ ] Handle copy/paste of Smart Frame (include contained nodes)
- [ ] Handle copy/paste of contained node (handle frame membership)
- [ ] Performance test with 20+ nodes in one frame
- [ ] Test undo/redo for all operations
- [ ] Update any affected tooltips/help text

### Phase 1 Verification

- [ ] Load legacy project with comments → works unchanged
- [ ] Create new Smart Frame by dragging node into comment
- [ ] Full workflow test: create, populate, move, resize, collapse, expand
- [ ] All existing comment features still work (color, text, resize manually)
- [ ] No console errors
- [ ] Commit and push

---

## Phase 2: Canvas Navigation (8-12 hours)

### Session 2.1: Minimap Component Structure (2 hours)

- [ ] Create directory: `packages/noodl-editor/src/editor/src/views/CanvasNavigation/`
- [ ] Create `CanvasNavigation.tsx` - main container
- [ ] Create `CanvasNavigation.module.scss`
- [ ] Create `Minimap.tsx` - the actual minimap
- [ ] Create `Minimap.module.scss`
- [ ] Define props interface:
  - [ ] `nodeGraph: NodeGraphEditor`
  - [ ] `commentsModel: CommentsModel`
  - [ ] `visible: boolean`
  - [ ] `onToggle: () => void`
- [ ] Basic render: empty container in corner of canvas

### Session 2.2: Coordinate Transformation (2 hours)

- [ ] Calculate canvas bounds (min/max x/y of all nodes and frames)
- [ ] Calculate scale factor: minimap size / canvas bounds
- [ ] Transform frame positions to minimap coordinates
- [ ] Transform viewport rectangle to minimap coordinates
- [ ] Handle edge case: empty canvas (no frames)
- [ ] Handle edge case: single frame
- [ ] Test: render colored rectangles for frames at correct positions

### Session 2.3: Viewport and Click Navigation (2 hours)

- [ ] Subscribe to nodeGraph pan/scale changes
- [ ] Render viewport rectangle on minimap
- [ ] Handle click on minimap:
  - [ ] Transform click position to canvas coordinates
  - [ ] Call nodeGraph.setPanAndScale() to navigate
- [ ] Add smooth animation to pan (optional, nice-to-have)
- [ ] Test: click minimap corner → canvas pans to that area
- [ ] Test: pan canvas → viewport rectangle moves on minimap

### Session 2.4: Toggle and Integration (1-2 hours)

- [ ] Add toggle button to canvas toolbar
- [ ] Wire button to show/hide minimap
- [ ] Add to EditorSettings: `minimapVisible` setting
- [ ] Persist visibility state
- [ ] Mount CanvasNavigation in EditorDocument.tsx
- [ ] Test: toggle minimap on/off
- [ ] Test: close editor, reopen → minimap state preserved

### Session 2.5: Jump Menu (2-3 hours)

- [ ] Create `JumpMenu.tsx` dropdown component
- [ ] Populate menu from Smart Frames (filter by containedNodeIds.length > 0)
- [ ] Show frame title (text) and color indicator
- [ ] On select: pan canvas to center on frame
- [ ] Add keyboard shortcut handler (Cmd+G or Cmd+J)
- [ ] Add number shortcuts (Cmd+1..9 for first 9 frames)
- [ ] Test: open menu → shows Smart Frames
- [ ] Test: select frame → canvas pans to it
- [ ] Test: Cmd+1 → jumps to first frame

### Phase 2 Verification

- [ ] Minimap toggle works
- [ ] Minimap shows frame positions correctly
- [ ] Viewport indicator accurate
- [ ] Click navigation works
- [ ] Jump menu populated correctly
- [ ] Keyboard shortcuts work
- [ ] Settings persist
- [ ] No console errors
- [ ] Commit and push

---

## Phase 3: Vertical Snap + Push (12-16 hours)

### Session 3.1: Attachment Data Model (2 hours)

- [ ] Create `packages/noodl-editor/src/editor/src/models/attachmentsmodel.ts`
- [ ] Define interface:
  ```typescript
  interface VerticalAttachment {
    topNodeId: string;
    bottomNodeId: string;
    spacing: number;
  }
  ```
- [ ] Implement AttachmentsModel class:
  - [ ] `attachments: Map<string, VerticalAttachment>`
  - [ ] `createAttachment(topId, bottomId, spacing)`
  - [ ] `removeAttachment(topId, bottomId)`
  - [ ] `getAttachedBelow(nodeId): string | null`
  - [ ] `getAttachedAbove(nodeId): string | null`
  - [ ] `getAttachmentChain(nodeId): string[]`
- [ ] Persist attachments with project (in component model)
- [ ] Write unit tests

### Session 3.2: Edge Proximity Detection (2-3 hours)

- [ ] In `nodegrapheditor.ts`, during node drag:
  - [ ] Get dragged node bounds
  - [ ] Find all other nodes
  - [ ] Calculate distance to each node's top/bottom edge
  - [ ] Define threshold (e.g., 15px)
- [ ] Track which edges are "hot" (within threshold)
- [ ] Store hot edge state for rendering
- [ ] Test: drag node near another → console logs proximity

### Session 3.3: Visual Feedback (2 hours)

- [ ] In `NodeGraphEditorNode.ts`:
  - [ ] Add state: `highlightedEdge: 'top' | 'bottom' | null`
  - [ ] Modify paint() to render glow on highlighted edge
- [ ] Define glow style (color, blur radius)
- [ ] Update highlighted edges during drag
- [ ] Clear highlights on drag end
- [ ] Test: drag near top edge → top edge glows
- [ ] Test: drag near bottom edge → bottom edge glows
- [ ] Test: drag away → glow disappears

### Session 3.4: Attachment Creation (2-3 hours)

- [ ] On node drag-end:
  - [ ] Check if any edge was highlighted
  - [ ] If so, create attachment via AttachmentsModel
  - [ ] Calculate spacing from actual positions
- [ ] Handle attaching to existing chain:
  - [ ] Check if target node already has attachment on that edge
  - [ ] If so, insert new node into chain
- [ ] Visual confirmation (brief flash or toast)
- [ ] Test: drop on highlighted edge → attachment created
- [ ] Test: drop between two attached nodes → inserted into chain

### Session 3.5: Push Calculation (2-3 hours)

- [ ] Subscribe to node size changes in nodegrapheditor
- [ ] When node size changes:
  - [ ] Check if node has attachments below
  - [ ] Calculate new positions for chain based on spacing
  - [ ] Update node positions
- [ ] Handle recursive push (A→B→C, A grows, B and C both move)
- [ ] Prevent infinite loops (sanity check)
- [ ] Test: resize attached node → nodes below push down
- [ ] Test: chain of 3+ nodes → all push correctly

### Session 3.6: Detachment (2 hours)

- [ ] Add context menu item: "Detach from stack"
- [ ] Only show when node has attachments
- [ ] On detach:
  - [ ] Remove attachment(s) from model
  - [ ] Reconnect remaining chain if node was in middle
  - [ ] Other nodes close the gap (animate? or instant?)
- [ ] Test: detach middle node → chain closes up
- [ ] Test: detach top node → remaining chain intact
- [ ] Test: detach bottom node → remaining chain intact

### Session 3.7: Alignment Guides (2 hours, optional)

- [ ] During node drag:
  - [ ] Find edges of other nodes that align (within tolerance)
  - [ ] Store aligned edges
- [ ] Render guide lines:
  - [ ] Horizontal line for aligned left/right edges
  - [ ] Different color from attachment glow
- [ ] Clear guides on drag end
- [ ] Test: drag near aligned edge → guide line appears

### Phase 3 Verification

- [ ] Attachments persist when project saved/loaded
- [ ] Edge highlighting works during drag
- [ ] Dropping creates attachment
- [ ] Moving top node moves attached nodes
- [ ] Node resize triggers push
- [ ] Insertion between attached nodes works
- [ ] Detachment works and chain closes
- [ ] Undo/redo all operations
- [ ] No console errors
- [ ] Commit and push

---

## Phase 4: Connection Labels (10-14 hours)

### Session 4.1: Bezier Utilities (2 hours)

- [ ] Create `packages/noodl-editor/src/editor/src/utils/bezier.ts`
- [ ] Implement `getPointOnCubicBezier(t, p0, p1, p2, p3): Point`
- [ ] Implement `getNearestTOnCubicBezier(point, p0, p1, p2, p3): number`
  - [ ] Binary search or analytical solution
- [ ] Implement `getTangentOnCubicBezier(t, p0, p1, p2, p3): Vector`
  - [ ] For label rotation (optional)
- [ ] Write unit tests for bezier functions
- [ ] Test with various curve shapes

### Session 4.2: Data Model Extension (1 hour)

- [ ] Extend Connection model in `nodegraphmodel.ts`:
  ```typescript
  label?: {
    text: string;
    position: number;  // 0-1 along curve
  }
  ```
- [ ] Add methods:
  - [ ] `setConnectionLabel(connectionId, label)`
  - [ ] `removeConnectionLabel(connectionId)`
- [ ] Ensure persistence with project
- [ ] Test: set label → data saved

### Session 4.3: Hover State and Add Icon (2-3 hours)

- [ ] In `NodeGraphEditorConnection.ts`:
  - [ ] Add `isHovered` state
  - [ ] Calculate curve midpoint (t=0.5)
- [ ] Detect hover over connection line:
  - [ ] Use existing hit-testing or improve
  - [ ] Set isHovered state
- [ ] Render add-label icon when hovered:
  - [ ] Small "+" or "tag" icon
  - [ ] Position at midpoint
  - [ ] Similar to existing delete "X" icon
- [ ] Test: hover connection → icon appears
- [ ] Test: move away → icon disappears

### Session 4.4: Inline Label Input (2-3 hours)

- [ ] On add-icon click:
  - [ ] Prevent event propagation
  - [ ] Show input element at click position
  - [ ] Auto-focus input
- [ ] Handle input confirmation:
  - [ ] Enter key → save label
  - [ ] Escape key → cancel
  - [ ] Click outside → save label
- [ ] Call `setConnectionLabel()` with text and position=0.5
- [ ] Remove input element after save/cancel
- [ ] Test: click icon → input appears
- [ ] Test: type and enter → label created
- [ ] Test: escape → input cancelled

### Session 4.5: Label Rendering (2 hours)

- [ ] In connection paint():
  - [ ] Check if label exists
  - [ ] Get position on curve using bezier utils
  - [ ] Render label background (rounded rect)
  - [ ] Render label text
- [ ] Style label:
  - [ ] Match connection color (with transparency)
  - [ ] Small font (10-11px)
  - [ ] Padding around text
- [ ] Test: label renders at correct position
- [ ] Test: label visible when zoomed in/out
- [ ] Test: label doesn't render if text is empty

### Session 4.6: Label Interaction (2-3 hours)

- [ ] Hit-test on labels:
  - [ ] Track label bounds
  - [ ] Check click/hover against label
- [ ] Click label → show edit input:
  - [ ] Pre-filled with current text
  - [ ] Same behavior as add flow
- [ ] Drag label:
  - [ ] Track drag start
  - [ ] Calculate new t-value using getNearestT()
  - [ ] Update label position
  - [ ] Constrain to 0.1-0.9 (not at endpoints)
- [ ] Delete label:
  - [ ] Show X button on label hover
  - [ ] Or: empty text and confirm
- [ ] Test: click label → can edit
- [ ] Test: drag label → moves along curve
- [ ] Test: delete label → label removed

### Phase 4 Verification

- [ ] Bezier utilities work correctly
- [ ] Hover shows add icon
- [ ] Can add label via click
- [ ] Label renders on curve
- [ ] Can edit label text
- [ ] Can drag label along curve
- [ ] Can delete label
- [ ] Labels persist on save/load
- [ ] Undo/redo works
- [ ] No console errors
- [ ] Commit and push

---

## Final Integration

- [ ] Test all features together:
  - [ ] Smart Frame containing attached nodes with labeled connections
  - [ ] Collapse frame → labels still visible on external connections
  - [ ] Navigate via minimap to frame
- [ ] Performance test:
  - [ ] 50+ nodes
  - [ ] 10+ Smart Frames
  - [ ] 20+ labels
  - [ ] 5+ attachment chains
- [ ] Cross-browser test (if applicable)
- [ ] Update any documentation
- [ ] Create PR with full description
- [ ] Code review and merge

---

## Post-Implementation

- [ ] Monitor for bug reports
- [ ] Gather user feedback
- [ ] Document any known limitations
- [ ] Plan follow-up improvements (if needed)
