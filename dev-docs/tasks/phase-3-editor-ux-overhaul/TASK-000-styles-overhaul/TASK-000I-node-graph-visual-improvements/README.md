# TASK-000I: Node Graph Visual Improvements

## Overview

Modernize the visual appearance of the node graph canvas, add a node comments system, and improve port label handling. This is a high-impact visual refresh that maintains backward compatibility while significantly improving the user experience for complex node graphs.

**Phase:** 3 (Visual Improvements)  
**Priority:** High  
**Estimated Time:** 35-50 hours total  
**Risk Level:** Low-Medium

---

## Background

The node graph is the heart of OpenNoodl's visual programming experience. While functionally solid, the current visual design shows its age:

- Nodes have sharp corners and flat colors that feel dated
- No way to attach documentation/comments to individual nodes
- Port labels overflow on nodes with many connections
- Dense nodes (Object, State, Function) become hard to read

This task addresses these pain points through three sub-tasks that can be implemented incrementally.

### Current Architecture

The node graph uses a **hybrid rendering approach**:

1. **HTML5 Canvas** (`NodeGraphEditorNode.ts`) - Renders:

   - Node backgrounds via `ctx.fillRect()`
   - Borders via `ctx.rect()` and `ctx.strokeRect()`
   - Port indicators (dots/arrows) via `ctx.arc()` and triangle paths
   - Connection lines via bezier curves
   - Text labels via `ctx.fillText()`

2. **DOM Layer** (`domElementContainer`) - Renders:

   - Comment layer (existing, React-based)
   - Some overlays and tooltips

3. **Color System** - Node colors come from:
   - `NodeLibrary.instance.colorSchemeForNodeType()`
   - Maps to CSS variables in `colors.css`
   - Already abstracted - we can update colors without touching Canvas code

### Key Files

```
packages/noodl-editor/src/editor/src/views/
├── nodegrapheditor.ts                    # Main editor, paint loop
├── nodegrapheditor/
│   ├── NodeGraphEditorNode.ts            # Node rendering (PRIMARY TARGET)
│   ├── NodeGraphEditorConnection.ts      # Connection line rendering
│   └── ...
├── commentlayer.ts                       # Existing comment system

packages/noodl-core-ui/src/styles/custom-properties/
├── colors.css                            # Design tokens (color updates)

packages/noodl-editor/src/editor/src/models/
├── nodegraphmodel/NodeGraphNode.ts       # Node data model (metadata storage)
├── nodelibrary/                          # Node type definitions, port groups
```

---

## Sub-Tasks

### Sub-Task A: Visual Polish (8-12 hours)

Modernize node appearance without changing functionality.

### Sub-Task B: Node Comments System (12-18 hours)

Add ability to attach documentation to individual nodes.

### Sub-Task C: Port Organization & Smart Connections (15-20 hours)

Improve port label handling and add connection preview on hover.

---

## Sub-Task A: Visual Polish

### Scope

1. **Rounded corners** on all node rectangles
2. **Updated color palette** following design system
3. **Refined connection points** (port dots/arrows)
4. **Port label truncation** with ellipsis for overflow

### Implementation

#### A1: Rounded Corners (2-3 hours)

**Current code** in `NodeGraphEditorNode.ts`:

```typescript
// Background
ctx.fillRect(x, y, this.nodeSize.width, this.nodeSize.height);

// Border
ctx.rect(x, y, this.nodeSize.width, this.nodeSize.height);
```

**New approach** - Create helper function:

```typescript
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius); // Native Canvas API
  ctx.closePath();
}
```

**Apply to:**

- Node background fill
- Node border stroke
- Selection highlight
- Error/annotation borders
- Title bar area (top corners only, or clip)

**Radius recommendation:** 6-8px for nodes, 4px for smaller elements

#### A2: Color Palette Update (2-3 hours)

Update CSS variables in `colors.css` to use more modern, saturated colors while maintaining the existing semantic meanings:

| Node Type          | Current      | Proposed Direction               |
| ------------------ | ------------ | -------------------------------- |
| Data (green)       | Olive/muted  | Richer emerald green             |
| Visual (blue)      | Muted blue   | Cleaner slate blue               |
| Logic (grey)       | Flat grey    | Warmer charcoal with subtle tint |
| Custom (pink)      | Magenta-pink | Refined rose/coral               |
| Component (purple) | Muted purple | Cleaner violet                   |

**Also update:**

- `--theme-color-signal` (connection lines)
- `--theme-color-data` (connection lines)
- Background contrast between header and body

**Constraint:** Keep changes within design system tokens, ensure sufficient contrast.

#### A3: Connection Point Styling (2-3 hours)

Current port indicators are simple:

- **Dots** (`ctx.arc`) for data sources
- **Triangles** (manual path) for signals/targets

**Improvements:**

- Slightly larger hit areas (currently 4px radius)
- Subtle inner highlight or ring effect
- Smoother anti-aliasing
- Consider pill-shaped indicators for "connected" state

**Files:** `NodeGraphEditorNode.ts` - `drawPlugs()` function

#### A4: Port Label Truncation (2-3 hours)

**Problem:** Long port names overflow the node boundary.

**Solution:**

```typescript
function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  const ellipsis = '…';
  let truncated = text;

  while (ctx.measureText(truncated + ellipsis).width > maxWidth && truncated.length > 0) {
    truncated = truncated.slice(0, -1);
  }

  return truncated.length < text.length ? truncated + ellipsis : text;
}
```

**Apply in** `drawPlugs()` before `ctx.fillText()`.

**Tooltip:** Full port name should show on hover (existing tooltip system).

### Success Criteria - Sub-Task A

- [ ] All nodes render with rounded corners (radius configurable)
- [ ] Color palette updated, passes contrast checks
- [ ] Connection points are visually refined
- [ ] Long port labels truncate with ellipsis
- [ ] Full port name visible on hover
- [ ] No visual regressions in existing projects
- [ ] Performance unchanged (canvas render time)

---

## Sub-Task B: Node Comments System

### Scope

Allow users to attach plain-text comments to any node, with:

- Small indicator icon when comment exists
- Hover preview (debounced to avoid bombardment)
- Click to open edit modal
- Comments persist with project

### Design Decisions

**Storage:** `node.metadata.comment: string`

- Already have `metadata` object on NodeGraphNode
- Persists with project JSON
- No schema changes needed

**UI Pattern:** Icon + Hover Preview + Modal

- Comment icon in title bar (only shows if comment exists OR on hover)
- Hover over icon shows preview tooltip (300ms delay)
- Click opens sticky modal for editing
- Modal can be dragged, stays open while working

**Why not inline expansion?**

- Would affect node measurement/layout calculations
- Creates cascade effects on connections
- More invasive to existing code

### Implementation

#### B1: Data Layer (1-2 hours)

**Add to `NodeGraphNode.ts`:**

```typescript
// In metadata interface
interface NodeMetadata {
  // ... existing fields
  comment?: string;
}

// Helper methods
getComment(): string | undefined {
  return this.metadata?.comment;
}

setComment(comment: string | undefined, args?: { undo?: boolean }) {
  if (!this.metadata) this.metadata = {};

  const oldComment = this.metadata.comment;
  this.metadata.comment = comment || undefined; // Remove if empty

  this.notifyListeners('commentChanged', { comment });

  if (args?.undo) {
    UndoQueue.instance.push({
      label: 'Edit comment',
      do: () => this.setComment(comment),
      undo: () => this.setComment(oldComment)
    });
  }
}

hasComment(): boolean {
  return !!this.metadata?.comment?.trim();
}
```

#### B2: Comment Icon Rendering (2-3 hours)

**In `NodeGraphEditorNode.ts` paint function:**

```typescript
// After drawing title, before drawing ports
if (this.model.hasComment() || this.isHovered) {
  this.drawCommentIcon(ctx, x, y, titlebarHeight);
}

private drawCommentIcon(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  titlebarHeight: number
) {
  const iconX = x + this.nodeSize.width - 24; // Right side of title
  const iconY = y + titlebarHeight / 2;
  const hasComment = this.model.hasComment();

  ctx.save();
  ctx.globalAlpha = hasComment ? 1 : 0.4;
  ctx.fillStyle = hasComment ? '#ffffff' : nc.text;

  // Draw speech bubble icon (simple path or loaded SVG)
  // ... icon drawing code

  ctx.restore();

  // Store hit area for click detection
  this.commentIconBounds = { x: iconX - 8, y: iconY - 8, width: 16, height: 16 };
}
```

#### B3: Hover Preview (3-4 hours)

**Requirements:**

- 300ms delay before showing (avoid bombardment on pan/scroll)
- Cancel if mouse leaves before delay
- Position near node but not obscuring it
- Max width ~250px, max height ~150px with scroll

**Implementation approach:**

- Track mouse position in `NodeGraphEditorNode.handleMouseEvent`
- Use `setTimeout` with cleanup for debounce
- Render preview using existing `PopupLayer.showTooltip()` or custom

```typescript
// In handleMouseEvent, on 'move-in' to comment icon area:
this.commentPreviewTimer = setTimeout(() => {
  if (this.model.hasComment()) {
    PopupLayer.instance.showTooltip({
      content: this.model.getComment(),
      position: { x: iconX, y: iconY + 20 },
      maxWidth: 250
    });
  }
}, 300);

// On 'move-out':
clearTimeout(this.commentPreviewTimer);
PopupLayer.instance.hideTooltip();
```

#### B4: Edit Modal (4-6 hours)

**Create new component:** `NodeCommentEditor.tsx`

```typescript
interface NodeCommentEditorProps {
  node: NodeGraphNode;
  initialPosition: { x: number; y: number };
  onClose: () => void;
}

export function NodeCommentEditor({ node, initialPosition, onClose }: NodeCommentEditorProps) {
  const [comment, setComment] = useState(node.getComment() || '');
  const [position, setPosition] = useState(initialPosition);

  const handleSave = () => {
    node.setComment(comment.trim() || undefined, { undo: true });
    onClose();
  };

  return (
    <Draggable position={position} onDrag={setPosition}>
      <div className={styles.CommentEditor}>
        <div className={styles.Header}>
          <span>Comment: {node.label}</span>
          <button onClick={onClose}>×</button>
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add a comment to document this node..."
          autoFocus
        />
        <div className={styles.Footer}>
          <button onClick={handleSave}>Save</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Draggable>
  );
}
```

**Styling:**

- Dark theme matching editor
- ~300px wide, resizable
- Draggable header
- Save on Cmd+Enter

**Integration:**

- Open via `PopupLayer` or dedicated overlay
- Track open editors to prevent duplicates
- Close on Escape

#### B5: Click Handler Integration (2-3 hours)

**In `NodeGraphEditorNode.handleMouseEvent`:**

```typescript
case 'up':
  if (this.isClickInCommentIcon(evt)) {
    this.owner.openCommentEditor(this);
    return; // Don't process as node selection
  }
  // ... existing click handling
```

**In `NodeGraphEditor`:**

```typescript
openCommentEditor(node: NodeGraphEditorNode) {
  const screenPos = this.canvasToScreen(node.global.x, node.global.y);

  PopupLayer.instance.showPopup({
    content: NodeCommentEditor,
    props: {
      node: node.model,
      initialPosition: { x: screenPos.x + node.nodeSize.width + 20, y: screenPos.y }
    },
    modal: false, // Allow interaction with canvas
    closeOnOutsideClick: false
  });
}
```

### Success Criteria - Sub-Task B

- [ ] Comments stored in node.metadata.comment
- [ ] Icon visible on nodes with comments
- [ ] Icon appears on hover for nodes without comments
- [ ] Hover preview shows after 300ms delay
- [ ] No preview bombardment when scrolling/panning
- [ ] Click opens editable modal
- [ ] Modal is draggable, stays open
- [ ] Save with Cmd+Enter, cancel with Escape
- [ ] Undo/redo works for comment changes
- [ ] Comments persist when project saved/loaded
- [ ] Comments included in copy/paste of nodes
- [ ] Comments visible in exported project (or gracefully ignored)

---

## Sub-Task C: Port Organization & Smart Connections

### Scope

1. **Port grouping system** for nodes with many ports
2. **Type icons** for ports (classy, minimal)
3. **Connection preview on hover** - highlight compatible ports

### Implementation

#### C1: Port Grouping System (6-8 hours)

**The challenge:** How do we define which ports belong to which group?

**Proposed solution:** Define groups in node type definitions.

**In node type registration:**

```typescript
{
  name: 'net.noodl.httpnode',
  displayName: 'HTTP Request',
  // ... existing config

  portGroups: [
    {
      name: 'Request',
      ports: ['url', 'method', 'body', 'headers-*'],  // Wildcard for dynamic ports
      defaultExpanded: true
    },
    {
      name: 'Response',
      ports: ['status', 'response', 'headers'],
      defaultExpanded: true
    },
    {
      name: 'Events',
      ports: ['send', 'success', 'failure'],
      defaultExpanded: true
    }
  ]
}
```

**For nodes without explicit groups:** Auto-group by:

- Signal ports (Run, Do, Done, Success, Failure)
- Data inputs
- Data outputs

**Rendering changes in `NodeGraphEditorNode.ts`:**

```typescript
interface PortGroup {
  name: string;
  ports: PlugInfo[];
  expanded: boolean;
  y: number; // Calculated position
}

private portGroups: PortGroup[] = [];

measure() {
  // Build groups from node type config or auto-detect
  this.portGroups = this.buildPortGroups();

  // Calculate height based on expanded groups
  let height = this.titlebarHeight();
  for (const group of this.portGroups) {
    height += GROUP_HEADER_HEIGHT;
    if (group.expanded) {
      height += group.ports.length * NodeGraphEditorNode.propertyConnectionHeight;
    }
  }

  this.nodeSize.height = height;
  // ...
}

private drawPortGroups(ctx: CanvasRenderingContext2D) {
  let y = this.titlebarHeight();

  for (const group of this.portGroups) {
    // Draw group header with expand/collapse arrow
    this.drawGroupHeader(ctx, group, y);
    y += GROUP_HEADER_HEIGHT;

    if (group.expanded) {
      for (const port of group.ports) {
        this.drawPort(ctx, port, y);
        y += NodeGraphEditorNode.propertyConnectionHeight;
      }
    }
  }
}
```

**Group header click handling:**

- Click toggles expanded state
- State stored in view (not model) - doesn't persist

**Fallback:** Nodes without groups render exactly as before (flat list).

#### C2: Port Type Icons (4-6 hours)

**Design principle:** Minimal, monochrome, recognizable at small sizes.

**Icon set (12x12px or smaller):**
| Type | Icon | Description |
|------|------|-------------|
| Signal | `⚡` or lightning bolt | Trigger/event |
| String | `T` or `""` | Text data |
| Number | `#` | Numeric data |
| Boolean | `◐` | True/false (half-filled circle) |
| Object | `{ }` | Object/record |
| Array | `[ ]` | List/collection |
| Color | `◉` | Filled circle (could show actual color) |
| Any | `◇` | Diamond (accepts anything) |

**Implementation:**

- Create SVG icons, convert to Canvas-drawable paths
- Or use a minimal icon font
- Draw before/instead of colored dot

```typescript
private drawPortIcon(
  ctx: CanvasRenderingContext2D,
  type: string,
  x: number, y: number,
  connected: boolean
) {
  const icon = PORT_TYPE_ICONS[type] || PORT_TYPE_ICONS.any;

  ctx.save();
  ctx.fillStyle = connected ? connectionColor : '#666';
  ctx.font = '10px Inter-Regular';
  ctx.fillText(icon.char, x, y);
  ctx.restore();
}
```

**Alternative:** Small inline SVG paths drawn with Canvas path commands.

#### C3: Connection Preview on Hover (5-6 hours)

**Behavior:**

1. User hovers over an output port
2. All compatible input ports on other nodes highlight
3. Incompatible ports dim or show "incompatible" indicator
4. Works in reverse (hover input, show compatible outputs)

**Implementation:**

```typescript
// In NodeGraphEditor
private highlightedPort: { node: NodeGraphEditorNode; port: string; side: 'input' | 'output' } | null = null;

setHighlightedPort(node: NodeGraphEditorNode, portName: string, side: 'input' | 'output') {
  this.highlightedPort = { node, port: portName, side };
  this.repaint();
}

clearHighlightedPort() {
  this.highlightedPort = null;
  this.repaint();
}

// In paint loop, for each node's ports:
if (this.highlightedPort) {
  const compatibility = this.getPortCompatibility(
    this.highlightedPort,
    currentNode,
    currentPort
  );

  if (compatibility === 'compatible') {
    // Draw with highlight glow
  } else if (compatibility === 'incompatible') {
    // Draw dimmed
  }
  // 'source' = this is the hovered port, draw normal
}

getPortCompatibility(source, targetNode, targetPort): 'compatible' | 'incompatible' | 'source' {
  if (source.node === targetNode && source.port === targetPort) {
    return 'source';
  }

  // Can't connect to same node
  if (source.node === targetNode) {
    return 'incompatible';
  }

  // Check type compatibility
  const sourceType = source.node.model.getPort(source.port)?.type;
  const targetType = targetNode.model.getPort(targetPort)?.type;

  return NodeLibrary.instance.canConnect(sourceType, targetType)
    ? 'compatible'
    : 'incompatible';
}
```

**Visual treatment:**

- Compatible: Subtle pulse/glow animation, brighter color
- Incompatible: 50% opacity, greyed out
- Draw connection preview line from source to mouse cursor

### Success Criteria - Sub-Task C

- [ ] Port groups configurable in node type definitions
- [ ] Auto-grouping fallback for unconfigured nodes
- [ ] Groups collapsible with click
- [ ] Group state doesn't affect existing projects
- [ ] Port type icons render clearly at small sizes
- [ ] Icons follow design system (not emoji-style)
- [ ] Hovering output port highlights compatible inputs
- [ ] Hovering input port highlights compatible outputs
- [ ] Incompatible ports visually dimmed
- [ ] Preview works during connection drag
- [ ] Performance acceptable with many nodes visible

---

## Files to Create

```
packages/noodl-editor/src/editor/src/views/
├── nodegrapheditor/
│   ├── NodeCommentEditor.tsx           # Comment edit modal
│   ├── NodeCommentEditor.module.scss   # Styles
│   ├── canvasHelpers.ts                # roundRect, truncateText utilities
│   └── portIcons.ts                    # SVG paths for port type icons
```

## Files to Modify

```
packages/noodl-editor/src/editor/src/views/
├── nodegrapheditor.ts                  # Connection preview logic
├── nodegrapheditor/
│   ├── NodeGraphEditorNode.ts          # PRIMARY: All rendering changes
│   └── NodeGraphEditorConnection.ts    # Minor: Updated colors

packages/noodl-editor/src/editor/src/models/
├── nodegraphmodel/NodeGraphNode.ts     # Comment storage methods

packages/noodl-core-ui/src/styles/custom-properties/
├── colors.css                          # Updated palette

packages/noodl-editor/src/editor/src/models/
├── nodelibrary/index.ts                # Port group definitions
```

---

## Testing Checklist

### Visual Polish

- [ ] Rounded corners render correctly at all zoom levels
- [ ] Colors match design system, sufficient contrast
- [ ] Connection points visible and clickable
- [ ] Truncated labels show tooltip on hover
- [ ] Selection/error states still visible with new styling

### Node Comments

- [ ] Create comment on node without existing comment
- [ ] Edit existing comment
- [ ] Delete comment (clear text)
- [ ] Undo/redo comment changes
- [ ] Comment persists after save/reload
- [ ] Comment included when copying node
- [ ] Hover preview appears after delay
- [ ] No preview spam when panning quickly
- [ ] Modal draggable and stays open
- [ ] Multiple comment modals can be open

### Port Organization

- [ ] Grouped ports render correctly
- [ ] Ungrouped nodes unchanged
- [ ] Collapse/expand works
- [ ] Node height adjusts correctly
- [ ] Connections still work with grouped ports
- [ ] Port icons render at all zoom levels
- [ ] Connection preview highlights correct ports
- [ ] Performance acceptable with 50+ visible nodes

### Regression Testing

- [ ] Open existing complex project
- [ ] All nodes render correctly
- [ ] All connections intact
- [ ] Copy/paste works
- [ ] Undo/redo works
- [ ] No console errors

---

## Risks & Mitigations

| Risk                                        | Likelihood | Impact | Mitigation                                        |
| ------------------------------------------- | ---------- | ------ | ------------------------------------------------- |
| Performance regression with rounded corners | Low        | Medium | Profile canvas render time, optimize path caching |
| Port grouping breaks connection logic       | Medium     | High   | Extensive testing, feature flag for rollback      |
| Comment data loss on export                 | Low        | High   | Verify metadata included in all export paths      |
| Hover preview annoying                      | Medium     | Low    | Configurable delay, easy to disable               |
| Color changes controversial                 | Medium     | Low    | Document old colors, provide theme option         |

---

## Dependencies

**Blocked by:** None

**Blocks:** None (standalone visual improvements)

**Related:**

- Phase 3 design system work (colors should align)
- Future node editor enhancements

---

## Future Enhancements (Out of Scope)

- Markdown support in comments
- Comment search/filter
- Comment export to documentation
- Custom node colors per-instance
- Animated connections
- Minimap improvements
- Node grouping/frames (separate feature)

---

## References

- Current node rendering: `NodeGraphEditorNode.ts` paint() method
- Color system: `colors.css` and `NodeLibrary.colorSchemeForNodeType()`
- Existing comment layer: `commentlayer.ts` (for patterns, not reuse)
- Canvas roundRect API: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/roundRect
