# TASK-009I-B: Node Comments System

**Parent Task:** TASK-000I Node Graph Visual Improvements  
**Estimated Time:** 12-18 hours  
**Risk Level:** Medium  
**Dependencies:** None (can be done in parallel with A)

---

## Objective

Allow users to attach plain-text documentation to individual nodes, making it easier to understand and maintain complex node graphs, especially when picking up someone else's project.

---

## Scope

1. **Data storage** - Comments stored in node metadata
2. **Visual indicator** - Icon shows when node has comment
3. **Hover preview** - Quick preview with debounce (no spam)
4. **Edit modal** - Draggable editor for writing comments
5. **Persistence** - Comments save with project

### Out of Scope

- Markdown formatting
- Rich text
- Comment threading/replies
- Search across comments
- Character limits

---

## Design Decisions

| Decision         | Choice                  | Rationale                                            |
| ---------------- | ----------------------- | ---------------------------------------------------- |
| Storage location | `node.metadata.comment` | Existing structure, persists automatically           |
| Preview trigger  | Hover with 300ms delay  | Balance between accessible and not annoying          |
| Edit trigger     | Click on icon           | Explicit action, won't interfere with node selection |
| Modal behavior   | Draggable, stays open   | User can see context while editing                   |
| Text format      | Plain text, no limit    | Simple, no parsing overhead                          |

---

## Implementation Phases

### Phase B1: Data Layer (1-2 hours)

#### File: `NodeGraphNode.ts`

**Add to metadata interface** (if typed):

```typescript
interface NodeMetadata {
  // ... existing fields
  comment?: string;
  colorOverride?: string;
  typeLabelOverride?: string;
}
```

**Add helper methods:**

```typescript
/**
 * Get the comment attached to this node
 */
getComment(): string | undefined {
  return this.metadata?.comment;
}

/**
 * Check if node has a non-empty comment
 */
hasComment(): boolean {
  return !!this.metadata?.comment?.trim();
}

/**
 * Set or clear the comment on this node
 * @param comment - The comment text, or undefined/empty to clear
 * @param args - Options including undo support
 */
setComment(comment: string | undefined, args?: { undo?: boolean; label?: string }): void {
  const oldComment = this.metadata?.comment;
  const newComment = comment?.trim() || undefined;

  // No change
  if (oldComment === newComment) return;

  // Initialize metadata if needed
  if (!this.metadata) {
    this.metadata = {};
  }

  // Set or delete
  if (newComment) {
    this.metadata.comment = newComment;
  } else {
    delete this.metadata.comment;
  }

  // Notify listeners
  this.notifyListeners('metadataChanged', { key: 'comment', data: newComment });

  // Undo support
  if (args?.undo) {
    const _this = this;
    const undo = typeof args.undo === 'object' ? args.undo : UndoQueue.instance;

    undo.push({
      label: args.label || 'Edit comment',
      do: () => _this.setComment(newComment),
      undo: () => _this.setComment(oldComment)
    });
  }
}
```

#### Verify Persistence

Comments should automatically persist because:

1. `metadata` is included in `toJSON()`
2. `metadata` is restored in constructor/fromJSON

**Test by:**

1. Add comment to node
2. Save project
3. Close and reopen
4. Verify comment still exists

#### Verify Copy/Paste

When nodes are copied, metadata should be included.

**Check in** `NodeGraphEditor.ts` or `NodeGraphModel.ts`:

- `copySelected()`
- `getNodeSetFromClipboard()`
- `insertNodeSet()`

---

### Phase B2: Comment Icon Rendering (2-3 hours)

#### Icon Design

Simple speech bubble icon, rendered via Canvas path:

```typescript
// In NodeGraphEditorNode.ts or separate file

const COMMENT_ICON_SIZE = 14;

function drawCommentIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  filled: boolean,
  alpha: number = 1
): void {
  ctx.save();
  ctx.globalAlpha = alpha;

  // Speech bubble path (14x14)
  ctx.beginPath();
  ctx.moveTo(x + 2, y + 2);
  ctx.lineTo(x + 12, y + 2);
  ctx.quadraticCurveTo(x + 14, y + 2, x + 14, y + 4);
  ctx.lineTo(x + 14, y + 9);
  ctx.quadraticCurveTo(x + 14, y + 11, x + 12, y + 11);
  ctx.lineTo(x + 6, y + 11);
  ctx.lineTo(x + 3, y + 14);
  ctx.lineTo(x + 3, y + 11);
  ctx.lineTo(x + 2, y + 11);
  ctx.quadraticCurveTo(x, y + 11, x, y + 9);
  ctx.lineTo(x, y + 4);
  ctx.quadraticCurveTo(x, y + 2, x + 2, y + 2);
  ctx.closePath();

  if (filled) {
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  } else {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.restore();
}
```

#### Integration in paint()

```typescript
// After drawing title, in paint() method

// Comment icon position - right side of title bar
const commentIconX = x + this.nodeSize.width - COMMENT_ICON_SIZE - 8;
const commentIconY = y + 6;

// Store bounds for hit detection
this.commentIconBounds = {
  x: commentIconX - 4,
  y: commentIconY - 4,
  width: COMMENT_ICON_SIZE + 8,
  height: COMMENT_ICON_SIZE + 8
};

// Draw icon
const hasComment = this.model.hasComment();
const isHoveringIcon = this.isHoveringCommentIcon;

if (hasComment) {
  // Always show filled icon if comment exists
  drawCommentIcon(ctx, commentIconX, commentIconY, true, 1);
} else if (isHoveringIcon || this.owner.isHighlighted(this)) {
  // Show outline icon on hover
  drawCommentIcon(ctx, commentIconX, commentIconY, false, 0.5);
}
```

#### Hit Detection

Add bounds checking in `handleMouseEvent`:

```typescript
private isPointInCommentIcon(x: number, y: number): boolean {
  if (!this.commentIconBounds) return false;

  const b = this.commentIconBounds;
  return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
}
```

---

### Phase B3: Hover Preview (3-4 hours)

#### Requirements

- 300ms delay before showing
- Cancel if mouse leaves before delay
- Clear on pan/zoom
- Max dimensions with scroll for long comments
- Position near icon, not obscuring node

#### State Management

```typescript
// In NodeGraphEditorNode.ts

private commentPreviewTimer: NodeJS.Timeout | null = null;
private isHoveringCommentIcon: boolean = false;

private showCommentPreview(): void {
  if (!this.model.hasComment()) return;

  const comment = this.model.getComment();
  const screenPos = this.owner.canvasToScreen(
    this.global.x + this.nodeSize.width,
    this.global.y
  );

  PopupLayer.instance.showTooltip({
    content: this.createPreviewContent(comment),
    position: { x: screenPos.x + 10, y: screenPos.y },
    maxWidth: 250,
    maxHeight: 150
  });
}

private createPreviewContent(comment: string): HTMLElement {
  const div = document.createElement('div');
  div.className = 'node-comment-preview';
  div.style.cssText = `
    max-height: 130px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 12px;
    line-height: 1.4;
  `;
  div.textContent = comment;
  return div;
}

private hideCommentPreview(): void {
  PopupLayer.instance.hideTooltip();
}

private cancelCommentPreviewTimer(): void {
  if (this.commentPreviewTimer) {
    clearTimeout(this.commentPreviewTimer);
    this.commentPreviewTimer = null;
  }
}
```

#### Mouse Event Handling

```typescript
// In handleMouseEvent()

case 'move':
  const inCommentIcon = this.isPointInCommentIcon(localX, localY);

  if (inCommentIcon && !this.isHoveringCommentIcon) {
    // Entered comment icon area
    this.isHoveringCommentIcon = true;
    this.owner.repaint();

    // Start preview timer
    if (this.model.hasComment()) {
      this.cancelCommentPreviewTimer();
      this.commentPreviewTimer = setTimeout(() => {
        this.showCommentPreview();
      }, 300);
    }
  } else if (!inCommentIcon && this.isHoveringCommentIcon) {
    // Left comment icon area
    this.isHoveringCommentIcon = false;
    this.cancelCommentPreviewTimer();
    this.hideCommentPreview();
    this.owner.repaint();
  }
  break;

case 'move-out':
  // Clear all hover states
  this.isHoveringCommentIcon = false;
  this.cancelCommentPreviewTimer();
  this.hideCommentPreview();
  break;
```

#### Clear on Pan/Zoom

In `NodeGraphEditor.ts`, when pan/zoom starts:

```typescript
// In mouse wheel handler or pan start
this.forEachNode((node) => {
  node.cancelCommentPreviewTimer?.();
  node.hideCommentPreview?.();
});
```

---

### Phase B4: Edit Modal (4-6 hours)

#### Create Component

**File:** `views/nodegrapheditor/NodeCommentEditor.tsx`

```tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';

import { NodeGraphNode } from '@noodl-models/nodegraphmodel';

import styles from './NodeCommentEditor.module.scss';

export interface NodeCommentEditorProps {
  node: NodeGraphNode;
  initialPosition: { x: number; y: number };
  onClose: () => void;
}

export function NodeCommentEditor({ node, initialPosition, onClose }: NodeCommentEditorProps) {
  const [comment, setComment] = useState(node.getComment() || '');
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus textarea
  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, []);

  // Handle save
  const handleSave = useCallback(() => {
    node.setComment(comment, { undo: true, label: 'Edit node comment' });
    onClose();
  }, [node, comment, onClose]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        handleSave();
      }
    },
    [handleCancel, handleSave]
  );

  // Dragging handlers
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('textarea, button')) return;

      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    },
    [position]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  return (
    <div className={styles.CommentEditor} style={{ left: position.x, top: position.y }} onKeyDown={handleKeyDown}>
      <div className={styles.Header} onMouseDown={handleDragStart}>
        <span className={styles.Title}>Comment: {node.label}</span>
        <button className={styles.CloseButton} onClick={handleCancel} title="Close (Escape)">
          ×
        </button>
      </div>

      <textarea
        ref={textareaRef}
        className={styles.TextArea}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Add a comment to document this node..."
      />

      <div className={styles.Footer}>
        <span className={styles.Hint}>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to save</span>
        <div className={styles.Buttons}>
          <button className={styles.CancelButton} onClick={handleCancel}>
            Cancel
          </button>
          <button className={styles.SaveButton} onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
```

#### Styles

**File:** `views/nodegrapheditor/NodeCommentEditor.module.scss`

```scss
.CommentEditor {
  position: fixed;
  width: 320px;
  background: var(--theme-color-bg-2);
  border: 1px solid var(--theme-color-border-default);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  z-index: 10000;
  display: flex;
  flex-direction: column;
}

.Header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--theme-color-bg-3);
  border-bottom: 1px solid var(--theme-color-border-default);
  border-radius: 8px 8px 0 0;
  cursor: move;
  user-select: none;
}

.Title {
  font-size: 13px;
  font-weight: 500;
  color: var(--theme-color-fg-default);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.CloseButton {
  background: none;
  border: none;
  color: var(--theme-color-fg-default-shy);
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;

  &:hover {
    color: var(--theme-color-fg-default);
  }
}

.TextArea {
  flex: 1;
  min-height: 120px;
  max-height: 300px;
  margin: 12px;
  padding: 10px;
  background: var(--theme-color-bg-1);
  border: 1px solid var(--theme-color-border-default);
  border-radius: 4px;
  color: var(--theme-color-fg-default);
  font-family: inherit;
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;

  &::placeholder {
    color: var(--theme-color-fg-default-shy);
  }

  &:focus {
    outline: none;
    border-color: var(--theme-color-primary);
  }
}

.Footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-top: 1px solid var(--theme-color-border-default);
}

.Hint {
  font-size: 11px;
  color: var(--theme-color-fg-default-shy);
}

.Buttons {
  display: flex;
  gap: 8px;
}

.CancelButton,
.SaveButton {
  padding: 6px 14px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s;
}

.CancelButton {
  background: var(--theme-color-bg-3);
  border: 1px solid var(--theme-color-border-default);
  color: var(--theme-color-fg-default);

  &:hover {
    background: var(--theme-color-bg-4);
  }
}

.SaveButton {
  background: var(--theme-color-primary);
  border: none;
  color: var(--theme-color-on-primary);

  &:hover {
    background: var(--theme-color-primary-highlight);
  }
}
```

---

### Phase B5: Click Handler Integration (2-3 hours)

#### Open Modal on Click

In `NodeGraphEditorNode.ts` handleMouseEvent():

```typescript
case 'up':
  // Check comment icon click FIRST
  if (this.isPointInCommentIcon(localX, localY)) {
    this.owner.openCommentEditor(this);
    return; // Don't process as node selection
  }

  // ... existing click handling
```

#### NodeGraphEditor Integration

In `NodeGraphEditor.ts`:

```typescript
import { NodeCommentEditor } from './nodegrapheditor/NodeCommentEditor';

// Track open editors to prevent duplicates
private openCommentEditors: Map<string, () => void> = new Map();

openCommentEditor(node: NodeGraphEditorNode): void {
  const nodeId = node.model.id;

  // Check if already open
  if (this.openCommentEditors.has(nodeId)) {
    return; // Already open
  }

  // Calculate initial position
  const screenPos = this.canvasToScreen(node.global.x, node.global.y);
  const initialX = Math.min(
    screenPos.x + node.nodeSize.width * this.getPanAndScale().scale + 20,
    window.innerWidth - 340
  );
  const initialY = Math.min(
    screenPos.y,
    window.innerHeight - 250
  );

  // Create close handler
  const closeEditor = () => {
    this.openCommentEditors.delete(nodeId);
    PopupLayer.instance.hidePopup(popupId);
    this.repaint(); // Update comment icon state
  };

  // Show modal
  const popupId = PopupLayer.instance.showPopup({
    content: NodeCommentEditor,
    props: {
      node: node.model,
      initialPosition: { x: initialX, y: initialY },
      onClose: closeEditor
    },
    modal: false,
    closeOnOutsideClick: false,
    closeOnEscape: false // We handle Escape in component
  });

  this.openCommentEditors.set(nodeId, closeEditor);
}

// Helper method
canvasToScreen(canvasX: number, canvasY: number): { x: number; y: number } {
  const panAndScale = this.getPanAndScale();
  return {
    x: (canvasX + panAndScale.x) * panAndScale.scale,
    y: (canvasY + panAndScale.y) * panAndScale.scale
  };
}
```

---

## Files to Create

```
packages/noodl-editor/src/editor/src/views/nodegrapheditor/
├── NodeCommentEditor.tsx
└── NodeCommentEditor.module.scss
```

## Files to Modify

```
packages/noodl-editor/src/editor/src/models/nodegraphmodel/
└── NodeGraphNode.ts              # Add comment methods

packages/noodl-editor/src/editor/src/views/nodegrapheditor/
└── NodeGraphEditorNode.ts        # Icon rendering, hover, click

packages/noodl-editor/src/editor/src/views/
└── nodegrapheditor.ts            # openCommentEditor integration
```

---

## Testing Checklist

### Data Layer

- [ ] getComment() returns undefined for new node
- [ ] setComment() stores comment
- [ ] hasComment() returns true when comment exists
- [ ] setComment('') clears comment
- [ ] Comment persists after save/reload
- [ ] Comment copied when node copied
- [ ] Undo restores previous comment
- [ ] Redo re-applies comment

### Icon Rendering

- [ ] Icon shows (filled) on nodes with comments
- [ ] Icon shows (outline) on hover for nodes without comments
- [ ] Icon positioned correctly in title bar
- [ ] Icon visible at various zoom levels
- [ ] Icon doesn't overlap with node label

### Hover Preview

- [ ] Preview shows after 300ms hover
- [ ] Preview doesn't show immediately (no spam)
- [ ] Preview clears when mouse leaves
- [ ] Preview clears on pan/zoom
- [ ] Long comments scroll in preview
- [ ] Preview positioned near icon, not obscuring node

### Edit Modal

- [ ] Opens on icon click
- [ ] Shows current comment
- [ ] Textarea auto-focused
- [ ] Can edit comment text
- [ ] Save button saves and closes
- [ ] Cancel button discards and closes
- [ ] Cmd+Enter saves
- [ ] Escape cancels
- [ ] Modal is draggable
- [ ] Can have multiple modals open (different nodes)
- [ ] Cannot open duplicate modal for same node

### Integration

- [ ] Clicking icon doesn't select node
- [ ] Can still select node by clicking elsewhere
- [ ] Comment updates reflected after save
- [ ] Node repainted after comment change

---

## Success Criteria

- [ ] Comments stored in node.metadata.comment
- [ ] Filled icon visible on nodes with comments
- [ ] Outline icon on hover for nodes without comments
- [ ] Hover preview after 300ms, no spam on pan/scroll
- [ ] Click opens draggable edit modal
- [ ] Cmd+Enter to save, Escape to cancel
- [ ] Undo/redo works for comment changes
- [ ] Comments persist in project save/load
- [ ] Comments included in copy/paste

---

## Rollback Plan

1. Revert `NodeGraphNode.ts` comment methods
2. Revert `NodeGraphEditorNode.ts` icon/hover code
3. Revert `nodegrapheditor.ts` openCommentEditor
4. Delete `NodeCommentEditor.tsx` and `.scss`

Data layer changes are additive - existing projects won't break even if code is partially reverted.
