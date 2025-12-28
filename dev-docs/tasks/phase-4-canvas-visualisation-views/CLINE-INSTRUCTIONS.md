# Canvas Visualization Views - Cline Implementation Guide

## Quick Start

**READ THIS FIRST before starting any implementation work.**

This project adds 7 visualization views to help users navigate complex Noodl projects. The views are divided into three types:

| Type | What It Does | Examples |
|------|--------------|----------|
| 🗺️ **Meta Views** | Replace canvas with project-wide view | Topology Map, Trigger Chain |
| 📋 **Sidebar Panels** | Open alongside canvas | X-Ray, Census |
| 🎨 **Canvas Overlays** | Enhance canvas with persistent highlighting | Layers, Lineage, Impact |

---

## ⚠️ CRITICAL: Prerequisites First!

**DO NOT START VIEW IMPLEMENTATION until prerequisites are complete.**

### Prerequisite Order

```
PREREQ-001: Fix Webpack Caching ──────┐
                                      ├──► PREREQ-002 + PREREQ-003 (parallel)
                                      │           │
                                      │           ▼
                                      │    VIEW-000: Foundation
                                      │           │
                                      │           ▼
                                      │    First Views (002, 004)
                                      │           │
                                      │           ▼
                                      └──► PREREQ-004: Canvas Highlighting
                                                  │
                                                  ▼
                                           Canvas Overlays (005, 006, 007)
                                                  │
                                                  ▼
                                           Meta Views (001, 003)
```

### PREREQ-001: Webpack 5 Caching Fix (CRITICAL)

**Problem:** Webpack 5 persistent caching prevents code changes from loading during development.

**Location of issue documentation:** `dev-docs/tasks/phase-2/TASK-004B-componentsPanel-react-migration/STATUS-BLOCKED.md`

**Must fix before:** Any development work

**Potential solutions:**
1. Disable persistent caching in dev mode (`cache: false` in webpack config)
2. Configure proper cache invalidation
3. Add cache-busting to development build

### PREREQ-002: React 19 Debug Fixes

**Problem:** Legacy `ReactDOM.render()` calls crash debug infrastructure.

**Files to fix:**
```
nodegrapheditor.debuginspectors.js  → Replace ReactDOM.render() with createRoot()
commentlayer.ts                     → Reuse existing root instead of creating new one
TextStylePicker.jsx                 → Replace ReactDOM.render() with createRoot()
```

**Pattern:**
```javascript
// Before (broken):
ReactDOM.render(<Component />, container);
ReactDOM.unmountComponentAtNode(container);

// After (correct):
if (!this.root) {
  this.root = createRoot(container);
}
this.root.render(<Component />);
// On dispose: this.root.unmount();
```

### PREREQ-003: Document Canvas Overlay Pattern

**Good news:** CommentLayer already works as a React overlay on the canvas!

**Task:** Study and document how CommentLayer works:
1. How it renders React over the canvas
2. How it responds to pan/zoom
3. How it integrates with selection
4. Extract reusable patterns for other overlays

**Key file:** `packages/noodl-editor/src/editor/src/views/nodegrapheditor/commentlayer.ts`

### PREREQ-004: Canvas Highlighting API

**Needed for:** VIEW-005 (Lineage), VIEW-006 (Impact), VIEW-007 (Layers)

**Create API for persistent, multi-channel highlighting:**
```typescript
interface CanvasHighlightAPI {
  highlightNodes(nodeIds: string[], options: HighlightOptions): HighlightHandle;
  highlightConnections(connections: ConnectionRef[], options: HighlightOptions): HighlightHandle;
  highlightPath(path: PathDefinition, options: HighlightOptions): HighlightHandle;
  clearChannel(channel: string): void;
  clearAll(): void;
}

interface HighlightOptions {
  channel: string;      // 'lineage', 'impact', 'selection'
  color?: string;
  style?: 'solid' | 'pulse' | 'glow';
  persistent?: boolean; // Stay until dismissed
}
```

**Key behavior:** Highlights persist across component navigation!

---

## Implementation Order

### Phase 1: Foundation (After Prerequisites)

**Start with VIEW-000** - this blocks everything else.

```
VIEW-000: Foundation & Shared Utilities
├── Graph traversal utilities
├── Cross-component resolution
├── View infrastructure (Meta Views, Overlays, Panels)
├── Navigation helpers
└── Debug infrastructure documentation
```

### Phase 2: Quick Wins (Can parallelize)

These are low complexity and don't need canvas overlays:

```
VIEW-002: Component X-Ray (Sidebar Panel)
VIEW-004: Node Census (Sidebar Panel)
```

### Phase 3: Canvas Overlays (After PREREQ-004)

```
VIEW-007: Semantic Layers (Canvas Overlay - simplest)
VIEW-005: Data Lineage (Canvas Overlay + panel)
VIEW-006: Impact Radar (Canvas Overlay + panel)
```

### Phase 4: Meta Views (Most complex)

```
VIEW-001: Project Topology Map (Meta View)
VIEW-003: Trigger Chain Debugger (Meta View - needs runtime integration)
```

---

## Key Architectural Decisions

### 1. Three View Types

**🗺️ Meta Views** replace the canvas entirely:
- Tab in header: `[🗺️ Canvas] [📊 Topology] [⚡ Triggers]`
- Full-screen project-wide or timeline view
- Component panel still exists but works differently

**📋 Sidebar Panels** open alongside canvas:
- Use existing SidebarModel (already React-ready)
- Click items to navigate/highlight on canvas

**🎨 Canvas Overlays** enhance the beloved canvas:
- Toggle buttons in canvas area: `[Layers] [Lineage] [Impact]`
- Based on CommentLayer pattern (already works!)
- Persistent highlighting until dismissed

### 2. Persistent Highlighting (Level 5000 Feature)

When user traces lineage:
1. Path lights up with glowing connections
2. User navigates to parent component
3. **Path STAYS LIT** on visible nodes
4. Indicator shows "Path continues in child: [Component Name]"
5. Click [×] to dismiss

### 3. Real-Time Updates

All views sync in real-time with:
- Canvas changes (add/remove nodes)
- Runtime state (live values)
- Preview interactions

### 4. State Persistence

View state persists across sessions:
- Active overlays
- Filter settings
- Traced paths

---

## Key Files & Locations

### Existing Code to Leverage

```
packages/noodl-editor/src/editor/src/
├── contexts/
│   └── NodeGraphContext/       # Already provides switchToComponent()
├── models/
│   ├── sidebar/sidebarmodel.tsx   # Already supports React panels
│   └── componentmodel.ts       # Component data
├── views/
│   └── nodegrapheditor/
│       ├── nodegrapheditor.ts  # Main canvas (2000+ lines)
│       └── commentlayer.ts     # TEMPLATE for overlays!
```

### New Code Locations

```
packages/noodl-editor/src/editor/src/
├── utils/
│   └── graphAnalysis/          # VIEW-000 utilities
│       ├── traversal.ts
│       ├── crossComponent.ts
│       ├── categorization.ts
│       └── duplicateDetection.ts
├── views/
│   ├── MetaViews/              # Meta view tab system
│   │   ├── MetaViewTabs.tsx
│   │   ├── TopologyMapView/
│   │   └── TriggerChainView/
│   ├── CanvasOverlays/         # Canvas overlay system
│   │   ├── CanvasOverlayManager.tsx
│   │   ├── LayersOverlay/
│   │   ├── LineageOverlay/
│   │   └── ImpactOverlay/
│   └── panels/                 # Sidebar panels (existing pattern)
│       ├── XRayPanel/
│       └── CensusPanel/
```

---

## Testing Strategy

### For Each View

1. **Unit tests** for graph analysis utilities
2. **Integration tests** for view rendering
3. **Manual testing** with complex real projects

### Test Projects

Use projects with:
- Deep component nesting (5+ levels)
- Cross-component data flow
- Duplicate node names
- Complex event chains

---

## Common Patterns

### Registering a Sidebar Panel

```typescript
SidebarModel.instance.register({
  id: 'xray',
  name: 'X-Ray',
  icon: IconName.Search,
  panel: ComponentXRayPanel  // React component
});
```

### Navigating to Canvas

```typescript
import { NodeGraphContextTmp } from '@noodl-contexts/NodeGraphContext';

// Switch to component
NodeGraphContextTmp.switchToComponent(component, {
  node: nodeId,           // Optional: select specific node
  zoomToFit: true
});
```

### Accessing Project Data

```typescript
import { ProjectModel } from '@noodl-models/projectmodel';

// Get all components
ProjectModel.instance.getComponents();

// Get component by name
ProjectModel.instance.getComponentWithName('/MyComponent');

// Get current component
nodeGraph.activeComponent;
```

---

## Troubleshooting

### "Changes not loading"
→ Webpack caching issue. See PREREQ-001.

### "ReactDOM.render is not a function"
→ React 19 migration incomplete. See PREREQ-002.

### "Debug inspector crashes"
→ Legacy React patterns in debug code. See PREREQ-002.

### "Canvas overlay not responding to zoom"
→ Check CommentLayer pattern for transform handling.

---

## Success Criteria

For the complete project:

- [ ] Prerequisites resolved (webpack, React 19, overlay pattern, highlighting API)
- [ ] VIEW-000 foundation complete and tested
- [ ] All 7 views implemented and functional
- [ ] Persistent highlighting works across component navigation
- [ ] Real-time updates working
- [ ] State persists across sessions
- [ ] No regressions in existing canvas functionality
- [ ] Performance acceptable with large projects (100+ components)

---

## Reference Documents

- **[README.md](./README.md)** - Project overview and architecture
- **[VIEW-PREREQ-modernization-roadmap.md](./VIEW-PREREQ-modernization-roadmap.md)** - Prerequisites detail
- **[VIEW-000-foundation/README.md](./VIEW-000-foundation/README.md)** - Foundation implementation
- **Individual VIEW-XXX folders** - Detailed specs for each view

---

## Questions?

If you encounter blockers or need clarification:
1. Check the individual VIEW-XXX README for detailed specs
2. Reference existing patterns in codebase (CommentLayer, SidebarModel)
3. Document discoveries in a LEARNINGS.md file for future reference
