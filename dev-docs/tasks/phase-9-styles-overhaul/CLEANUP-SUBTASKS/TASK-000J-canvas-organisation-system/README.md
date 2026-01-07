# TASK-000J: Canvas Organization System

## Overview

This task implements a comprehensive canvas organization system to address the chaos that emerges in complex node graphs. The primary problem: as users add nodes and connections, nodes expand vertically (due to new ports), groupings lose meaning, and the canvas becomes unmanageable.

**The core philosophy**: Work with lazy users, not against them. Rather than forcing component creation, provide organizational tools that are easier than the current chaos but don't require significant workflow changes.

## Background

### The Problem

Looking at a typical complex component canvas:

1. **Vertical expansion breaks layouts** - When a node gains ports, it grows vertically, overlapping nodes below it
2. **No persistent groupings** - Users mentally group related nodes, but nothing enforces or maintains these groupings
3. **Connection spaghetti** - With many connections, it's impossible to trace data flow
4. **No navigation** - In large canvases, users pan around aimlessly looking for specific logic
5. **Comments are passive** - Current comment boxes are purely visual; nodes inside them don't behave as a group

### Design Principles

1. **Backward compatible** - Existing projects with comment boxes must work unchanged
2. **Opt-in complexity** - Simple projects don't need these features; complex projects benefit
3. **User responsibility** - Users create organization; system maintains it
4. **Minimal UI footprint** - Features should feel native to the existing canvas

---

## Feature Summary

| Feature | Purpose | Complexity | Impact |
|---------|---------|------------|--------|
| Smart Frames | Group nodes that move/resize together | Medium-High | ⭐⭐⭐⭐⭐ |
| Canvas Navigation | Minimap + jump-to-frame | Medium | ⭐⭐⭐⭐ |
| Vertical Snap + Push | Keep stacked nodes organized | Medium | ⭐⭐⭐ |
| Connection Labels | Annotate data flow on connections | Medium | ⭐⭐⭐⭐ |

**Total Estimate**: 45-65 hours (6-8 days)

---

## Feature 1: Smart Frames

### Description

Evolve the existing Comment system into "Smart Frames" - visual containers that actually contain their nodes. When a frame moves, nodes inside move with it. When nodes inside expand, the frame grows to accommodate them.

### Backward Compatibility

**Critical requirement**: Existing comment boxes must continue to work as purely visual elements. Smart Frame behavior is **opt-in**:

- Legacy comment boxes render and behave exactly as before
- Dragging a node INTO a comment box converts it to a Smart Frame and adds the node to its group
- Dragging a node OUT of a Smart Frame removes it from the group
- Empty Smart Frames revert to passive comment boxes

This means:
- Old projects load with no changes
- Users gradually adopt Smart Frames by dragging nodes into existing comments
- No migration required

### Capabilities

| Capability | Description |
|------------|-------------|
| Visual container | Colored rectangle with title text (uses existing comment styling) |
| Opt-in containment | Drag node into frame to add; drag out to remove |
| Group movement | When frame is dragged, all contained nodes move together |
| Auto-resize | Frame grows/shrinks to fit contained nodes + padding |
| Collapse/Expand | Toggle to collapse frame to title bar only |
| Collapsed connections | When collapsed, connections to internal nodes render as dots on frame edge |
| Title as label | Frame title serves as the organizational label |
| Nav anchor | Each Smart Frame becomes a navigation waypoint (see Feature 2) |

### Collapse Behavior

When collapsed:
```
┌─── Login Flow ──────────────────────────┐
│  ┌────────┐    ┌────────┐   ┌────────┐  │
│  │ Email  │───►│Validate│──►│ Login  │  │
│  └────────┘    └────────┘   └────────┘  │
└─────────────────────────────────────────┘
                    │
                    ▼ collapse
                    
┌─── Login Flow ───●────────●─────────────►
                   ▲        ▲
            input dots    output dots
```

- Frame height reduces to title bar only
- Internal nodes hidden but connections preserved
- Dots on frame edge show connection entry/exit points
- Clicking dots could highlight the connection path (nice-to-have)

### Data Model Extension

Extend `CommentsModel` / `Comment` interface:

```typescript
interface Comment {
  // Existing fields
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
  containedNodeIds?: string[];  // Empty = passive comment, populated = Smart Frame
  isCollapsed?: boolean;
  autoResize?: boolean;         // Default true for Smart Frames
}
```

### Implementation Approach

1. **Detection**: Check if `containedNodeIds` has items to determine behavior mode
2. **Adding nodes**: On node drag-end, check if position is inside any comment bounds; if so, add to `containedNodeIds`
3. **Removing nodes**: On node drag-start from inside a frame, if dragged outside bounds, remove from `containedNodeIds`
4. **Group movement**: When frame is moved, apply delta to all contained node positions
5. **Auto-resize**: After any contained node position/size change, recalculate frame bounds
6. **Collapse rendering**: When `isCollapsed`, render only title bar and calculate connection dots

### Files to Modify

```
packages/noodl-editor/src/editor/src/models/commentsmodel.ts
  - Add containedNodeIds, isCollapsed, autoResize to Comment interface
  - Add methods: addNodeToFrame(), removeNodeFromFrame(), toggleCollapse()

packages/noodl-editor/src/editor/src/views/CommentLayer/CommentLayerView.tsx
  - Handle collapsed rendering mode
  - Render connection dots for collapsed frames

packages/noodl-editor/src/editor/src/views/CommentLayer/CommentForeground.tsx
  - Add collapse/expand button to comment controls
  - Update resize behavior for Smart Frames

packages/noodl-editor/src/editor/src/views/CommentLayer/CommentBackground.tsx
  - Handle collapsed visual state

packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts
  - On node drag-end: check for frame containment
  - On node drag-start: handle removal from frame
  - On frame drag: move contained nodes
  - Subscribe to node size changes for auto-resize

packages/noodl-editor/src/editor/src/views/commentlayer.ts
  - Coordinate between CommentLayer and NodeGraphEditor for containment logic
```

### Files to Create

```
packages/noodl-editor/src/editor/src/views/CommentLayer/SmartFrameUtils.ts
  - isPointInFrame(point, frame): boolean
  - calculateFrameBounds(nodeIds, padding): Bounds
  - getConnectionDotsForCollapsedFrame(frame, connections): ConnectionDot[]
```

### Success Criteria

- [ ] Existing comment boxes work exactly as before (no behavioral change)
- [ ] Dragging a node into a comment box adds it to the frame
- [ ] Dragging a node out of a frame removes it
- [ ] Moving a Smart Frame moves all contained nodes
- [ ] Contained nodes expanding causes frame to grow
- [ ] Collapse button appears on Smart Frame controls
- [ ] Collapsed frame shows only title bar
- [ ] Connections to collapsed frame nodes render as dots on edge
- [ ] Empty Smart Frames revert to passive comments

---

## Feature 2: Canvas Navigation

### Description

A minimap overlay and jump-to navigation system for quickly moving around large canvases. Smart Frames automatically become navigation anchors.

### Capabilities

| Capability | Description |
|------------|-------------|
| Minimap toggle | Button in canvas toolbar to show/hide minimap |
| Minimap overlay | Small rectangle in corner showing frame locations |
| Viewport indicator | Rectangle showing current visible area |
| Click to navigate | Click anywhere on minimap to pan there |
| Frame list | Dropdown/list of all Smart Frames for quick jump |
| Keyboard shortcuts | Cmd+1..9 to jump to frames (in order of creation or position) |

### Minimap Design

```
┌──────────────────────────────────────────────────┐
│                                                  │
│                 [Main Canvas]                    │
│                                                  │
│                                           ┌─────┐│
│                                           │▪ A  ││
│                                           │  ▪B ││  ← Minimap
│                                           │ ┌─┐ ││  ← Viewport
│                                           │ └─┘ ││
│                                           │▪ C  ││
│                                           └─────┘│
└──────────────────────────────────────────────────┘
```

- Each `▪` represents a Smart Frame (labeled with first letter or number)
- `┌─┐` rectangle shows current viewport
- Colors could match frame colors

### Jump Menu

Accessible via:
- Toolbar button (dropdown)
- Keyboard shortcut (Cmd+J or Cmd+G for "go to")
- Right-click canvas → "Jump to..."

Shows list:
```
┌─────────────────────────┐
│ Jump to Frame           │
├─────────────────────────┤
│ 1. Login Flow          │
│ 2. Data Fetching       │
│ 3. Authentication      │
│ 4. Navigation Logic    │
└─────────────────────────┘
```

### Data Requirements

No new data model needed - reads from existing CommentsModel, filtering for Smart Frames (comments with `containedNodeIds.length > 0`).

### Implementation Approach

1. **Minimap component**: React component that subscribes to CommentsModel and NodeGraphEditor pan/scale
2. **Coordinate transformation**: Convert canvas coordinates to minimap coordinates
3. **Frame detection**: Filter comments to only show Smart Frames (have contained nodes)
4. **Click handling**: Transform minimap click to canvas coordinates, animate pan
5. **Jump menu**: Simple dropdown populated from Smart Frames list

### Files to Create

```
packages/noodl-editor/src/editor/src/views/CanvasNavigation/
├── CanvasNavigation.tsx      # Main container component
├── CanvasNavigation.module.scss
├── Minimap.tsx               # Minimap rendering
├── Minimap.module.scss
├── JumpMenu.tsx              # Frame list dropdown
└── index.ts
```

### Files to Modify

```
packages/noodl-editor/src/editor/src/views/documents/EditorDocument/EditorDocument.tsx
  - Add CanvasNavigation component to editor layout
  - Pass nodeGraph and commentsModel refs

packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts
  - Expose pan/scale state for minimap subscription
  - Add method: animatePanTo(x, y)

packages/noodl-editor/src/editor/src/utils/editorsettings.ts
  - Add setting: minimapVisible (boolean, default false)
```

### Success Criteria

- [ ] Minimap toggle button in canvas toolbar
- [ ] Minimap shows frame positions as colored dots/rectangles
- [ ] Minimap shows current viewport as rectangle
- [ ] Clicking minimap pans canvas to that location
- [ ] Jump menu lists all Smart Frames
- [ ] Selecting from jump menu pans to that frame
- [ ] Keyboard shortcuts (Cmd+1..9) jump to frames
- [ ] Minimap visibility persists in editor settings

---

## Feature 3: Vertical Snap + Push

### Description

A system for vertically aligning and attaching nodes so that when one expands, nodes below it push down automatically, maintaining spacing.

### Core Concept

Nodes can be **vertically attached** - think of it like a vertical stack. When the top node grows, everything below shifts down to maintain spacing.

```
Before expansion:          After expansion:
┌────────────┐             ┌────────────┐
│   Node A   │             │   Node A   │
└────────────┘             │  (grew)    │
      │                    │            │
      │ attached           └────────────┘
      ▼                          │
┌────────────┐                   │ attached
│   Node B   │                   ▼
└────────────┘             ┌────────────┐
      │                    │   Node B   │  ← pushed down
      │ attached           └────────────┘
      ▼                          │
┌────────────┐                   │ attached
│   Node C   │                   ▼
└────────────┘             ┌────────────┐
                           │   Node C   │  ← pushed down
                           └────────────┘
```

### Attachment Mechanics

**Creating attachments (proximity-based)**:

When dragging a node near another node's top or bottom edge:
- Visual indicator: Edge lights up (glow or highlight)
- On drop: If within threshold, attachment is created
- Attaching between existing attached nodes: New node slots into the chain

```
Dragging Node X near Node A's bottom:

┌────────────┐
│   Node A   │
└────────────┘ ← bottom edge glows
      
   [Node X]   ← being dragged

┌────────────┐
│   Node B   │
└────────────┘
```

**Inserting between attached nodes**:

If Node A → Node B are attached, and user drags Node X to the attachment point:
- Node X becomes: A → X → B
- All three remain attached

**Breaking attachments**:

- Context menu on node → "Detach from stack"
- Removes node from chain, remaining nodes close the gap
- Alternative: Drag node far enough away auto-detaches

### Alignment Guides (Supporting Feature)

Even without attachment, show alignment guides when dragging:
- Horizontal line appears when node edge aligns with another node's edge
- Helps manual alignment
- Standard behavior in design tools (Figma, Sketch)

### Data Model

Node attachments stored in NodeGraphModel or as a separate model:

```typescript
interface VerticalAttachment {
  topNodeId: string;
  bottomNodeId: string;
  spacing: number;  // Gap between nodes
}

// Or simpler - store on node itself:
interface NodeGraphNode {
  // ... existing fields
  attachedAbove?: string;  // ID of node this is attached below
  attachedBelow?: string;  // ID of node attached below this
}
```

### Implementation Approach

1. **Drag feedback**: During drag, check proximity to other node edges; show glow on nearby edges
2. **Drop handling**: On drop, check if within attachment threshold; create attachment
3. **Insert detection**: When dropping between attached nodes, insert into chain
4. **Push system**: Subscribe to node size changes; when node grows, recalculate attached node positions
5. **Detachment**: Context menu action; remove from chain and recalculate remaining chain positions
6. **Alignment guides**: During drag, find aligned edges and render guide lines

### Files to Modify

```
packages/noodl-editor/src/editor/src/models/nodegraphmodel.ts
  - Add attachment storage (or create separate AttachmentsModel)
  - Methods: createAttachment(), removeAttachment(), getAttachmentChain()

packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts
  - Drag feedback: detect edge proximity, render glow
  - Drop handling: create attachments
  - Size change subscription: trigger push recalculation
  - Paint alignment guides during drag

packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNode.ts
  - Add visual state for edge highlight (top/bottom edge glowing)
  - Expose edge positions for proximity detection

packages/noodl-editor/src/editor/src/views/NodePicker/NodePicker.utils.ts
  - Update createNodeFunction to not auto-attach on creation
```

### Files to Create

```
packages/noodl-editor/src/editor/src/models/attachmentsmodel.ts
  - Manages vertical attachment relationships
  - Methods for creating, breaking, querying attachments
  - Push calculation logic

packages/noodl-editor/src/editor/src/views/nodegrapheditor/AlignmentGuides.ts
  - Logic for detecting aligned edges
  - Guide line rendering
```

### Success Criteria

- [ ] Dragging node near another's top/bottom edge shows visual indicator
- [ ] Dropping on highlighted edge creates attachment
- [ ] Moving top node moves all attached nodes below
- [ ] Expanding node pushes attached nodes down
- [ ] Dropping between attached nodes inserts into chain
- [ ] Context menu "Detach from stack" removes node from chain
- [ ] Remaining chain nodes close gap after detachment
- [ ] Alignment guides appear when edges align (even without attachment)

---

## Feature 4: Connection Labels

### Description

Allow users to add text labels to connection lines to document data flow. Labels sit on the bezier curve and can be repositioned along the path.

### Interaction Design

**Adding a label**:
- Hover over a connection line
- Small icon appears (similar to existing X delete icon)
- Click icon → inline text input appears on the connection
- Type label, press Enter or click away to confirm

**Repositioning**:
- Click and drag existing label along the connection path
- Label stays anchored to the bezier curve

**Removing**:
- Click label → small X button appears → click to delete
- Or: clear text and confirm

### Visual Design

```
                    ┌─────────┐
┌────────┐         │ user ID │
│ Source │─────────┴─────────┴──────────►│ Target │
└────────┘                                └────────┘
                    ▲
              Connection label
              (positioned on curve)
```

Label styling:
- Small text (10-11px)
- Subtle background matching connection color (with transparency)
- Rounded corners
- Positioned centered on curve at specified t-value (0-1 along bezier)

### Data Model

Extend Connection model:

```typescript
interface Connection {
  // Existing fields
  fromId: string;
  fromProperty: string;
  toId: string;
  toProperty: string;
  
  // New field
  label?: {
    text: string;
    position: number;  // 0-1 along bezier curve, default 0.5
  };
}
```

### Implementation Approach

1. **Hover detection**: Use existing connection hit-testing; on hover, show add-label icon
2. **Icon positioning**: Calculate midpoint of bezier curve for icon placement
3. **Add label UI**: On icon click, render inline input at curve position
4. **Label rendering**: Render labels as part of connection paint cycle
5. **Bezier math**: Calculate point on curve at t-value for label positioning
6. **Drag repositioning**: On label drag, calculate nearest t-value to mouse position

### Bezier Curve Math

For a cubic bezier with control points P0, P1, P2, P3:
```
B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
```

Need functions:
- `getPointOnCurve(t)`: Returns {x, y} at position t
- `getNearestT(point)`: Returns t value for nearest point on curve to given point

### Files to Modify

```
packages/noodl-editor/src/editor/src/models/nodegraphmodel.ts
  - Extend Connection interface with label field
  - Methods: setConnectionLabel(), removeConnectionLabel()

packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts
  - Add label rendering in paint()
  - Add hover state for showing add-label icon
  - Handle label drag for repositioning

packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts
  - Handle click on add-label icon
  - Render inline input for label editing
  - Handle label click for editing/deletion
```

### Files to Create

```
packages/noodl-editor/src/editor/src/views/nodegrapheditor/ConnectionLabel.ts
  - Label rendering logic
  - Position calculation
  - Edit mode handling

packages/noodl-editor/src/editor/src/utils/bezier.ts
  - getPointOnCubicBezier(t, p0, p1, p2, p3): Point
  - getNearestTOnCubicBezier(point, p0, p1, p2, p3): number
  - getCubicBezierLength(p0, p1, p2, p3): number (for spacing)
```

### Success Criteria

- [ ] Hovering connection shows add-label icon at midpoint
- [ ] Clicking icon opens inline text input
- [ ] Typing and confirming creates label on connection
- [ ] Label renders on the bezier curve path
- [ ] Label can be dragged along the curve
- [ ] Clicking label allows editing text
- [ ] Label can be deleted (clear text or X button)
- [ ] Labels persist when project is saved/loaded

---

## Implementation Order

### Phase 1: Smart Frames (16-24 hours)
Foundation for navigation; highest impact feature.

**Sessions**:
1. Data model extension + basic containment logic
2. Drag-in/drag-out behavior
3. Group movement on frame drag
4. Auto-resize on node changes
5. Collapse UI and basic collapsed state
6. Collapsed connection dots rendering
7. Testing and edge cases

### Phase 2: Canvas Navigation (8-12 hours)
Depends on Smart Frames for anchor points.

**Sessions**:
1. Minimap component structure
2. Coordinate transformation and frame rendering
3. Click-to-navigate and viewport indicator
4. Jump menu dropdown
5. Keyboard shortcuts
6. Settings persistence

### Phase 3: Vertical Snap + Push (12-16 hours)
Independent; can be done in parallel after Phase 1 starts.

**Sessions**:
1. Attachment data model
2. Edge proximity detection and visual feedback
3. Attachment creation on drop
4. Push calculation on node resize
5. Insert-between-attached logic
6. Detachment via context menu
7. Alignment guides (bonus)

### Phase 4: Connection Labels (10-14 hours)
Most technically isolated; can be done anytime.

**Sessions**:
1. Bezier utility functions
2. Connection hover state and add-icon
3. Inline label input
4. Label rendering on curve
5. Label drag repositioning
6. Edit and delete functionality

---

## Testing Checklist

### Smart Frames
- [ ] Load legacy project with comments → comments work unchanged
- [ ] Drag node into empty comment → comment becomes Smart Frame
- [ ] Drag all nodes out → Smart Frame reverts to comment
- [ ] Move Smart Frame → contained nodes move
- [ ] Resize contained node → frame auto-resizes
- [ ] Collapse frame → only title visible, connections as dots
- [ ] Expand frame → contents visible again
- [ ] Create connection to collapsed frame node → dot visible
- [ ] Delete frame → contained nodes remain (orphaned)
- [ ] Undo/redo all operations

### Canvas Navigation
- [ ] Toggle minimap visibility
- [ ] Minimap shows all Smart Frames
- [ ] Minimap shows viewport rectangle
- [ ] Click minimap → canvas pans
- [ ] Open jump menu → lists Smart Frames
- [ ] Select from jump menu → canvas pans to frame
- [ ] Keyboard shortcut → jumps to frame
- [ ] Close and reopen editor → minimap setting persists

### Vertical Snap + Push
- [ ] Drag node near another's bottom edge → edge highlights
- [ ] Drop on highlighted edge → attachment created
- [ ] Move top node → attached nodes move
- [ ] Resize top node → attached nodes push down
- [ ] Drag node to attachment point between two attached → inserts
- [ ] Context menu detach → node removed, others close gap
- [ ] Alignment guides show when edges align

### Connection Labels
- [ ] Hover connection → icon appears
- [ ] Click icon → input appears
- [ ] Type and confirm → label shows on curve
- [ ] Drag label → moves along curve
- [ ] Click label → can edit
- [ ] Clear text or delete → label removed
- [ ] Save and reload → labels persist

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Smart Frame collapse complex | Medium | High | Start with simple collapse (hide contents), add connection dots later |
| Bezier math for labels | Low | Medium | Well-documented algorithms; can use library if needed |
| Performance with many frames | Low | Medium | Lazy render off-screen frames; throttle minimap updates |
| Undo/redo complexity | Medium | High | Leverage existing UndoActionGroup pattern; test thoroughly |
| Backward compatibility breaks | Low | Critical | Extensive testing with legacy projects; containedNodeIds default undefined |

---

## Open Questions

1. **Frame nesting**: Should Smart Frames be nestable? (Recommendation: No, keep simple for v1)
2. **Frame-to-frame connections**: If a collapsed frame has connections to another collapsed frame, how to render? (Recommendation: Just show frame edge dots on both)
3. **Attachment and frames**: If an attached stack is inside a frame, should attachments be frame-local? (Recommendation: Yes, attachments are independent of frames)
4. **Label character limit**: Should labels have max length? (Recommendation: Yes, ~50 chars to prevent visual clutter)

---

## Success Metrics

Post-implementation, measure:
- **Adoption rate**: % of projects using Smart Frames after 30 days
- **Navigation usage**: How often minimap/jump menu is used per session
- **Canvas cleanup**: User feedback on organization improvements
- **Performance**: Frame rates with 50+ nodes and multiple Smart Frames

---

## References

### Existing Code

- `packages/noodl-editor/src/editor/src/views/CommentLayer/` - Comment system
- `packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts` - Main canvas
- `packages/noodl-editor/src/editor/src/models/commentsmodel.ts` - Comment data model
- `packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts` - Connection rendering

### Design Inspiration

- Figma: Frame containment, alignment guides, minimap
- Miro: Frames and navigation
- Unreal Blueprints: Comment boxes, reroute nodes
- TouchDesigner: Collapsed containers
