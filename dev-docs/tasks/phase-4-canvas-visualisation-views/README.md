# Project: Canvas Visualization Views

> **🤖 For Cline:** Start with **[CLINE-INSTRUCTIONS.md](./CLINE-INSTRUCTIONS.md)** for implementation guidance.

## Overview

**Goal:** Create a suite of complementary read-only views that help users understand complex node graphs without changing the core canvas editor. These views transform the same underlying data into different visual representations optimized for different questions.

**Status:** 📋 Ready for Implementation  
**Total Effort:** 30-41 days (including prerequisites)  
**Priority:** HIGH

**Why this matters:**
- Complex Noodl projects become unmanageable "node spaghetti" that's hard to understand
- The node canvas optimizes for *editing* but not for *understanding*
- Users spend enormous time zooming in/out, hunting for nodes, tracing connections
- Understanding another developer's project is currently a nightmare
- Debugging cross-component issues requires mental gymnastics

**Core Philosophy:**
- Read-only views (simplicity, no edit conflicts)
- Same data, different projections (all views derive from ComponentModel/NodeGraphModel)
- "Jump to canvas" from any view (views complement, don't replace)
- Progressive disclosure (start simple, drill down as needed)
- **Users love the existing canvas** - enhance it, don't replace it

---

## The Problem (Visual Evidence)

Complex Noodl canvases exhibit these pain points:

1. **Spatial chaos** - Logic nodes scattered among visual nodes with no organization
2. **Connection noise** - Noodles become meaningless lines when there are dozens
3. **Invisible boundaries** - Component boundaries aren't visible on canvas
4. **Duplicate confusion** - Same-named nodes in multiple places cause bugs
5. **Origin mystery** - "Where does this value actually come from?"
6. **Impact blindness** - "What will break if I change this?"
7. **Trigger tracing** - Following event chains across components is manual

---

## Proposed Views

| # | View Name | Type | Primary Question Answered | Complexity |
|---|-----------|------|---------------------------|------------|
| 1 | **Project Topology Map** | 🗺️ Meta View | "How is this project organized?" | Medium |
| 2 | **Component X-Ray** | 📋 Sidebar Panel | "What does this component do?" | Low |
| 3 | **Trigger Chain Debugger** | 🗺️ Meta View | "What's the sequence of events?" | High |
| 4 | **Node Census** | 📋 Sidebar Panel | "What nodes exist and are any duplicated?" | Low |
| 5 | **Data Lineage View** | 🎨 Canvas Overlay | "Where does this value originate?" | Medium |
| 6 | **Impact Radar** | 🎨 Canvas Overlay | "What breaks if I change this?" | Medium |
| 7 | **Semantic Layers** | 🎨 Canvas Overlay | "Can I see just the logic/just the visuals?" | Low |

### View Types Explained

**🗺️ Meta Views** - Replace the canvas entirely with a project-wide or timeline view
- Component panel still exists but works differently (click to highlight, not navigate)
- Examples: Topology Map (see all components), Trigger Chain (see recorded timeline)

**📋 Sidebar Panels** - Open alongside the existing canvas
- Don't replace anything, add information panels
- Click items to highlight/navigate on canvas
- Examples: X-Ray (component summary), Census (node inventory)

**🎨 Canvas Overlays** - Enhance the existing canvas you're already in
- Toggle buttons that ADD visualization to the beloved node canvas
- Persistent highlighting until dismissed
- Examples: Layers (filter visibility), Lineage (highlight data paths), Impact (show dependencies)

---

## Implementation Strategy

### Phase 1: Foundation (do first)
Build shared infrastructure that all views need:
- Graph traversal utilities
- Cross-component connection resolution
- View panel framework / tab system
- "Jump to canvas" navigation helper

### Phase 2: Quick Wins (low complexity, high value)
- VIEW-002: Component X-Ray
- VIEW-004: Node Census
- VIEW-007: Semantic Layers

### Phase 3: Core Value (medium complexity)
- VIEW-001: Project Topology Map
- VIEW-005: Data Lineage View
- VIEW-006: Impact Radar

### Phase 4: Advanced (high complexity)
- VIEW-003: Trigger Chain Debugger

---

## Technical Foundation

All views will leverage existing data structures:

```typescript
// Available from ComponentModel
component.graph.forEachNode((node) => { ... })
component.graph.findNodeWithId(id)
component.getAllConnections()
component.getPorts() // Component inputs/outputs

// Available from NodeGraphNode
node.type           // Node type info
node.parameters     // Current parameter values
node.getPorts()     // Input/output ports
node.parent         // Visual hierarchy (for visual nodes)
node.children       // Visual hierarchy (for visual nodes)
node.forAllConnectionsOnThisNode((connection) => { ... })

// Connection structure
{
  fromId: string,
  fromProperty: string,  // output port name
  toId: string,
  toProperty: string     // input port name
}
```

### Shared Utilities to Build

```typescript
// packages/noodl-editor/src/editor/src/utils/graphAnalysis/

// Traverse connections across component boundaries
traceConnectionChain(startNode, startPort, direction: 'upstream' | 'downstream')

// Find all usages of a component across the project
findComponentUsages(componentName: string): ComponentUsage[]

// Detect potential duplicate nodes
findPotentialDuplicates(component): DuplicateGroup[]

// Build component dependency graph
buildComponentDependencyGraph(project): DependencyGraph

// Categorize nodes by semantic type
categorizeNodes(component): CategorizedNodes
```

---

## UI Framework

Views will be implemented as React components accessible via:

1. **Sidebar Panel** - New "Analysis" or "Views" panel in the sidebar
2. **Keyboard Shortcut** - Quick access (e.g., `Cmd+Shift+V` for views menu)
3. **Context Menu** - Right-click node → "Show in Data Lineage" etc.

### View Panel Structure

```
┌─────────────────────────────────────────────────────────────┐
│ [Topology] [Census] [Lineage] [Impact] [Layers]     [×]    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                    View Content Here                        │
│                                                             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ Context: Presales Page  |  [Jump to Canvas]                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Success Criteria (Project-Level)

1. **Comprehension time reduced** - New developer can understand a complex page in minutes, not hours
2. **Bug discovery improved** - Duplicate nodes and connection issues are surfaced automatically
3. **Cross-component debugging possible** - Can trace data/events across component boundaries
4. **No canvas changes required** - All views are additive, read-only
5. **Performance acceptable** - Views render quickly even for large projects

---

## Prerequisites & Dependencies

**See [VIEW-PREREQ: Prerequisites & Modernization Roadmap](./VIEW-PREREQ-modernization-roadmap.md) for full details.**

### Critical Blockers

| Prerequisite | Why It's Needed | Estimate |
|--------------|-----------------|----------|
| **PREREQ-001: Webpack Caching Fix** | Can't test ANY changes reliably | 1-2 days |
| **PREREQ-002: React 19 Debug Fixes** | Debug infrastructure crashes, needed for Trigger Chain | 0.5-1 day |

### Required for Canvas Overlays

| Prerequisite | Why It's Needed | Estimate |
|--------------|-----------------|----------|
| **PREREQ-003: Document Overlay Pattern** | CommentLayer already works - formalize it | 1-2 days |
| **PREREQ-004: Canvas Highlighting API** | Persistent highlighting for Lineage/Impact | 1-2 days |

### Nice to Have

| Prerequisite | Why It's Needed | Estimate |
|--------------|-----------------|----------|
| **PREREQ-005: Complete ComponentsPanel** | Badges, highlighting in left panel | 2-3 days |
| **PREREQ-006: NodeGraphEditor Modernization** | Cleaner integration (not required) | 5-10 days |

### The Good News 🎉

**CommentLayer already exists as a React overlay on the canvas!** This proves the overlay pattern works. We just need to formalize it and extend it for our views.

### What's Already Ready

- ✅ SidebarModel - supports React panels
- ✅ NodeGraphContext - provides `switchToComponent()` navigation  
- ✅ CommentLayer - working canvas overlay template
- ✅ ProjectModel - graph data access

---

## Estimated Total Effort (Including Prerequisites)

### Prerequisites (~5-7 days with parallelization)

| Task | Estimate |
|------|----------|
| PREREQ-001: Webpack caching fix | 1-2 days |
| PREREQ-002: React 19 debug fixes | 0.5-1 day |
| PREREQ-003: Document overlay pattern | 1-2 days |
| PREREQ-004: Canvas highlighting API | 1-2 days |
| **Prerequisites Total** | **~5-7 days** |

### Views

| Task | Estimate |
|------|----------|
| VIEW-000: Foundation & Shared Utils | 4-5 days |
| VIEW-001: Project Topology Map | 4-5 days |
| VIEW-002: Component X-Ray | 2-3 days |
| VIEW-003: Trigger Chain Debugger | 5-7 days |
| VIEW-004: Node Census | 2-3 days |
| VIEW-005: Data Lineage View | 3-4 days |
| VIEW-006: Impact Radar | 3-4 days |
| VIEW-007: Semantic Layers | 2-3 days |
| **Views Total** | **25-34 days** |

### Grand Total: **30-41 days**

---

## Documentation

### For Implementation

- **[CLINE-INSTRUCTIONS.md](./CLINE-INSTRUCTIONS.md)** ← Implementation guide for Cline
- **[VIEW-PREREQ: Prerequisites Overview](./VIEW-PREREQ-modernization-roadmap.md)** ← What to fix before starting

### Prerequisite Tasks

- [PREREQ-001: Webpack Caching Fix](./PREREQ-001-webpack-caching/README.md) - 🔴 CRITICAL, do first
- [PREREQ-002: React 19 Debug Fixes](./PREREQ-002-react19-debug-fixes/README.md)
- [PREREQ-003: Canvas Overlay Pattern](./PREREQ-003-canvas-overlay-pattern/README.md)
- [PREREQ-004: Canvas Highlighting API](./PREREQ-004-highlighting-api/README.md)

### Task Specifications

- [VIEW-000: Foundation & Shared Utilities](./VIEW-000-foundation/README.md) - **START HERE** (blocks all others)
- [VIEW-001: Project Topology Map](./VIEW-001-project-topology-map/README.md) - 🗺️ Meta View
- [VIEW-002: Component X-Ray](./VIEW-002-component-xray/README.md) - 📋 Sidebar Panel
- [VIEW-003: Trigger Chain Debugger](./VIEW-003-trigger-chain-debugger/README.md) - 🗺️ Meta View
- [VIEW-004: Node Census](./VIEW-004-node-census/README.md) - 📋 Sidebar Panel
- [VIEW-005: Data Lineage View](./VIEW-005-data-lineage/README.md) - 🎨 Canvas Overlay
- [VIEW-006: Impact Radar](./VIEW-006-impact-radar/README.md) - 🎨 Canvas Overlay
- [VIEW-007: Semantic Layers](./VIEW-007-semantic-layers/README.md) - 🎨 Canvas Overlay

---

## Runtime Integration

**Noodl's killer feature is the live debugging** - nodes light up, connections animate, and you can see data flow in real-time when interacting with the preview. Some views need to integrate with this existing infrastructure.

### Runtime Integration Matrix

| View | Needs Runtime? | Why |
|------|----------------|-----|
| VIEW-000 Foundation | ⚠️ Document existing | Must understand debug infrastructure |
| VIEW-001 Topology Map | ❌ No | Static component relationships |
| VIEW-002 Component X-Ray | ❌ No | Static component analysis |
| VIEW-003 Trigger Chain | ✅ **CRITICAL** | Records live events across components |
| VIEW-004 Node Census | ❌ No | Static node inventory |
| VIEW-005 Data Lineage | ⚠️ Optional | Static paths, but live values enhance it |
| VIEW-007 Semantic Layers | ⚠️ Preserve | Must not break existing highlighting |

### Existing Infrastructure to Leverage

The editor already has powerful debugging:

```typescript
// Debug Inspector - live value inspection
DebugInspector.instance.getValueForPort(nodeId, port);

// Node/Connection highlighting  
nodeGraphEditor.highlightNode(node, duration);
nodeGraphEditor.highlightConnection(connection, duration);

// Runtime events (nodes emit these)
nodeInstance.on('outputChanged', (port, value) => { ... });
nodeInstance.on('signalSent', (port) => { ... });
```

### The Gap These Views Fill

**Current state**: You can see what's happening NOW in ONE component. To see the full flow, you manually navigate between components, losing context.

**With new views**: You can see what happened OVER TIME across ALL components simultaneously. Record → Review → Understand → Debug.

---

## Design Decisions

### 1. Three Types of Views

Rather than one unified view switcher, we have three distinct types:

#### 🗺️ Meta Views (Tab in Header)

Full-screen views that replace the canvas entirely:

```
┌─────────────────────────────────────────────────────────────────┐
│ [🗺️ Canvas] [📊 Topology] [⚡ Triggers]              [Preview ▶]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│              Topology Map / Trigger Timeline                    │
│                    (full canvas area)                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- **Topology Map** - See all components and their relationships
- **Trigger Chain** - See recorded event timeline across components

#### 📋 Sidebar Panels

Information panels that open alongside the canvas (like the existing Components panel):

- **X-Ray** - Component summary with inputs/outputs/dependencies
- **Census** - Node inventory with duplicate warnings

These use the existing SidebarModel system - already React-ready!

#### 🎨 Canvas Overlays (THE GAME CHANGER)

Enhancements to the existing node canvas that users already love:

```
┌─────────────────────────────────────────────────────────────────┐
│ Login Page                         [Layers] [Lineage ✓] [X-Ray]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────┐                    ┌─────────┐                   │
│   │REST ████│════════════════════│Object███│══╗  ← Glowing     │
│   │/api/user│   highlighted      │userData │  ║    path!       │
│   └─────────┘   connection       └─────────┘  ║                │
│                                               ║                │
│                                    ┌──────────╨────────┐       │
│                                    │String Format █████│       │
│                                    └───────────────────┘       │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ 🔗 Lineage: messageText                                    [×] │
│ REST /api/user → userData.name → String Format → ★ HERE        │
│ ⬆️ Trace continues in parent: App Shell               [Go ↗]  │
└─────────────────────────────────────────────────────────────────┘
```

**Key insight:** CommentLayer already proves this works! It's a React overlay on the canvas that responds to zoom/pan.

Overlays include:
- **Semantic Layers** - Filter what's visible (hide logic, show only data, etc.)
- **Data Lineage** - Highlight data flow paths WITH PERSISTENT HIGHLIGHTING
- **Impact Radar** - Highlight what depends on selected node

### 2. Persistent Highlighting (Level 5000)

When you trace lineage or impact, the highlighting STAYS on the canvas until you dismiss it:

- Right-click node → "Trace Data Lineage"
- Path lights up on canvas (glowing connections!)
- Small panel shows full path including cross-component parts
- Navigate to parent component → PATH STAYS LIT
- Click [×] on the overlay panel to dismiss

Multiple highlight "channels" can coexist:
- Blue glow = lineage path
- Orange glow = impact/dependencies
- Selection highlight = normal selection

### 3. Live Updates: Yes, Real-Time Sync

All views update in **real-time**, staying in sync with:
- Canvas changes (add/remove nodes, connections)
- Runtime state (live values, node activation)
- Preview interactions (for Trigger Chain recording)

This matches the current canvas/preview sync that makes Noodl magical.

### 4. Persistence: Yes

View state persists across sessions:
- Which overlays are active
- Expanded/collapsed sections
- Filter settings (Semantic Layers selections)
- Currently traced lineage paths

Stored per-component (different components can have different states).

---

## Open Questions (Remaining)

1. **Meta View Tab Location** - Where exactly should the [Canvas] [Topology] [Triggers] tabs go? In the existing header row? Replace breadcrumbs? New row above?

2. **Overlay Toggle Location** - Where do the [Layers] [Lineage] [Impact] toggle buttons go? Top-right of canvas area? Floating toolbar? Sidebar?

3. **Highlight Persistence Indicator** - When lineage highlighting persists across component navigation, should there be a visible indicator showing "You have active traces"? Badge somewhere?

4. **Multi-Component Lineage Display** - When a lineage path crosses 3+ components, and you're viewing one component, how do we show "trace continues in parent/child"? Mini-map? Breadcrumb-style path indicator?

5. **Overlay Conflicts** - Can you have Layers AND Lineage active simultaneously? If Layers hides a node that's in the lineage path, what happens? (Probably: lineage overrides layers for highlighted nodes)
