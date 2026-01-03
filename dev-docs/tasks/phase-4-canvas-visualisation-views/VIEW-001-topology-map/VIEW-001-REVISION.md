# VIEW-001-REVISION: Project Topology Map Redesign

**Status:** 🔴 REVISION REQUIRED  
**Original Task:** VIEW-001-topology-map  
**Priority:** HIGH  
**Estimate:** 2-3 days

---

## Summary

The initial VIEW-001 implementation does not meet the design goals. It renders all 123 components as individual nodes in a flat horizontal layout, creating an unreadable mess of spaghetti connections. This revision changes the fundamental approach from "show every component" to "show folder-level architecture with drill-down."

### Screenshots of Current (Broken) Implementation

The current implementation shows:
- All components spread horizontally across 3-4 rows
- Names truncated to uselessness ("/#Directus/Di...")
- No semantic grouping (pages vs shared vs utilities)
- No visual differentiation between component types
- Connections that obscure rather than clarify relationships
- Essentially unusable at scale (123 components, 68 orphans)

---

## The Problem

The original spec envisioned a layered architectural diagram:

```
📄 PAGES (top)
   ↓
🧩 SHARED (middle)  
   ↓
🔧 UTILITIES (bottom)
```

What was built instead: a flat force-directed/dagre graph treating all components identically, which breaks down completely at scale.

**Root cause:** The implementation tried to show component-level detail at the overview level. A project with 5-10 components might work, but real projects have 100+ components organized into folders.

---

## The Solution: Folder-First Architecture

### Level 1: Folder Overview (Default View)

Show **folders** as nodes, not components:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   ┌──────────┐                                                  │
│   │ 📄 Pages │──────────────┬──────────────┐                   │
│   │    (5)   │              │              │                   │
│   └──────────┘              ▼              ▼                   │
│         │            ┌───────────┐  ┌───────────┐              │
│         │            │ #Directus │  │ #Swapcard │              │
│         │            │   (45)    │  │    (8)    │              │
│         ▼            └─────┬─────┘  └─────┬─────┘              │
│   ┌──────────┐             │              │                    │
│   │ #Forms   │─────────────┤              │                    │
│   │   (15)   │             ▼              │                    │
│   └──────────┘       ┌───────────┐        │                    │
│         │            │   #UI     │◄───────┘                    │
│         └───────────►│   (32)    │                             │
│                      └─────┬─────┘                             │
│                            │                                    │
│                            ▼                                    │
│                      ┌───────────┐   ┌ ─ ─ ─ ─ ─ ─ ┐           │
│                      │  #Global  │   │ ⚠️ Orphans  │           │
│                      │   (18)    │   │    (68)     │           │
│                      └───────────┘   └ ─ ─ ─ ─ ─ ─ ┘           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

This transforms 123 unreadable nodes into ~6 readable nodes.

### Level 2: Expanded Folder View (Drill-Down)

Double-click a folder to see its components:

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Back to Overview                          #Directus (45)      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────┐     ┌─────────┐     ┌─────────┐                   │
│  │  Auth   │◄────│  Query  │────►│  List   │     ┌───────┐     │
│  │  ×12    │     │  ×28    │     │  ×15    │     │#Global│     │
│  └─────────┘     └────┬────┘     └─────────┘     │(mini) │     │
│       ▲               │                          └───────┘     │
│       │               ▼                               ▲        │
│  ┌─────────┐     ┌─────────┐     ┌─────────┐         │        │
│  │ Error   │◄────│Mutation │────►│  Item   │─────────┘        │
│  │  ×3     │     │  ×18    │     │  ×22    │                   │
│  └─────────┘     └─────────┘     └─────────┘                   │
│                                                                 │
│  ───────────────────────────────────────────                   │
│  External connections from:                                     │
│  [Pages 34×] [Forms 22×]                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Level 3: Handoff to X-Ray

Double-click a component → Opens X-Ray view for that component's internals.

**Topology shows relationships. X-Ray shows internals. They complement each other.**

---

## Visual Design Requirements

### Color Palette by Folder Type

| Folder Type | Background | Border | Use Case |
|-------------|------------|--------|----------|
| Pages | `#1E3A8A` | `#3B82F6` | Entry points, routes |
| Feature | `#581C87` | `#A855F7` | Feature-specific folders (#Forms, etc.) |
| Integration | `#064E3B` | `#10B981` | External services (#Directus, #Swapcard) |
| UI | `#164E63` | `#06B6D4` | Shared UI components |
| Utility | `#374151` | `#6B7280` | Foundation (#Global) |
| Orphan | `#422006` | `#CA8A04` | Unused components (dashed border) |

### Node Styling

```scss
// Folder node (Level 1)
.folder-node {
  min-width: 100px;
  padding: 12px 16px;
  border-radius: 8px;
  border-width: 2px;
  
  &.selected {
    border-width: 3px;
    box-shadow: 0 0 20px rgba(color, 0.3);
  }
  
  .folder-name {
    font-weight: 600;
    font-size: 14px;
  }
  
  .component-count {
    font-size: 12px;
    opacity: 0.7;
  }
}

// Component node (Level 2)
.component-node {
  min-width: 80px;
  padding: 8px 12px;
  border-radius: 6px;
  border-width: 1px;
  
  .component-name {
    font-size: 12px;
    font-weight: 500;
  }
  
  .usage-count {
    font-size: 10px;
    color: #6EE7B7; // green for "used by X"
  }
}
```

### Connection Styling

```scss
.connection-line {
  stroke: #4B5563;
  stroke-width: 1px;
  opacity: 0.5;
  
  // Thickness based on connection count
  &.connections-10 { stroke-width: 2px; }
  &.connections-20 { stroke-width: 3px; }
  &.connections-30 { stroke-width: 4px; }
  
  // Opacity based on connection count
  &.high-traffic { opacity: 0.7; }
}
```

---

## Implementation Phases

### Phase 1: Data Restructuring (0.5 days)

Convert component-level graph to folder-level graph.

**Tasks:**
1. Create `buildFolderGraph()` function that aggregates components by folder
2. Calculate inter-folder connection counts
3. Identify folder types (page, integration, ui, utility) from naming conventions
4. Keep component-level data available for drill-down

**New Types:**

```typescript
interface FolderNode {
  id: string;
  name: string;
  path: string;
  type: 'page' | 'feature' | 'integration' | 'ui' | 'utility' | 'orphan';
  componentCount: number;
  components: ComponentModel[];
}

interface FolderConnection {
  from: string;      // folder id
  to: string;        // folder id
  count: number;     // number of component-to-component connections
  componentPairs: Array<{ from: string; to: string }>;
}

interface FolderGraph {
  folders: FolderNode[];
  connections: FolderConnection[];
  orphanComponents: ComponentModel[];
}
```

**Verification:**
- [ ] Folders correctly identified from component paths
- [ ] Connection counts accurate
- [ ] Orphans isolated correctly

### Phase 2: Level 1 - Folder Overview (1 day)

Replace current implementation with folder-level view.

**Tasks:**
1. Render folder nodes with correct colors/styling
2. Use simple hierarchical layout (pages top, utilities bottom)
3. Draw connections with thickness based on count
4. Implement click-to-select (shows detail panel)
5. Implement double-click-to-expand
6. Add orphan indicator (dashed box, separate from main graph)

**Layout Strategy:**

Instead of dagre's automatic layout, use a **tiered layout**:
- Tier 1 (y=0): Pages
- Tier 2 (y=1): Features that pages use
- Tier 3 (y=2): Shared libraries (Directus, UI)
- Tier 4 (y=3): Utilities (Global)
- Separate: Orphans (bottom-left, disconnected)

```typescript
function assignTier(folder: FolderNode, connections: FolderConnection[]): number {
  if (folder.type === 'page') return 0;
  if (folder.type === 'orphan') return -1; // special handling
  
  // Calculate based on what uses this folder
  const usedBy = connections.filter(c => c.to === folder.id);
  const usesPages = usedBy.some(c => getFolderById(c.from).type === 'page');
  
  if (usesPages && folder.type === 'feature') return 1;
  if (folder.type === 'utility') return 3;
  return 2; // default: shared layer
}
```

**Verification:**
- [ ] Folders display with correct colors
- [ ] Layout is tiered (pages at top)
- [ ] Connection thickness reflects count
- [ ] Orphans shown separately
- [ ] Click shows detail panel
- [ ] Double-click triggers drill-down

### Phase 3: Level 2 - Expanded Folder (1 day)

Implement drill-down into folder.

**Tasks:**
1. Create expanded view showing folder's components
2. Show internal connections between components
3. Show external connections from other folders (collapsed, at edges)
4. Click component → detail panel with "Open in X-Ray" button
5. Double-click component → navigate to X-Ray
6. "Back" button returns to folder overview
7. Breadcrumb trail (App > #Directus > ComponentName)

**Verification:**
- [ ] Components render within expanded folder boundary
- [ ] Internal connections visible
- [ ] External folders shown as mini-nodes at edges
- [ ] External connections drawn from mini-nodes
- [ ] "Open in X-Ray" button works
- [ ] Back navigation works
- [ ] Breadcrumb updates correctly

### Phase 4: Detail Panels (0.5 days)

Side panel showing details of selected item.

**Folder Detail Panel:**
- Folder name and type
- Component count
- Incoming connections (which folders use this, with counts)
- Outgoing connections (which folders this uses, with counts)
- "Expand" button

**Component Detail Panel:**
- Component name
- Usage count (how many places use this)
- Dependencies (what this uses)
- "Open in X-Ray" button
- "Go to Canvas" button

**Verification:**
- [ ] Panels appear on selection
- [ ] Data is accurate
- [ ] Buttons navigate correctly

### Phase 5: Polish & Edge Cases (0.5 days)

**Tasks:**
1. Handle projects with no folder structure (flat component list)
2. Handle very large folders (>50 components) - consider sub-grouping or pagination
3. Add zoom controls that actually work
4. Add "Fit to view" that frames the content properly
5. Smooth animations for expand/collapse transitions
6. Keyboard navigation (Escape to go back, Enter to expand)

**Verification:**
- [ ] Flat projects handled gracefully
- [ ] Large folders don't overwhelm
- [ ] Zoom/pan works smoothly
- [ ] Animations feel polished

---

## Files to Modify

### Refactor Existing

```
packages/noodl-editor/src/editor/src/views/AnalysisPanel/TopologyMapView/
├── TopologyMapView.tsx        # Complete rewrite for folder-first approach
├── TopologyMapView.module.scss # New color system, node styles
├── useTopologyGraph.ts        # Replace with useFolderGraph.ts
├── TopologyNode.tsx           # Rename to FolderNode.tsx, new styling
└── TopologyEdge.tsx           # Update for variable thickness
```

### Create New

```
packages/noodl-editor/src/editor/src/views/AnalysisPanel/TopologyMapView/
├── useFolderGraph.ts          # New hook for folder-level data
├── FolderNode.tsx             # Folder node component
├── ComponentNode.tsx          # Component node (for drill-down)
├── FolderDetailPanel.tsx      # Side panel for folder details
├── ComponentDetailPanel.tsx   # Side panel for component details
├── ExpandedFolderView.tsx     # Level 2 drill-down view
├── Breadcrumb.tsx             # Navigation breadcrumb
└── layoutUtils.ts             # Tiered layout calculation
```

### Delete

```
# Remove dagre dependency if no longer needed elsewhere
# Or keep but don't use for topology layout
```

---

## Success Criteria

- [ ] Default view shows ~6 folder nodes (not 123 component nodes)
- [ ] Folders are color-coded by type
- [ ] Connection thickness indicates traffic
- [ ] Double-click expands folder to show components
- [ ] Components link to X-Ray view
- [ ] Orphans clearly indicated but not cluttering main view
- [ ] Works smoothly on projects with 100+ components
- [ ] Layout is deterministic (same project = same layout)
- [ ] Visually polished (matches mockup color scheme)

---

## Reference Mockups

See artifact files created during design review:
- `topology-drilldown.jsx` - Interactive prototype with both levels
- `architecture-views.jsx` - Alternative visualization concepts (for reference)

Key visual elements from mockups:
- Dark background (#111827 / gray-900)
- Colored borders on nodes, semi-transparent fills
- White text for names, muted text for counts
- Connection lines in gray with variable opacity/thickness
- Selection state: brighter border, subtle glow

---

## Notes for Cline

1. **Don't try to show everything at once.** The key insight is aggregation: 123 components → 6 folders → readable.

2. **The layout should be semantic, not algorithmic.** Pages at top, utilities at bottom. Don't let dagre decide - it optimizes for edge crossing, not comprehension.

3. **Colors matter.** The current gray-on-gray is impossible to parse. Use the color palette defined above.

4. **This view complements X-Ray, doesn't replace it.** Topology = relationships between things. X-Ray = what's inside a thing. Link them together.

5. **Test with the real project** that has 123 components and 68 orphans. If it doesn't look good on that, it's not done.
