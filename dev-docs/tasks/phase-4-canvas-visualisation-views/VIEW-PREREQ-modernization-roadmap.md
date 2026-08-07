# VIEW-PREREQ: Prerequisites & Modernization Roadmap

## Overview

**⚠️ DO NOT START VIEW IMPLEMENTATION until these prerequisites are complete.**

Before implementing the Canvas Visualization Views, several parts of the codebase need attention. This document maps out what needs to be done and in what order.

---

## Critical Path

```
┌─────────────────────────────────────────────────────────────────────┐
│  PREREQ-001: Fix Webpack Caching                                    │
│  ══════════════════════════════════════════════════════════════     │
│  STATUS: BLOCKING EVERYTHING                                        │
│  Without this fix, you cannot test any code changes reliably.       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PREREQ-002: React 19 Debug Fixes     PREREQ-003: Document Overlays │
│  (0.5-1 day)                          (1-2 days)                    │
│  Can run in parallel                                                │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  VIEW-000: Foundation                                               │
│  (4-5 days)                                                         │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PREREQ-004: Canvas Highlighting API                                │
│  (1-2 days)                                                         │
│  Needed for canvas overlays                                         │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  VIEW IMPLEMENTATION                                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Current State Assessment

### ✅ Already Modernized (Ready to Use)

| Component | Status | Notes |
|-----------|--------|-------|
| **SidebarModel** | React-ready | Already supports React components via `panel` prop |
| **SidePanel.tsx** | React | Container that hosts sidebar panels |
| **NodeGraphContext** | React | Provides `switchToComponent()` - perfect for navigation |
| **CommentLayer** | React overlay on canvas | **Template for how to add canvas overlays!** |

### ⚠️ In Progress / Blocked

| Component | Status | Blocker | Impact on Views |
|-----------|--------|---------|-----------------|
| **ComponentsPanel** | 85% migrated | Webpack 5 caching | Census badges, Topology highlighting |
| **React 19 fixes** | Partial | Legacy ReactDOM.render() calls | Debug infrastructure for Trigger Chain |

### ❌ Legacy (Needs Modernization)

| Component | Lines | Current State | Impact on Views |
|-----------|-------|---------------|-----------------|
| **NodeGraphEditor.ts** | ~2000+ | Monolithic jQuery | Canvas overlays, highlighting |
| **DebugInspector** | ~400 | Legacy React patterns | Trigger Chain, Data Lineage live values |
| **TextStylePicker** | ~200 | Legacy ReactDOM | Minor |

---

## Critical Path Analysis

### For Canvas Overlays (Layers, Lineage Highlighting, Impact Highlighting)

The **CommentLayer** is already a working example of a React overlay on the canvas! It:
- Renders React components over the canvas
- Responds to canvas zoom/pan
- Integrates with selection system

**What we need:**
1. Study CommentLayer pattern
2. Create generic `CanvasOverlay` system based on it
3. Clean hooks in NodeGraphEditor for:
   - Node/connection highlighting (partially exists)
   - Overlay coordinate transforms
   - Event interception for overlay interactions

### For Meta Views (Topology, Trigger Chain)

These **replace** the canvas, so they need less from NodeGraphEditor. But they need:
1. View Switcher in the header
2. Access to ProjectModel (already available)
3. Navigation back to canvas (NodeGraphContext already provides this)

### For Sidebar Panels (X-Ray, Census panels)

SidebarModel already supports React, so these can be built now. But for **integration features** like:
- Highlighting nodes from Census panel
- Showing badges in ComponentsPanel

...we need the blocked work resolved.

---

## Recommended Prerequisite Tasks

### PREREQ-001: Resolve Webpack 5 Caching Issue
**Priority:** CRITICAL  
**Estimate:** 1-2 days  
**Blocks:** Everything that touches existing code

The ComponentsPanel migration revealed that Webpack 5 persistent caching prevents code changes from loading. This will block ALL development, not just views.

**Options:**
1. Disable persistent caching in dev mode
2. Configure cache invalidation properly
3. Add cache-busting to build process

**Must fix first** - otherwise we can't test any changes reliably.

### PREREQ-002: Complete React 19 Migration for Debug Infrastructure  
**Priority:** HIGH  
**Estimate:** 0.5-1 day  
**Blocks:** VIEW-003 (Trigger Chain), VIEW-005 (Data Lineage live values)

Files that need fixing:
```
nodegrapheditor.debuginspectors.js  → Uses legacy ReactDOM.render()
commentlayer.ts                     → Creates new createRoot() on every render (already noted)
TextStylePicker.jsx                 → Uses legacy ReactDOM.render()
```

These are causing crashes in the debug inspector system which we need for Trigger Chain.

### PREREQ-003: Document/Stabilize Canvas Overlay Pattern
**Priority:** HIGH  
**Estimate:** 1-2 days  
**Blocks:** VIEW-007 (Semantic Layers), Lineage highlighting, Impact highlighting

CommentLayer already works as an overlay. We need to:
1. Document how it works
2. Extract reusable patterns
3. Create `CanvasOverlayManager` that can host multiple overlays
4. Define the coordinate transform API

This doesn't require NodeGraphEditor refactoring - just understanding and formalizing what exists.

### PREREQ-004: Add Canvas Highlighting API
**Priority:** MEDIUM  
**Estimate:** 1-2 days  
**Blocks:** Persistent lineage highlighting, impact highlighting on canvas

The canvas already highlights nodes momentarily (for debug). We need:
1. Persistent highlighting (stays until dismissed)
2. Connection path highlighting
3. Multiple highlight "channels" (lineage = blue, impact = orange, etc.)
4. API for external code to control highlights

```typescript
// Desired API:
interface CanvasHighlightAPI {
  highlightNodes(nodeIds: string[], options: HighlightOptions): HighlightHandle;
  highlightConnections(connections: Connection[], options: HighlightOptions): HighlightHandle;
  highlightPath(path: PathDefinition, options: HighlightOptions): HighlightHandle;
}

interface HighlightHandle {
  update(nodeIds: string[]): void;  // Change what's highlighted
  dismiss(): void;                   // Remove highlighting
}

interface HighlightOptions {
  color?: string;
  style?: 'solid' | 'pulse' | 'glow';
  persistent?: boolean;  // Stay until explicitly dismissed
  channel?: string;      // 'lineage', 'impact', 'selection', etc.
}
```

### PREREQ-005: Complete ComponentsPanel React Migration
**Priority:** MEDIUM  
**Estimate:** 2-3 days (after webpack fix)  
**Blocks:** Census badges in panel, Topology component highlighting

The migration is 85% done. Once webpack caching is fixed:
1. Verify the existing React code works
2. Complete remaining features
3. Add extension points for badges/highlighting

### PREREQ-006: NodeGraphEditor Partial Modernization (Optional)
**Priority:** LOW (for views project)  
**Estimate:** 5-10 days  
**Nice to have, not blocking**

The full canvas modernization project is documented in `CANVAS-MODERNISATION-PROJECT.md`. For the views project, we DON'T need the full refactor. We just need clean interfaces for:
- Overlay rendering
- Highlighting
- Navigation

These can be added incrementally without the full breakup.

---

## Recommended Order

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PHASE 0: Unblock                            │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ PREREQ-001: Fix Webpack Caching                              │   │
│  │ (CRITICAL - everything else depends on this)                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    PHASE 1: Foundation (Parallel)                   │
│                                                                     │
│  ┌──────────────────────┐  ┌──────────────────────┐                │
│  │ PREREQ-002:          │  │ PREREQ-003:          │                │
│  │ React 19 Debug Fixes │  │ Document Overlay     │                │
│  │ (0.5-1 day)          │  │ Pattern (1-2 days)   │                │
│  └──────────────────────┘  └──────────────────────┘                │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ VIEW-000: Foundation (Graph utils, View Switcher, etc.)      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    PHASE 2: First Views (Parallel)                  │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ VIEW-001:        │  │ VIEW-002:        │  │ VIEW-004:        │  │
│  │ Topology Map     │  │ X-Ray            │  │ Census           │  │
│  │ (Meta View)      │  │ (Sidebar Panel)  │  │ (Sidebar Panel)  │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
│                                                                     │
│  These don't need canvas overlays - can build immediately           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    PHASE 3: Canvas Integration                      │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ PREREQ-004: Canvas Highlighting API                          │   │
│  │ (1-2 days)                                                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ VIEW-007:        │  │ VIEW-005:        │  │ VIEW-006:        │  │
│  │ Semantic Layers  │  │ Data Lineage     │  │ Impact Radar     │  │
│  │ (Canvas Overlay) │  │ (+ highlighting) │  │ (+ highlighting) │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    PHASE 4: Advanced                                │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ VIEW-003: Trigger Chain Debugger                             │   │
│  │ (Needs React 19 debug fixes + runtime integration)           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## The Good News: CommentLayer is Our Template!

Looking at `commentlayer.ts`, we already have a working React overlay on the canvas. Key patterns:

```typescript
// CommentLayer creates React elements that float over the canvas
// and respond to pan/zoom

class CommentLayer {
  // Uses createRoot (needs the React 19 fix for reuse)
  root: Root;
  
  // Responds to viewport changes
  _renderReact() {
    this.root.render(
      <CommentLayerView
        scale={this.editor.scale}
        pan={this.editor.pan}
        // ... passes canvas transforms to React
      />
    );
  }
}
```

We can build on this pattern for all canvas overlays!

---

## Effort Summary

| Task | Estimate | Cumulative |
|------|----------|------------|
| PREREQ-001: Webpack fix | 1-2 days | 1-2 days |
| PREREQ-002: React 19 fixes | 0.5-1 day | 1.5-3 days |
| PREREQ-003: Document overlays | 1-2 days | 2.5-5 days |
| PREREQ-004: Highlighting API | 1-2 days | 3.5-7 days |
| PREREQ-005: ComponentsPanel | 2-3 days | 5.5-10 days (parallel) |
| **Total Prerequisites** | **~5-7 days** | (with parallelization) |

Then the views themselves: **25-34 days**

**Grand Total: ~30-41 days** for the complete visualization views system.

---

## Prerequisite Task Documents

Each prerequisite has a detailed implementation guide:

- **[PREREQ-001: Webpack Caching Fix](./PREREQ-001-webpack-caching/README.md)** - CRITICAL, do first
- **[PREREQ-002: React 19 Debug Fixes](./PREREQ-002-react19-debug-fixes/README.md)** - Fix legacy ReactDOM
- **[PREREQ-003: Canvas Overlay Pattern](./PREREQ-003-canvas-overlay-pattern/README.md)** - Study CommentLayer
- **[PREREQ-004: Canvas Highlighting API](./PREREQ-004-highlighting-api/README.md)** - Persistent highlights

---

## Files to Reference

- `dev-docs/future-projects/CANVAS-MODERNISATION-PROJECT.md` - Full canvas modernization vision
- `packages/noodl-editor/src/editor/src/views/nodegrapheditor/commentlayer.ts` - Working overlay pattern
- `dev-docs/tasks/phase-2/TASK-004B-componentsPanel-react-migration/STATUS-BLOCKED.md` - Webpack caching issue details
- `dev-docs/tasks/phase-2/TASK-002-react19-ui-fixes/README.md` - React 19 migration issues
- `packages/noodl-editor/src/editor/src/contexts/NodeGraphContext/NodeGraphContext.tsx` - React context for navigation
