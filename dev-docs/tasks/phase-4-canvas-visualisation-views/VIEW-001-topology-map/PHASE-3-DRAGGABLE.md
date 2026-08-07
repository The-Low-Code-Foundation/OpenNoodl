# Phase 3: Draggable Cards

**Priority:** 🟡 After bugs fixed  
**Status:** Infrastructure Ready, UI Integration Pending

## Overview

Allow users to drag component and folder cards around the topology map. Positions snap to a 20px grid and are persisted in `project.json`.

---

## ✅ Infrastructure Complete

### Files Created

1. **`utils/snapToGrid.ts`** - Grid snapping utility
2. **`utils/topologyPersistence.ts`** - Position persistence with undo support
3. **`hooks/useDraggable.ts`** - Reusable drag-and-drop hook

All infrastructure follows the UndoQueue.instance.pushAndDo() pattern and is ready to use.

---

## 🎯 Remaining Tasks

### 1. Integrate useDraggable into ComponentNode

**File:** `components/ComponentNode.tsx`

**Steps:**

```typescript
import { useDraggable } from '../hooks/useDraggable';
import { updateCustomPosition } from '../utils/topologyPersistence';

// In component:
const { isDragging, x, y, handleMouseDown } = useDraggable(component.x, component.y, (newX, newY) => {
  updateCustomPosition(ProjectModel.instance, component.id, { x: newX, y: newY });
});

// Use x, y for positioning instead of layout-provided position
// Add onMouseDown={handleMouseDown} to the main SVG group
// Apply isDragging class for visual feedback (e.g., cursor: grabbing)
```

**Visual Feedback:**

- Change cursor to `grab` on hover
- Change cursor to `grabbing` while dragging
- Increase opacity or add glow effect while dragging

---

### 2. Integrate useDraggable into FolderNode

**File:** `components/FolderNode.tsx`

**Steps:** Same as ComponentNode above

**Note:** Folder positioning affects layout of contained components, so may need special handling

---

### 3. Load Custom Positions from Project

**File:** `hooks/useTopologyGraph.ts` or `hooks/useFolderGraph.ts`

**Steps:**

```typescript
import { getTopologyMapMetadata } from '../utils/topologyPersistence';

// In hook:
const metadata = getTopologyMapMetadata(ProjectModel.instance);
const customPositions = metadata?.customPositions || {};

// Apply custom positions to nodes:
nodes.forEach((node) => {
  if (customPositions[node.id]) {
    node.x = customPositions[node.id].x;
    node.y = customPositions[node.id].y;
    node.isCustomPositioned = true;
  }
});
```

---

### 4. Add Reset Positions Button

**File:** `TopologyMapPanel.tsx`

**Location:** Top-right toolbar, next to zoom controls

**Implementation:**

```typescript
import { saveTopologyMapMetadata } from './utils/topologyPersistence';

function handleResetPositions() {
  saveTopologyMapMetadata(ProjectModel.instance, {
    customPositions: {},
    stickyNotes: [] // Preserve sticky notes
  });
  // Trigger re-layout
}

// Button:
<button onClick={handleResetPositions} title="Reset card positions">
  <Icon name={IconName.Refresh} />
</button>;
```

---

## 🎨 Visual Design

### Cursor States

```scss
.TopologyNode {
  cursor: grab;

  &--dragging {
    cursor: grabbing;
    opacity: 0.8;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
  }
}
```

### Drag Constraints

- **Snap to grid:** 20px intervals
- **Boundaries:** Keep cards within viewport (optional)
- **Collision:** No collision detection (cards can overlap)

---

## 📦 Persistence Format

Stored in `project.json` under `"topologyMap"` key:

```json
{
  "topologyMap": {
    "customPositions": {
      "component-id-1": { "x": 100, "y": 200 },
      "folder-path-1": { "x": 300, "y": 400 }
    },
    "stickyNotes": []
  }
}
```

---

## 🧪 Testing Checklist

- [ ] Drag a component card, release, verify position saved
- [ ] Reload project, verify custom position persists
- [ ] Undo/redo position changes
- [ ] Reset all positions button works
- [ ] Positions snap to 20px grid
- [ ] Visual feedback works (cursor, opacity)
- [ ] Can still click card to select/navigate

---

## 🔗 Related Files

```
components/ComponentNode.tsx
components/FolderNode.tsx
hooks/useTopologyGraph.ts
hooks/useFolderGraph.ts
TopologyMapPanel.tsx
utils/useDraggable.ts ✅ (complete)
utils/topologyPersistence.ts ✅ (complete)
utils/snapToGrid.ts ✅ (complete)
```

---

**Next Step After Completion:** Proceed to [PHASE-4-STICKY-NOTES.md](./PHASE-4-STICKY-NOTES.md)
