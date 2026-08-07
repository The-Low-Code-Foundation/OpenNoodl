# Project: Node Canvas Editor Modernization

## Overview

**Goal:** Transform the custom node canvas editor from an opaque, monolithic legacy system into a well-documented, modular, and testable architecture that the team can confidently extend and maintain.

**Why this matters:**
- The canvas is the core developer UX - every user interaction flows through it
- Current ~2000+ line monolith (`nodegrapheditor.ts`) is intimidating for contributors
- AI-assisted coding works dramatically better with smaller, focused files
- Enables future features (minimap, connection tracing, better comments) without fear
- Establishes patterns for modernizing other legacy parts of the codebase

**Out of scope (for now):**
- Migration to React Flow or other library
- Runtime/execution changes
- New feature implementation (those come after this foundation)

> **Decision re-validation (2026-07-23).** The "not React Flow / keep Canvas 2D" constraint was pressure-tested against the live code and the full downstream roadmap, and it held. Two reasons worth recording: (a) the renderer paints all nodes into one bitmap per frame with viewport culling and reaches the ~2,900-node corpus projects — a DOM-per-node library would cap that, so this is a *performance* decision, not only an ergonomic one; (b) the model/view seam is already clean (the event-emitting `NodeGraphModel` is renderer-agnostic; a renderer plugs in at `bindModel`/`switchToComponent`), so keeping the renderer is **not** lock-in — the option to swap later survives untouched. The real debt is confined to the imperative view file, exactly as this project scopes it. Note also that the line-count table below predates growth: `nodegrapheditor.ts` is now **3,481** lines, `NodeGraphEditorNode.ts` **1,290**, `NodeGraphEditorConnection.ts` **416**. Detailed seam findings and file references live in the task that implements this, [`PLAT-001-CANVAS-DECOMPOSITION.md`](../tasks/phase-14-editor-platform-health/PLAT-001-CANVAS-DECOMPOSITION.md) → "Architecture review (2026-07-23)".

---

## Current Architecture Analysis

### Core Files

| File | Lines (est.) | Responsibility | Coupling Level |
|------|--------------|----------------|----------------|
| `nodegrapheditor.ts` | ~2000+ | Everything: rendering, interaction, selection, pan/zoom, connections, undo, clipboard | Extreme - God object |
| `NodeGraphEditorNode.ts` | ~600 | Node rendering, layout, port drawing | High - tied to parent |
| `NodeGraphEditorConnection.ts` | ~300 | Connection/noodle rendering, hit testing | Medium |
| `commentlayer.ts` | ~400 | Comment system orchestration | Medium - React bridge |
| `CommentLayer/*.tsx` | ~500 total | Comment React components | Lower - mostly isolated |

### Key Integration Points

The canvas talks to these systems (will need interface boundaries):
- `ProjectModel.instance` - Project state singleton
- `NodeLibrary.instance` - Node type definitions, color schemes
- `DebugInspector.InspectorsModel` - Data inspection/pinning
- `WarningsModel.instance` - Node warning states
- `UndoQueue.instance` - Undo/redo management
- `EventDispatcher.instance` - Global event bus
- `PopupLayer.instance` - Context menus, tooltips
- `ToastLayer` - User notifications

### Current Rendering Pipeline

```
paint() called
  → clearRect()
  → scale & translate context
  → paintHierarchy() - parent/child lines
  → paint connections (normal)
  → paint connections (highlighted - second pass for z-order)
  → paint nodes
  → paint drag indicators
  → paint multiselect box
  → paint dragging connection preview
```

### Current Interaction Handling

All mouse events funnel through single `mouse(type, pos, evt)` method with massive switch/if chains handling:
- Node selection (single, multi, add-to)
- Node dragging
- Connection creation
- Pan (right-click, middle-click, space+left)
- Zoom (wheel)
- Context menus
- Insert location indicators

---

## Target Architecture

### Module Structure

```
views/
└── NodeGraphEditor/
    ├── index.ts                    # Public API export
    ├── NodeGraphEditor.ts          # Main orchestrator (slim)
    ├── ARCHITECTURE.md             # Living documentation
    │
    ├── core/
    │   ├── CanvasRenderer.ts       # Canvas 2D rendering pipeline
    │   ├── ViewportManager.ts      # Pan, zoom, scale, bounds
    │   ├── GraphLayout.ts          # Node positioning, AABB calculations
    │   └── types.ts                # Shared interfaces and types
    │
    ├── interaction/
    │   ├── InteractionManager.ts   # Mouse/keyboard event routing
    │   ├── SelectionManager.ts     # Single/multi select, highlight state
    │   ├── DragManager.ts          # Node dragging, drop targets
    │   ├── ConnectionDragManager.ts # Creating new connections
    │   └── PanZoomHandler.ts       # Viewport manipulation
    │
    ├── rendering/
    │   ├── NodeRenderer.ts         # Individual node painting
    │   ├── ConnectionRenderer.ts   # Connection/noodle painting
    │   ├── HierarchyRenderer.ts    # Parent-child relationship lines
    │   └── OverlayRenderer.ts      # Selection boxes, drag previews
    │
    ├── features/
    │   ├── ClipboardManager.ts     # Cut, copy, paste
    │   ├── UndoIntegration.ts      # UndoQueue bridge
    │   ├── ContextMenus.ts         # Right-click menus
    │   └── ConnectionTracer.ts     # NEW: Connection chain navigation
    │
    ├── comments/                   # Existing React layer (enhance)
    │   ├── CommentLayer.ts
    │   ├── CommentLayerView.tsx
    │   ├── CommentForeground.tsx
    │   ├── CommentBackground.tsx
    │   └── CommentStyles.ts        # NEW: Extended styling options
    │
    └── __tests__/
        ├── CanvasRenderer.test.ts
        ├── ViewportManager.test.ts
        ├── SelectionManager.test.ts
        ├── ConnectionRenderer.test.ts
        └── integration/
            └── NodeGraphEditor.integration.test.ts
```

### Key Interfaces

```typescript
// core/types.ts

export interface IViewport {
  readonly pan: { x: number; y: number };
  readonly scale: number;
  readonly bounds: AABB;
  
  setPan(x: number, y: number): void;
  setScale(scale: number, focalPoint?: Point): void;
  screenToCanvas(screenPoint: Point): Point;
  canvasToScreen(canvasPoint: Point): Point;
  fitToContent(padding?: number): void;
}

export interface ISelectionManager {
  readonly selectedNodes: ReadonlyArray<NodeGraphEditorNode>;
  readonly highlightedNode: NodeGraphEditorNode | null;
  readonly highlightedConnection: NodeGraphEditorConnection | null;
  
  select(nodes: NodeGraphEditorNode[]): void;
  addToSelection(node: NodeGraphEditorNode): void;
  removeFromSelection(node: NodeGraphEditorNode): void;
  clearSelection(): void;
  setHighlight(node: NodeGraphEditorNode | null): void;
  isSelected(node: NodeGraphEditorNode): boolean;
  
  // Events
  on(event: 'selectionChanged', handler: (nodes: NodeGraphEditorNode[]) => void): void;
}

export interface IConnectionTracer {
  // Start tracing from a connection
  startTrace(connection: NodeGraphEditorConnection): void;
  
  // Navigate along the trace
  nextConnection(): NodeGraphEditorConnection | null;
  previousConnection(): NodeGraphEditorConnection | null;
  
  // Get all connections in current trace
  getTraceChain(): ReadonlyArray<NodeGraphEditorConnection>;
  
  // Clear trace state
  clearTrace(): void;
  
  // Visual state
  readonly activeTrace: ReadonlyArray<NodeGraphEditorConnection>;
}

export interface IRenderContext {
  ctx: CanvasRenderingContext2D;
  viewport: IViewport;
  paintRect: AABB;
  theme: ColorScheme;
}
```

---

## Implementation Phases

### Phase 1: Documentation & Analysis (3-4 days)

**Goal:** Fully understand and document current system before changing anything.

**Tasks:**
1. Create `ARCHITECTURE.md` documenting:
   - Current file responsibilities
   - Data flow diagrams
   - Event flow diagrams
   - Integration point catalog
   - Known quirks and gotchas

2. Add inline documentation to existing code:
   - JSDoc for all public methods
   - Explain non-obvious logic
   - Mark technical debt with `// TODO(canvas-refactor):`

3. Create dependency graph visualization

**Deliverables:**
- `NodeGraphEditor/ARCHITECTURE.md`
- Fully documented `nodegrapheditor.ts` (comments only, no code changes)
- Mermaid diagram of component interactions

**Confidence checkpoint:** Can explain any part of the canvas system to a new developer.

---

### Phase 2: Testing Foundation (4-5 days)

**Goal:** Establish testing infrastructure before refactoring.

**Tasks:**
1. Set up testing environment for canvas code:
   - Jest configuration for canvas mocking
   - Helper utilities for creating test nodes/connections
   - Snapshot testing for render output (optional)

2. Write characterization tests for current behavior:
   - Selection behavior (single click, shift+click, ctrl+click, marquee)
   - Pan/zoom behavior
   - Connection creation
   - Clipboard operations
   - Undo/redo integration

3. Create test fixtures:
   - Sample graph configurations
   - Mock ProjectModel, NodeLibrary, etc.

**Deliverables:**
- `__tests__/` directory structure
- Test utilities and fixtures
- 70%+ characterization test coverage for interaction logic
- CI integration for canvas tests

**Confidence checkpoint:** Tests catch regressions when code is modified.

---

### Phase 3: Extract Core Modules (5-6 days)

**Goal:** Pull out clearly separable concerns without changing behavior.

**Order of extraction (lowest risk first):**

1. **ViewportManager** (~1 day)
   - Extract: `getPanAndScale`, `setPanAndScale`, `clampPanAndScale`, `updateZoomLevel`, `centerToFit`
   - Pure calculations, minimal dependencies
   - Easy to test independently

2. **GraphLayout** (~1 day)
   - Extract: `calculateNodesAABB`, `getCenterPanAndScale`, `getCenterRootPanAndScale`, AABB utilities
   - Pure geometry calculations
   - Easy to test

3. **SelectionManager** (~1.5 days)
   - Extract: `selector` object, highlight state, multi-select logic
   - Currently scattered across mouse handlers
   - Introduce event emitter for state changes

4. **ClipboardManager** (~1 day)
   - Extract: `copySelected`, `paste`, `getNodeSetFromClipboard`, `insertNodeSet`
   - Relatively self-contained

5. **Types & Interfaces** (~0.5 days)
   - Create `types.ts` with all shared interfaces
   - Migrate inline types

**Approach for each extraction:**
```
1. Create new file with extracted code
2. Import into nodegrapheditor.ts
3. Delegate calls to new module
4. Run tests - verify no behavior change
5. Commit
```

**Deliverables:**
- `core/ViewportManager.ts` with tests
- `core/GraphLayout.ts` with tests
- `interaction/SelectionManager.ts` with tests
- `features/ClipboardManager.ts` with tests
- `core/types.ts`

**Confidence checkpoint:** `nodegrapheditor.ts` reduced by ~400-500 lines, all tests pass.

---

### Phase 4: Extract Rendering Pipeline (4-5 days)

**Goal:** Separate what we draw from when/why we draw it.

**Tasks:**

1. **CanvasRenderer** (~1.5 days)
   - Extract: `paint()` method orchestration
   - Introduce `IRenderContext` for dependency injection
   - Make rendering stateless (receives state, outputs pixels)

2. **NodeRenderer** (~1 day)
   - Extract from `NodeGraphEditorNode.paint()`
   - Parameterize colors, sizes for future customization
   - Document the rendering anatomy of a node

3. **ConnectionRenderer** (~1 day)
   - Extract from `NodeGraphEditorConnection.paint()`
   - Prepare for future routing algorithms
   - Add support for trace highlighting (prep for Phase 6)

4. **OverlayRenderer** (~0.5 days)
   - Extract: multiselect box, drag preview, insert indicators
   - These are temporary visual states

**Deliverables:**
- `rendering/` module with all renderers
- Renderer unit tests
- Clear separation: state management ≠ rendering

**Confidence checkpoint:** Can modify node appearance without touching interaction code.

---

### Phase 5: Extract Interaction Handling (4-5 days)

**Goal:** Untangle the mouse event spaghetti.

**Tasks:**

1. **InteractionManager** (~1 day)
   - Central event router
   - Delegates to specialized handlers based on state
   - Manages interaction modes (normal, panning, dragging, connecting)

2. **DragManager** (~1 day)
   - Node drag start/move/end
   - Drop target detection
   - Insert location indicators

3. **ConnectionDragManager** (~1 day)
   - New connection creation flow
   - Port detection and highlighting
   - Connection preview rendering

4. **PanZoomHandler** (~0.5 days)
   - Mouse wheel zoom
   - Right/middle click pan
   - Space+drag pan

5. **Refactor main mouse() method** (~0.5 days)
   - Reduce to simple routing logic
   - Each handler owns its interaction mode

**Deliverables:**
- `interaction/` module complete
- Interaction tests (simulate mouse events)
- `nodegrapheditor.ts` mouse handling reduced to ~50 lines

**Confidence checkpoint:** Can add new interaction modes without touching existing handlers.

---

### Phase 6: Feature Enablement - Connection Tracer (3-4 days)

**Goal:** Implement connection tracing as proof that the new architecture works.

**Feature spec:**
- Click a connection to start tracing
- Highlighted connection chain shows the data flow path
- Keyboard navigation (Tab/Shift+Tab) to walk the chain
- Visual distinction for traced connections (glow, thicker line, different color)
- Click elsewhere or Escape to clear trace

**Tasks:**

1. **ConnectionTracer module** (~1.5 days)
   - Graph traversal logic
   - Find upstream/downstream connections from a node's port
   - Handle cycles gracefully

2. **Visual integration** (~1 day)
   - Extend `ConnectionRenderer` for trace state
   - Add trace highlight color to theme
   - Subtle animation for active trace (optional)

3. **Interaction integration** (~1 day)
   - Add to `InteractionManager`
   - Keyboard handler for navigation
   - Context menu option: "Trace connection"

**Deliverables:**
- `features/ConnectionTracer.ts` with full tests
- Working connection tracing feature
- Documentation for how to add similar features

**Confidence checkpoint:** Feature works, and implementation was straightforward given new architecture.

---

### Phase 7: Feature Enablement - Comment Enhancements (2-3 days)

**Goal:** Improve comment system as second proof point.

**Feature spec:**
- More color options
- Border style options (solid, dashed, none)
- Font size options (small, medium, large, extra-large)
- Opacity control for filled comments
- Corner radius options
- Z-index control (send to back, bring to front)

**Tasks:**

1. **Extend comment model** (~0.5 days)
   - Add new properties: borderStyle, fontSize, opacity, cornerRadius, zIndex
   - Migration for existing comments (defaults)

2. **Update CommentForeground controls** (~1 day)
   - Extended toolbar UI
   - New control components

3. **Update rendering** (~0.5 days)
   - Apply new styles in CommentBackground
   - CSS updates

4. **Tests** (~0.5 days)
   - Comment styling tests
   - Backward compatibility tests

**Deliverables:**
- Enhanced comment styling options
- Updated `CommentStyles.ts`
- Tests for new functionality

---

## File Change Summary

### Files to Create

```
views/NodeGraphEditor/
├── ARCHITECTURE.md
├── core/
│   ├── CanvasRenderer.ts
│   ├── ViewportManager.ts
│   ├── GraphLayout.ts
│   └── types.ts
├── interaction/
│   ├── InteractionManager.ts
│   ├── SelectionManager.ts
│   ├── DragManager.ts
│   ├── ConnectionDragManager.ts
│   └── PanZoomHandler.ts
├── rendering/
│   ├── NodeRenderer.ts
│   ├── ConnectionRenderer.ts
│   ├── HierarchyRenderer.ts
│   └── OverlayRenderer.ts
├── features/
│   ├── ClipboardManager.ts
│   ├── UndoIntegration.ts
│   ├── ContextMenus.ts
│   └── ConnectionTracer.ts
├── comments/
│   └── CommentStyles.ts
└── __tests__/
    └── [comprehensive test suite]
```

### Files to Modify

- `nodegrapheditor.ts` → Slim orchestrator importing modules
- `NodeGraphEditorNode.ts` → Delegate rendering to NodeRenderer
- `NodeGraphEditorConnection.ts` → Delegate rendering to ConnectionRenderer
- `CommentLayerView.tsx` → Extended styling UI
- `CommentForeground.tsx` → New controls
- `CommentBackground.tsx` → New style application

### Files Unchanged

- `commentlayer.ts` → Keep as bridge layer (minor updates)
- Model files (ProjectModel, NodeLibrary, etc.) → Interface boundaries only

---

## Testing Strategy

### Unit Tests

Each extracted module gets comprehensive unit tests:

```typescript
// Example: ViewportManager.test.ts

describe('ViewportManager', () => {
  describe('screenToCanvas', () => {
    it('converts screen coordinates at scale 1', () => {
      const viewport = new ViewportManager({ width: 800, height: 600 });
      viewport.setPan(100, 50);
      
      const result = viewport.screenToCanvas({ x: 200, y: 150 });
      
      expect(result).toEqual({ x: 100, y: 100 });
    });
    
    it('accounts for scale when converting', () => {
      const viewport = new ViewportManager({ width: 800, height: 600 });
      viewport.setScale(0.5);
      viewport.setPan(100, 50);
      
      const result = viewport.screenToCanvas({ x: 200, y: 150 });
      
      expect(result).toEqual({ x: 300, y: 250 });
    });
  });
  
  describe('fitToContent', () => {
    it('adjusts pan and scale to show all nodes', () => {
      // ...
    });
  });
});
```

### Integration Tests

Test module interactions:

```typescript
// Example: Selection + Rendering integration

describe('Selection rendering integration', () => {
  it('renders selection box around selected nodes', () => {
    const graph = createTestGraph([
      { id: 'node1', x: 0, y: 0 },
      { id: 'node2', x: 200, y: 0 }
    ]);
    const selection = new SelectionManager();
    const renderer = new CanvasRenderer();
    
    selection.select([graph.nodes[0], graph.nodes[1]]);
    renderer.render(graph, selection);
    
    expect(renderer.getLastRenderCall()).toContainOverlay('multiselect-box');
  });
});
```

### Characterization Tests

Capture current behavior before refactoring:

```typescript
// Example: Existing pan behavior

describe('Pan behavior (characterization)', () => {
  it('right-click drag pans the viewport', async () => {
    const editor = await createTestEditor();
    const initialPan = editor.getPanAndScale();
    
    await editor.simulateMouseEvent('down', { x: 100, y: 100, button: 2 });
    await editor.simulateMouseEvent('move', { x: 150, y: 120 });
    await editor.simulateMouseEvent('up', { x: 150, y: 120, button: 2 });
    
    const finalPan = editor.getPanAndScale();
    expect(finalPan.x - initialPan.x).toBe(50);
    expect(finalPan.y - initialPan.y).toBe(20);
  });
});
```

---

## Success Criteria

### Quantitative

- [ ] `nodegrapheditor.ts` reduced from ~2000 to <500 lines
- [ ] No single file >400 lines in new structure
- [ ] Test coverage >80% for new modules
- [ ] All existing functionality preserved (zero regressions)

### Qualitative

- [ ] New developer can understand canvas architecture in <30 minutes
- [ ] Adding a new interaction mode takes <2 hours
- [ ] Adding a new visual effect takes <1 hour
- [ ] AI coding assistants can work effectively with individual modules
- [ ] `ARCHITECTURE.md` accurately describes the system

### Feature Validation

- [ ] Connection tracing works as specified
- [ ] Comment enhancements work as specified
- [ ] Both features implemented using new architecture patterns

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Hidden dependencies break during extraction | Medium | High | Extensive characterization tests before any changes |
| Performance regression from module overhead | Low | Medium | Benchmark critical paths, keep hot loops tight |
| Over-engineering abstractions | Medium | Medium | Extract only what exists, don't pre-build for imagined needs |
| Scope creep into features | Medium | Medium | Strict phase gates, no features until Phase 6 |
| Breaking existing user workflows | Low | High | Full test coverage, careful rollout |

---

## Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Documentation | 3-4 days | None |
| Phase 2: Testing Foundation | 4-5 days | Phase 1 |
| Phase 3: Core Modules | 5-6 days | Phase 2 |
| Phase 4: Rendering | 4-5 days | Phase 3 |
| Phase 5: Interaction | 4-5 days | Phase 3, 4 |
| Phase 6: Connection Tracer | 3-4 days | Phase 5 |
| Phase 7: Comment Enhancements | 2-3 days | Phase 4 |

**Total: 26-32 days** (5-7 weeks at sustainable pace)

Phases 6 and 7 can be done in parallel or interleaved with other work.

---

## Getting Started

1. Create feature branch: `feature/canvas-editor-modernization`
2. Start with Phase 1 - no code changes, just documentation
3. Review `ARCHITECTURE.md` with team before proceeding
4. Set up CI for canvas tests before Phase 3
5. Small, frequent commits with clear messages

---

## Appendix: Current Code Locations

```
packages/noodl-editor/src/editor/src/views/
├── nodegrapheditor.ts              # Main canvas (THE MONOLITH)
├── nodegrapheditor/
│   ├── NodeGraphEditorNode.ts      # Node rendering
│   └── NodeGraphEditorConnection.ts # Connection rendering
├── commentlayer.ts                 # Comment orchestration
├── CommentLayer/
│   ├── CommentLayer.css
│   ├── CommentLayerView.tsx
│   ├── CommentForeground.tsx
│   └── CommentBackground.tsx
└── documents/EditorDocument/
    └── hooks/
        ├── UseCanvasView.ts
        └── UseImportNodeset.ts
```

---

## Notes for AI-Assisted Development

When working with Cline or similar tools on this refactoring:

1. **Single module focus**: Work on one module at a time, complete with tests
2. **Confidence checks**: After each extraction, verify tests pass before continuing
3. **Small commits**: Each extraction should be a single, reviewable commit
4. **Documentation first**: Update `ARCHITECTURE.md` as you go
5. **No premature optimization**: Extract what exists, optimize later if needed

Example prompt structure for Phase 3 extractions:
```
"Extract ViewportManager from nodegrapheditor.ts:
1. Identify all pan/zoom/scale related code
2. Create core/ViewportManager.ts with those methods
3. Create interface IViewport in types.ts
4. Add comprehensive unit tests
5. Update nodegrapheditor.ts to use ViewportManager
6. Verify all existing tests still pass
7. Confidence score before committing?"
```
