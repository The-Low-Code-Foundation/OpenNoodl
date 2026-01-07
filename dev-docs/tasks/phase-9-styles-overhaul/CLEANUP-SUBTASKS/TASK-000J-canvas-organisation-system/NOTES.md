# TASK-000J Working Notes

## Quick Reference

### Key Files

```
Comment System:
├── models/commentsmodel.ts              # Data model
├── views/CommentLayer/CommentLayerView.tsx  # React rendering
├── views/CommentLayer/CommentForeground.tsx # Interactive layer
├── views/CommentLayer/CommentBackground.tsx # Background rendering
└── views/commentlayer.ts                # Layer coordinator

Node Graph:
├── views/nodegrapheditor.ts             # Main canvas controller
├── views/nodegrapheditor/NodeGraphEditorNode.ts  # Node rendering
└── views/nodegrapheditor/NodeGraphEditorConnection.ts # Connection rendering

Editor:
├── views/documents/EditorDocument/EditorDocument.tsx  # Main editor
└── utils/editorsettings.ts              # Persistent settings
```

### Useful Patterns in Codebase

**Subscribing to model changes:**
```typescript
CommentsModel.on('commentsChanged', () => {
  this._renderReact();
}, this);
```

**Node graph coordinate transforms:**
```typescript
// Screen to canvas
const canvasPos = this.relativeCoordsToNodeGraphCords(screenPos);

// Canvas to screen
const screenPos = this.nodeGraphCordsToRelativeCoords(canvasPos);
```

**Existing hit-testing:**
```typescript
// Check if point hits a node
forEachNode((node) => {
  if (node.isHit(pos)) { ... }
});

// Check if point hits a connection
// See NodeGraphEditorConnection.isHit()
```

---

## Implementation Notes

### Phase 1: Smart Frames

#### Session 1.1 Notes
_Add notes here during implementation_

**Things discovered:**
- 

**Questions to resolve:**
- 

**Code snippets to remember:**
```typescript

```

#### Session 1.2 Notes
_Add notes here_

#### Session 1.3 Notes
_Add notes here_

#### Session 1.4 Notes
_Add notes here_

#### Session 1.5 Notes
_Add notes here_

#### Session 1.6 Notes
_Add notes here_

#### Session 1.7 Notes
_Add notes here_

#### Session 1.8 Notes
_Add notes here_

---

### Phase 2: Canvas Navigation

#### Session 2.1 Notes
_Add notes here_

#### Session 2.2 Notes
_Add notes here_

#### Session 2.3 Notes
_Add notes here_

#### Session 2.4 Notes
_Add notes here_

#### Session 2.5 Notes
_Add notes here_

---

### Phase 3: Vertical Snap + Push

#### Session 3.1 Notes
_Add notes here_

#### Session 3.2 Notes
_Add notes here_

#### Session 3.3 Notes
_Add notes here_

#### Session 3.4 Notes
_Add notes here_

#### Session 3.5 Notes
_Add notes here_

#### Session 3.6 Notes
_Add notes here_

#### Session 3.7 Notes
_Add notes here_

---

### Phase 4: Connection Labels

#### Session 4.1 Notes
_Add notes here_

**Bezier math resources:**
- https://pomax.github.io/bezierinfo/
- De Casteljau's algorithm for point on curve
- Newton-Raphson for nearest point

#### Session 4.2 Notes
_Add notes here_

#### Session 4.3 Notes
_Add notes here_

#### Session 4.4 Notes
_Add notes here_

#### Session 4.5 Notes
_Add notes here_

#### Session 4.6 Notes
_Add notes here_

---

## Debugging Tips

### Smart Frame Issues

**Frame not detecting node:**
- Check `isPointInFrame()` bounds calculation
- Log frame bounds vs node position
- Verify padding is accounted for

**Nodes not moving with frame:**
- Verify `containedNodeIds` is populated
- Check if node IDs match
- Log delta calculation

**Auto-resize not working:**
- Check subscription to node changes
- Verify `calculateFrameBounds()` returns correct values
- Check minimum size constraints

### Navigation Issues

**Minimap not showing frames:**
- Verify CommentsModel subscription
- Check filter for Smart Frames (containedNodeIds.length > 0)
- Log frame positions being rendered

**Click navigation incorrect:**
- Log coordinate transformation
- Verify minimap scale factor
- Check canvas bounds calculation

### Attachment Issues

**Attachment not creating:**
- Log edge proximity values
- Verify threshold constant
- Check for existing attachments blocking

**Push not working:**
- Log size change subscription
- Verify attachment chain lookup
- Check for circular dependencies

### Connection Label Issues

**Label not rendering:**
- Verify `label` field on connection
- Check bezier position calculation
- Log paint() being called

**Label position wrong:**
- Verify control points passed to bezier function
- Log t-value and resulting point
- Check canvas transform

---

## Performance Considerations

### Smart Frames

- Don't recalculate bounds on every frame during drag
- Throttle auto-resize updates
- Consider virtualizing nodes in very large frames

### Minimap

- Don't re-render on every pan/zoom
- Use requestAnimationFrame for smooth updates
- Consider canvas rendering vs DOM for many frames

### Attachments

- Cache attachment chains
- Invalidate cache only on attachment changes
- Avoid recalculating during animations

### Labels

- Cache bezier calculations
- Don't hit-test labels that are off-screen
- Consider label culling at low zoom levels

---

## Test Scenarios

### Edge Cases to Test

1. **Nested geometry** - Frame inside frame (even if not supported, shouldn't crash)
2. **Circular attachments** - A→B→C→A (should be prevented)
3. **Deleted references** - Node deleted while in frame/attachment
4. **Empty states** - Canvas with no nodes, frame with no nodes
5. **Extreme zoom** - Labels at 0.1x and 1x zoom
6. **Large data** - 100+ nodes, 20+ frames
7. **Undo stack** - Complex sequence of operations then undo all
8. **Copy/paste** - Frame with nodes, attached chain, labeled connections
9. **Project reload** - All state persists correctly

### User Workflows to Test

1. **Gradual adoption** - Load old project, start using Smart Frames
2. **Organize existing** - Take messy canvas, organize with frames
3. **Navigate complex** - Jump between distant frames
4. **Document flow** - Add labels to explain data path
5. **Refactor** - Move nodes between frames
6. **Expand/collapse** - Work with collapsed frames

---

## Helpful Snippets

### Get all nodes in a bounding box

```typescript
const nodesInBounds = [];
this.forEachNode((node) => {
  const nodeBounds = {
    x: node.global.x,
    y: node.global.y,
    width: node.nodeSize.width,
    height: node.nodeSize.height
  };
  if (boundsOverlap(nodeBounds, targetBounds)) {
    nodesInBounds.push(node);
  }
});
```

### Calculate point on cubic bezier

```typescript
function getPointOnCubicBezier(t, p0, p1, p2, p3) {
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
```

### Render guide line

```typescript
ctx.save();
ctx.strokeStyle = '#3b82f6';
ctx.lineWidth = 1;
ctx.setLineDash([5, 5]);
ctx.beginPath();
ctx.moveTo(0, guideY);
ctx.lineTo(canvasWidth, guideY);
ctx.stroke();
ctx.restore();
```

---

## Questions for Review

_Add questions to ask during code review_

1. 
2. 
3. 

---

## Future Improvements

_Ideas for follow-up work (out of scope for this task)_

- [ ] Frame templates (pre-populated with common node patterns)
- [ ] Smart routing for connections (avoid crossing frames)
- [ ] Frame-level undo (undo all changes within a frame)
- [ ] Export frame as component (auto-componentize)
- [ ] Frame documentation export (generate docs from labels)
- [ ] Collaborative frame locking (multi-user editing)
