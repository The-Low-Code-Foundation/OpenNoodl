# Phase 5: Drilldown View Redesign

**Priority:** 🟢 Future Enhancement  
**Status:** Design Phase

## Overview

Redesign the drilldown (component-level) view to show an "expanded card" layout with connected parent folders visible around the edges. Add navigation to open components.

---

## 🎯 User Requirements

From user feedback:

> "Should be more like the jsx example in the task folder, so it looks like the parent card has expanded to show the drilldown, and the immediately connected parent cards are shown stuck around the outside of the expanded card"

> "Clicking on a drilldown card should take me to that component, replacing the left topology tab with the components tab"

---

## 📐 Design Concept

### Current Drilldown

- Shows component cards in a grid layout
- Same size as top-level folder view
- Hard to see context/relationships

### Proposed Drilldown

```
┌─────────────────────────────────────────────┐
│                                             │
│  [Parent Folder 1]     [Parent Folder 2]   │ ← Connected folders
│                                             │
│                                             │
│         ╔═══════════════════════════╗       │
│         ║                           ║       │
│         ║   🔍 Folder: Features     ║       │ ← Expanded folder
│         ║   ─────────────────────   ║       │
│         ║                           ║       │
│         ║   [Card] [Card] [Card]    ║       │ ← Component cards inside
│         ║   [Card] [Card] [Card]    ║       │
│         ║   [Card] [Card]           ║       │
│         ║                           ║       │
│         ╚═══════════════════════════╝       │
│                                             │
│  [Connected Folder 3]                       │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 📋 Tasks

### 1. Create DrilldownView Component

**File:** `components/DrilldownView.tsx` (NEW)

**Requirements:**

- Renders as expanded folder container
- Shows folder header (name, icon, type)
- Contains component cards in grid layout
- Shows connected parent folders around edges
- Background matches folder type color (darker)

**Props:**

```typescript
interface DrilldownViewProps {
  folder: FolderNode;
  components: ComponentNode[];
  connectedFolders: FolderNode[];
  onBack: () => void;
  onComponentClick: (componentId: string) => void;
}
```

---

### 2. Layout Algorithm for Connected Folders

**File:** `utils/drilldownLayout.ts` (NEW)

**Algorithm:**

1. Place expanded folder in center (large container)
2. Identify connected folders (folders with edges to this folder)
3. Position connected folders around edges:
   - Top: Folders that send data TO this folder
   - Bottom: Folders that receive data FROM this folder
   - Left/Right: Bi-directional or utility connections

**Spacing:**

- Expanded folder: 600x400px
- Connected folders: Normal size (150x120px)
- Margin between: 80px

---

### 3. Navigation on Component Click

**File:** `components/ComponentNode.tsx` or `DrilldownView.tsx`

**Implementation:**

```typescript
import { useRouter } from '@noodl/utils/router';

function handleComponentClick(component: ComponentModel) {
  // 1. Open the component in node graph editor
  ProjectModel.instance.setSelectedComponent(component.name);

  // 2. Switch sidebar to components panel
  router.navigate('/editor/components');
  // This replaces the topology panel with components panel

  // 3. Optional: Also focus/select the component in the list
  EventDispatcher.instance.notifyListeners('component-focused', { id: component.name });
}
```

**UX Flow:**

1. User is in Topology Map (drilldown view)
2. User clicks a component card
3. Sidebar switches to Components panel
4. Node graph editor opens that component
5. Component is highlighted in the components list

---

### 4. Visual Design

**Expanded Folder Container:**

```scss
.DrilldownView__expandedFolder {
  background: var(--theme-color-bg-3);
  border: 3px solid var(--theme-color-primary);
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);

  // Inner grid for component cards
  .DrilldownView__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 16px;
    margin-top: 16px;
  }
}
```

**Connected Folders:**

- Normal folder card styling
- Slightly dimmed (opacity: 0.7)
- Connection lines visible
- Not clickable (or clicking returns to top-level view)

---

### 5. Back Button

**Location:** Top-left of expanded folder

**Implementation:**

```typescript
<button onClick={onBack} className={css.DrilldownView__backButton}>
  <Icon name={IconName.ArrowLeft} />
  Back to Overview
</button>
```

---

## 🔍 Example: JSX Reference

From `topology-drilldown.jsx` in task folder - review this for visual design inspiration.

---

## 🧪 Testing Checklist

- [ ] Drilldown shows expanded folder container
- [ ] Connected folders appear around edges
- [ ] Clicking component opens it in editor
- [ ] Sidebar switches to Components panel
- [ ] Back button returns to top-level view
- [ ] Visual hierarchy is clear (expanded vs connected)
- [ ] Folder type colors consistent

---

## 🔗 Related Files

```
components/DrilldownView.tsx (NEW)
components/DrilldownView.module.scss (NEW)
utils/drilldownLayout.ts (NEW)
components/ComponentNode.tsx (add navigation)
TopologyMapPanel.tsx (switch between views)
router.setup.ts (ensure routes configured)
```

---

## 💡 Future Enhancements

- Zoom animation when transitioning to drilldown
- Show connection strength (line thickness based on data flow)
- Multi-level drilldown (folder → folder → components)
- Breadcrumb navigation
- Mini-map in corner showing position in overall topology

---

## 📝 Notes

This phase is more complex than previous phases and may require iteration. Consider implementing in sub-phases:

1. **Phase 5A:** Basic expanded folder layout (no connected folders yet)
2. **Phase 5B:** Add connected folders around edges
3. **Phase 5C:** Add navigation and sidebar switching
4. **Phase 5D:** Polish transitions and animations

---

**Previous Step:** [PHASE-4-STICKY-NOTES.md](./PHASE-4-STICKY-NOTES.md)
