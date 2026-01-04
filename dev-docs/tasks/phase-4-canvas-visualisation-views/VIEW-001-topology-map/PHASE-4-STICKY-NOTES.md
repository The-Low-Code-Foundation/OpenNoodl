# Phase 4: Sticky Notes

**Priority:** 🟡 After draggable cards  
**Status:** Infrastructure Ready, UI Pending

## Overview

Allow users to add markdown sticky notes to the topology map. Notes are draggable, positioned with snap-to-grid, and persisted in `project.json`.

---

## ✅ Infrastructure Complete

**File:** `utils/topologyPersistence.ts`

Functions ready:

- `addStickyNote(project, note)` - Create new note
- `updateStickyNote(project, id, updates)` - Update existing note
- `deleteStickyNote(project, id)` - Remove note

All include undo/redo support.

---

## 🎯 Tasks

### 1. Create StickyNote Component

**File:** `components/StickyNote.tsx`

**Requirements:**

- Renders as SVG foreignObject (like existing canvas sticky notes)
- Displays markdown content (use existing markdown renderer from canvas)
- Draggable using `useDraggable` hook
- Resizable (optional - start with fixed 200x150px)
- Background color: `--theme-color-bg-warning` or similar
- Show delete button on hover

**Props:**

```typescript
interface StickyNoteProps {
  id: string;
  x: number;
  y: number;
  content: string;
  onUpdate: (updates: Partial<StickyNote>) => void;
  onDelete: () => void;
}
```

---

### 2. Add "New Sticky Note" Button

**File:** `TopologyMapPanel.tsx`

**Location:** Top-right toolbar, next to zoom controls and reset button

**Implementation:**

```typescript
import { addStickyNote } from './utils/topologyPersistence';

function handleAddStickyNote() {
  const newNote = {
    id: generateId(),
    x: 100, // Or center of viewport
    y: 100,
    content: '# New Note\n\nDouble-click to edit...',
    width: 200,
    height: 150
  };
  addStickyNote(ProjectModel.instance, newNote);
}

// Button:
<button onClick={handleAddStickyNote} title="Add sticky note">
  <Icon name={IconName.Note} />
</button>;
```

---

### 3. Load Sticky Notes from Project

**File:** `TopologyMapPanel.tsx` or create `hooks/useStickyNotes.ts`

**Implementation:**

```typescript
import { getTopologyMapMetadata } from './utils/topologyPersistence';

const metadata = getTopologyMapMetadata(ProjectModel.instance);
const stickyNotes = metadata?.stickyNotes || [];

// Render in TopologyMapView:
{
  stickyNotes.map((note) => <StickyNote key={note.id} {...note} onUpdate={handleUpdate} onDelete={handleDelete} />);
}
```

---

### 4. Edit Mode

**Options:**

1. **Native prompt (simplest):** Double-click opens `window.prompt()` for quick edits
2. **Inline textarea:** Click to edit directly in the note
3. **Modal dialog:** Like existing canvas sticky notes

**Recommendation:** Start with option 1 (native prompt), upgrade later if needed

**Implementation:**

```typescript
function handleDoubleClick() {
  const newContent = window.prompt('Edit note:', note.content);
  if (newContent !== null) {
    updateStickyNote(ProjectModel.instance, note.id, { content: newContent });
  }
}
```

---

## 📦 Persistence Format

Stored in `project.json` under `"topologyMap"` key:

```json
{
  "topologyMap": {
    "customPositions": {},
    "stickyNotes": [
      {
        "id": "note-123",
        "x": 100,
        "y": 200,
        "content": "# Important\n\nThis is a note",
        "width": 200,
        "height": 150
      }
    ]
  }
}
```

---

## 🎨 Visual Design

**Style Guide:**

- Background: `var(--theme-color-bg-warning)` or `#fef3c7`
- Border: `2px solid var(--theme-color-border-warning)`
- Shadow: `drop-shadow(0 2px 6px rgba(0,0,0,0.2))`
- Font: System font, 12px
- Padding: 8px
- Border radius: 4px

**Interactions:**

- Hover: Show delete button (X) in top-right corner
- Drag: Same cursor feedback as cards (grab/grabbing)
- Edit: Double-click or edit button

---

## 🧪 Testing Checklist

- [ ] Add sticky note button works
- [ ] Note appears at correct position
- [ ] Markdown renders correctly
- [ ] Can drag note around (snaps to grid)
- [ ] Double-click to edit works
- [ ] Delete button removes note
- [ ] Undo/redo works for all operations
- [ ] Notes persist across project reload

---

## 🔗 Related Files

```
components/StickyNote.tsx (NEW)
components/StickyNote.module.scss (NEW)
TopologyMapPanel.tsx (add button + render notes)
hooks/useStickyNotes.ts (OPTIONAL - for state management)
utils/topologyPersistence.ts ✅ (complete)
utils/snapToGrid.ts ✅ (complete)
hooks/useDraggable.ts ✅ (complete)
```

---

## 💡 Future Enhancements

- Color picker for note background
- Resizable notes
- Rich text editor instead of markdown
- Attach notes to specific cards
- Note categories/tags

---

**Next Step After Completion:** Proceed to [PHASE-5-DRILLDOWN.md](./PHASE-5-DRILLDOWN.md)
