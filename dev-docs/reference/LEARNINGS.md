# Project Learnings

This document captures important discoveries and gotchas encountered during OpenNoodl development.

---

## 🐛 CRITICAL: Project.json Structure - Missing `graph` Object (Jan 9, 2026)

### The Silent Crash: Cannot Read Properties of Undefined (reading 'comments')

**Context**: Phase 0 TASK-010 - New project creation failed with `TypeError: Cannot read properties of undefined (reading 'comments')`. After three previous failed attempts, the root cause was finally identified: incorrect JSON structure in programmatic project creation.

**The Problem**: The programmatically generated project.json had `nodes` array directly in the component object, but the schema requires a `graph` object containing `roots`, `connections`, and `comments`.

**Root Cause**: Misunderstanding of the project.json schema hierarchy:

```
Component
  ├─ name
  ├─ id
  ├─ metadata
  └─ graph         ← REQUIRED
      ├─ roots     ← Was "nodes" (WRONG)
      ├─ connections
      └─ comments  ← Error occurred here
```

**The Broken Pattern**:

```typescript
// ❌ WRONG - Missing graph wrapper, comments field
const minimalProject = {
  name: name,
  components: [
    {
      name: 'App',
      ports: [],
      visual: true,
      visualStateTransitions: [],
      nodes: [
        // ☠️ Should be graph.roots, not nodes
        {
          id: guid(),
          type: 'Group'
          // ...
        }
      ]
    }
  ]
};

// ComponentModel.fromJSON calls NodeGraphModel.fromJSON(json.graph)
// But json.graph is undefined!
// NodeGraphModel.fromJSON tries to access json.comments
// BOOM: Cannot read properties of undefined (reading 'comments')
```

**The Correct Pattern**:

```typescript
// ✅ RIGHT - Complete structure with graph object
const minimalProject = {
  name: name,
  components: [
    {
      name: 'App',
      id: guid(), // Component needs id
      graph: {
        // Graph wrapper required
        roots: [
          // Not "nodes"
          {
            id: guid(),
            type: 'Group',
            x: 0,
            y: 0,
            parameters: {},
            ports: [],
            children: [
              {
                id: guid(),
                type: 'Text',
                x: 50,
                y: 50,
                parameters: { text: 'Hello World!' },
                ports: [],
                children: []
              }
            ]
          }
        ],
        connections: [], // Required array
        comments: [] // Required array (caused the error!)
      },
      metadata: {} // Component metadata
    }
  ],
  settings: {},
  metadata: {
    // Project metadata
    title: name,
    description: 'A new Noodl project'
  }
};
```

**Why This Was Hard to Debug**:

1. **Error message was misleading**: "reading 'comments'" suggested a problem with comments, not missing `graph` object
2. **Deep call stack**: Error originated 3 levels deep (ProjectModel → ComponentModel → NodeGraphModel)
3. **No schema documentation**: project.json structure wasn't formally documented
4. **Template file was truncated**: The actual template (`project-truncated.json`) had incomplete structure
5. **Multiple fix attempts**: Previous fixes addressed symptoms (path resolution) not root cause (structure)

**The Fix Journey**:

- **Attempt 1**: Path resolution with `__dirname` - FAILED (webpack bundling issue)
- **Attempt 2**: Path resolution with `process.cwd()` - FAILED (wrong directory)
- **Attempt 3**: Programmatic creation - FAILED (incomplete structure)
- **Attempt 4**: Complete structure with `graph` object - SUCCESS ✅

**Required Fields Hierarchy**:

```typescript
// Complete minimal project structure
{
  name: string,
  components: [{
    name: string,
    id: string,           // ← REQUIRED
    graph: {              // ← REQUIRED wrapper
      roots: [...],       // ← Was incorrectly "nodes"
      connections: [],    // ← REQUIRED array
      comments: []        // ← REQUIRED array (error occurred here)
    },
    metadata: {}          // ← REQUIRED object
  }],
  settings: {},           // ← REQUIRED object
  metadata: {             // ← Project-level metadata
    title: string,
    description: string
  }
}
```

**How to Identify This Issue**:

1. **Error**: `Cannot read properties of undefined (reading 'comments')`
2. **Stack trace**: Shows `NodeGraphModel.fromJSON` at line accessing `json.comments`
3. **Symptom**: Project creation appears to work but crashes when loading
4. **Root cause**: `ComponentModel.fromJSON` passes `json.graph` to `NodeGraphModel.fromJSON`, but `json.graph` is `undefined`

**Critical Rules**:

1. **Components have `graph` objects, not `nodes` arrays directly** - The nodes live in `graph.roots`
2. **Always include `comments` and `connections` arrays** - Even if empty, they must exist
3. **Component needs `id` field** - Can't rely on auto-generation
4. **Use actual template structure as reference** - Don't invent your own schema
5. **Test project creation end-to-end** - Not just file writing, but also loading

**Related Code Paths**:

```typescript
// The error chain:
ProjectModel.fromJSON(json)
  → calls ComponentModel.fromJSON(json.components[i])
    → calls NodeGraphModel.fromJSON(json.graph)  // ← json.graph is undefined!
      → accesses json.comments  // ← BOOM!
```

**Prevention**: When creating projects programmatically, always use this checklist:

- [ ] Component has `id` field
- [ ] Component has `graph` object (not `nodes` array)
- [ ] `graph.roots` array exists (not `nodes`)
- [ ] `graph.connections` array exists (can be empty)
- [ ] `graph.comments` array exists (can be empty)
- [ ] Component has `metadata` object (can be empty)
- [ ] Project has `settings` object (can be empty)
- [ ] Project has `metadata` object with `title` and `description`

**Time Lost**: ~6 hours across three failed attempts before finding root cause

**Location**:

- Fixed in: `packages/noodl-editor/src/editor/src/utils/LocalProjectsModel.ts` (lines 288-321)
- Error source: `packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphModel.ts` (line 57)
- Task: Phase 0 TASK-010 Project Creation Bug Fix
- CHANGELOG: `dev-docs/tasks/phase-0-foundation-stabilisation/TASK-010-project-creation-bug-fix/CHANGELOG.md`

**Impact**: This was a P0 blocker preventing all new users from creating projects. The fix allows project creation to work correctly without requiring external templates.

**Keywords**: project.json, schema, graph object, NodeGraphModel, ComponentModel, fromJSON, comments, roots, Cannot read properties of undefined, project creation, minimal project, structure

---

## 🎨 Canvas Overlay Pattern: React Over HTML5 Canvas (Jan 3, 2026)

### The Transform Trick: CSS scale() + translate() for Automatic Coordinate Transformation

**Context**: Phase 4 PREREQ-003 - Studying CommentLayer to understand how React components overlay the HTML5 Canvas node graph. Need to build Data Lineage, Impact Radar, and Semantic Layer visualizations using the same pattern.

**The Discovery**: The most elegant solution for overlaying React on Canvas uses CSS transforms on a parent container. Child React components automatically position themselves in canvas coordinates without manual recalculation.

**The Pattern**:

```typescript
// ❌ WRONG - Manual coordinate transformation for every element
function OverlayComponent({ node, viewport }) {
  const screenX = (node.x + viewport.pan.x) * viewport.scale;
  const screenY = (node.y + viewport.pan.y) * viewport.scale;

  return <div style={{ left: screenX, top: screenY }}>...</div>;
  // Problem: Must recalculate for every element, every render
}

// ✅ RIGHT - CSS transform on parent container
function OverlayContainer({ children, viewport }) {
  return (
    <div
      style={{
        transform: `scale(${viewport.scale}) translate(${viewport.pan.x}px, ${viewport.pan.y}px)`,
        transformOrigin: '0 0'
      }}
    >
      {children}
      {/* All children automatically positioned in canvas coordinates! */}
    </div>
  );
}

// React children use canvas coordinates directly
function NodeBadge({ node }) {
  return (
    <div style={{ position: 'absolute', left: node.x, top: node.y }}>
      {/* Works perfectly - transform handles the rest */}
    </div>
  );
}
```

**Why This Matters**:

- **Automatic transformation**: React children don't need coordinate math
- **Performance**: No per-element calculations on every render
- **Simplicity**: Overlay components use canvas coordinates naturally
- **Consistency**: Same coordinate system as canvas drawing code

**React 19 Root API Pattern** - Critical for overlays:

```typescript
// ❌ WRONG - Creates new root on every render (memory leak)
function updateOverlay() {
  createRoot(container).render(<Overlay />); // ☠️ New root each time
}

// ✅ RIGHT - Create once, reuse forever
class CanvasOverlay {
  private root: Root;

  constructor(container: HTMLElement) {
    this.root = createRoot(container); // Create once
  }

  render(props: OverlayProps) {
    this.root.render(<Overlay {...props} />); // Reuse root
  }

  dispose() {
    this.root.unmount(); // Clean up properly
  }
}
```

**Two-Layer System** - CommentLayer's architecture:

```
┌─────────────────────────────────────┐
│   Foreground Layer (z-index: 2)    │ ← Interactive controls
├─────────────────────────────────────┤
│   HTML5 Canvas (z-index: 1)        │ ← Node graph
├─────────────────────────────────────┤
│   Background Layer (z-index: 0)    │ ← Comment boxes with shadows
└─────────────────────────────────────┘
```

This allows:

- Comment boxes render **behind** canvas (no z-fighting with nodes)
- Interactive controls render **in front** of canvas (draggable handles)
- No z-index conflicts between overlay elements

**Mouse Event Forwarding** - The click-through solution:

```typescript
// Three-step pattern for handling clicks
overlayContainer.addEventListener('mousedown', (event) => {
  // Step 1: Capture the event
  const target = event.target as HTMLElement;

  // Step 2: Check if clicking on actual UI
  const clickedOnUI = target.style.pointerEvents !== 'none';

  // Step 3: If not UI, forward to canvas
  if (!clickedOnUI) {
    const canvasEvent = new MouseEvent('mousedown', event);
    canvasElement.dispatchEvent(canvasEvent);
  }
});
```

**EventDispatcher Context Pattern** - Must use context object:

```typescript
// ✅ BEST - Use useEventListener hook (built-in context handling)
import { useEventListener } from '@noodl-hooks/useEventListener';

// ❌ WRONG - Direct subscription in React (breaks on cleanup)
useEffect(() => {
  editor.on('viewportChanged', handler);
  return () => editor.off('viewportChanged', handler); // ☠️ Can't unsubscribe
}, []);

// ✅ RIGHT - Use context object for cleanup
useEffect(() => {
  const context = {};
  editor.on('viewportChanged', handler, context);
  return () => editor.off(context); // Removes all subscriptions with context
}, []);

useEventListener(editor, 'viewportChanged', (viewport) => {
  // Automatically handles context and cleanup
});
```

**Scale-Dependent vs Scale-Independent Sizing**:

```scss
// Scale-dependent - Grows/shrinks with zoom
.node-badge {
  font-size: 12px; // Affected by parent transform
  padding: 4px;
}

// Scale-independent - Stays same size
.floating-panel {
  position: fixed; // Not affected by transform
  top: 20px;
  right: 20px;
  font-size: 14px; // Always 14px regardless of zoom
}
```

**Common Gotchas**:

1. **React-rnd scale prop**: Must set scale on mount, can't update dynamically

   ```typescript
   // Set scale once when component mounts
   <Rnd scale={this.scale} onMount={...} />
   ```

2. **Transform affects ALL children**: Can't exempt specific elements

   - Solution: Use two overlays (one transformed, one not)

3. **Async rendering timing**: React 19 may batch updates

   ```typescript
   // Force immediate render with setTimeout
   setTimeout(() => this.root.render(<Overlay />), 0);
   ```

4. **EventDispatcher cleanup**: Must use context object, not direct references

**Documentation Created**:

- `CANVAS-OVERLAY-PATTERN.md` - Overview and quick start
- `CANVAS-OVERLAY-ARCHITECTURE.md` - Integration with NodeGraphEditor
- `CANVAS-OVERLAY-COORDINATES.md` - Coordinate transformation details
- `CANVAS-OVERLAY-EVENTS.md` - Mouse event handling
- `CANVAS-OVERLAY-REACT.md` - React 19 specific patterns

**Impact**: This pattern unblocks all Phase 4 visualization views:

- VIEW-005: Data Lineage (path highlighting)
- VIEW-006: Impact Radar (dependency visualization)
- VIEW-007: Semantic Layers (node filtering)

**Critical Rules**:

1. **Use CSS transform on parent** - Let CSS handle coordinate transformation
2. **Create React root once** - Reuse for all renders, unmount on disposal
3. **Use two layers when needed** - Background and foreground for z-index control
4. **Forward mouse events** - Check pointer-events before forwarding to canvas
5. **Use EventDispatcher context** - Never subscribe without context object

**Time Saved**: This documentation will save ~4-6 hours per visualization view by providing proven patterns instead of trial-and-error.

**Location**:

- Study file: `packages/noodl-editor/src/editor/src/views/nodegrapheditor/commentlayer.ts`
- Documentation: `dev-docs/reference/CANVAS-OVERLAY-*.md` (5 files)
- Task CHANGELOG: `dev-docs/tasks/phase-4-canvas-visualisation-views/PREREQ-003-canvas-overlay-pattern/CHANGELOG.md`

**Keywords**: canvas overlay, React over canvas, CSS transform, coordinate transformation, React 19, createRoot, EventDispatcher, mouse forwarding, pointer-events, two-layer system, CommentLayer, viewport, pan, zoom, scale

---

## 🔄 React UseMemo Array Reference Equality (Jan 3, 2026)

### The Invisible Update: When UseMemo Recalculates But React Doesn't Re-render

**Context**: Phase 2 TASK-008 - Sheet dropdown in Components Panel wasn't updating when sheets were created/deleted. Events fired correctly, useMemo recalculated correctly, but the UI didn't update.

**The Problem**: React's useMemo uses reference equality (`===`) to determine if a value has changed. Even when useMemo recalculates an array with new values, if the dependencies haven't changed by reference, React may return the same memoized reference, preventing child components from detecting the change.

**The Broken Pattern**:

```typescript
// ❌ WRONG - Recalculation doesn't guarantee new reference
const sheets = useMemo((): Sheet[] => {
  const sheetSet = new Set<string>();
  // ... calculate sheets ...
  return result; // Same reference if deps unchanged
}, [rawComponents, allComponents, hideSheets]);

// Child component receives same array reference
<SheetSelector sheets={sheets} />; // No re-render!
```

**The Solution** - Add an update counter to force new references:

```typescript
// ✅ RIGHT - Update counter forces new reference
const [updateCounter, setUpdateCounter] = useState(0);

// Increment counter when model changes
useEffect(() => {
  const handleUpdate = () => setUpdateCounter((c) => c + 1);
  ProjectModel.instance.on(EVENTS, handleUpdate, group);
  return () => ProjectModel.instance.off(group);
}, []);

// Counter in deps forces new reference on every recalculation
const sheets = useMemo((): Sheet[] => {
  const sheetSet = new Set<string>();
  // ... calculate sheets ...
  return result; // New reference when updateCounter changes!
}, [rawComponents, allComponents, hideSheets, updateCounter]);

// Child component detects new reference and re-renders
<SheetSelector sheets={sheets} />; // Re-renders correctly!
```

**Why This Matters**:

- **useMemo is an optimization, not a guarantee**: It may return the cached value even when recalculating
- **Reference equality drives React updates**: Components only re-render when props change by reference
- **Update counters bypass the cache**: Changing a simple number in deps forces a full recalculation with a new reference

**The Debug Journey**:

1. ✅ Events fire correctly (componentAdded, componentRemoved)
2. ✅ Event handlers execute (updateCounter increments)
3. ✅ useMemo recalculates (new sheet values computed)
4. ❌ But child components don't re-render (same array reference)

**Common Symptoms**:

- Events fire but UI doesn't update
- Data is correct when logged but not displayed
- Refreshing the page shows correct state
- Direct state changes work but derived state doesn't

**Critical Rules**:

1. **Never assume useMemo creates new references** - It's an optimization, not a forcing mechanism
2. **Use update counters for event-driven data** - Simple incrementing values in deps force re-computation
3. **Always verify reference changes** - Log array/object references to confirm they change
4. **Test with React DevTools** - Check component re-render highlighting to confirm updates

**Alternative Patterns**:

```typescript
// Pattern 1: Force re-creation with spreading (less efficient)
const sheets = useMemo(() => {
  const result = calculateSheets();
  return [...result]; // Always new array
}, [deps, updateCounter]);

// Pattern 2: Skip useMemo for frequently-changing data
const sheets = calculateSheets(); // Recalculate every render
// Only use when calculation is cheap

// Pattern 3: Use useCallback for stable references with changing data
const getSheets = useCallback(() => {
  return calculateSheets(); // Fresh calculation on every call
}, [deps]);
```

**Related Issues**:

- Similar to React's "stale closure" problem
- Related to React.memo's shallow comparison
- Connected to PureComponent update blocking

**Time Lost**: 2-3 hours debugging "why events work but UI doesn't update"

**Location**:

- Fixed in: `packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/hooks/useComponentsPanel.ts` (line 153)
- Task: Phase 2 TASK-008 ComponentsPanel Menus and Sheets
- CHANGELOG: `dev-docs/tasks/phase-2-react-migration/TASK-008-componentspanel-menus-and-sheets/CHANGELOG.md`

**Keywords**: React, useMemo, reference equality, array reference, update counter, force re-render, shallow comparison, React optimization, derived state, memoization

---

## 🚫 Port Hover Compatibility Highlighting Failed Attempt (Jan 1, 2026)

### The Invisible Compatibility: Why Port Hover Preview Didn't Work

**Context**: Phase 3 TASK-000I-C3 - Attempted to add visual feedback showing compatible/incompatible ports when hovering over any port. After 6+ debugging iterations spanning multiple attempts, the feature was abandoned.

**The Problem**: Despite comprehensive implementation with proper type detection, bidirectional logic, cache optimization, and visual effects, console logs consistently showed "incompatible" for most ports that should have been compatible.

**What Was Implemented**:

- Port hover detection with 8px hit radius
- Compatibility cache system for performance
- Type coercion rules (number↔string, boolean↔string, color↔string)
- Bidirectional vs unidirectional port logic (data vs signals)
- Visual feedback (glow for compatible, dim for incompatible)
- Proper port definition lookup (not connection-based)

**Debugging Attempts**:

1. Fixed backwards compatibility logic
2. Fixed cache key mismatches
3. Increased glow visibility (shadowBlur 50)
4. Added bidirectional logic for data ports vs unidirectional for signals
5. Fixed type detection to use `model.getPorts()` instead of connections
6. Modified cache rebuilding to support bidirectional data ports

**Why It Failed** (Suspected Root Causes):

1. **Port Type System Complexity**: Noodl's type system has more nuances than documented

   - Type coercion rules may be more complex than number↔string, etc.
   - Some types may have special compatibility that isn't exposed in port definitions
   - Dynamic type resolution at connection time may differ from static analysis

2. **Dynamic Port Generation**: Many nodes generate ports dynamically based on configuration

   - Port definitions from `model.getPorts()` may not reflect all runtime ports
   - StringList-configured ports (headers, query params) create dynamic inputs
   - These ports may not have proper type metadata until after connection

3. **Port Direction Ambiguity**: Input/output distinction may be insufficient

   - Some ports accept data from both directions (middle/bidirectional ports)
   - Connection validation logic in the engine may use different rules than exposed in the model
   - Legacy nodes may have special-case connection rules

4. **Hidden Compatibility Layer**: The actual connection validation may happen elsewhere
   - NodeLibrary or ConnectionModel may have additional validation logic
   - Engine-level type checking may override model-level type information
   - Some compatibility may be determined by node behavior, not type declarations

**Critical Learnings**:

**❌ Don't assume port type compatibility is simple**:

```typescript
// ❌ WRONG - Oversimplified compatibility
if (sourceType === targetType) return true;
if (sourceType === 'any' || targetType === 'any') return true;
// Missing: Engine-level rules, dynamic types, node-specific compatibility
```

**✅ Port compatibility is more complex than it appears**:

- Port definitions don't tell the whole story
- Connection validation happens in multiple places
- Type coercion has engine-level rules not exposed in metadata
- Some compatibility is behavioral, not type-based

**What Would Be Needed for This Feature**:

1. **Access to Engine Validation**: Hook into the actual connection validation logic

   - Use the same code path that validates connections when dragging
   - Don't reimplement compatibility rules - use existing validator

2. **Runtime Type Resolution**: Get actual types at connection time, not from definitions

   - Some nodes resolve types dynamically based on connected nodes
   - Type information may flow through the graph

3. **Node-Specific Rules**: Account for special-case compatibility

   - Some nodes accept any connection and do runtime type conversion
   - Legacy nodes may have grandfathered compatibility rules

4. **Testing Infrastructure**: Comprehensive test suite for all node types
   - Would need to test every node's port compatibility
   - Edge cases like Collection nodes, Router adapters, etc.

**Alternative Approaches** (For Future Attempts):

1. **Hook Existing Validation**: Instead of reimplementing, call the existing connection validator

   ```typescript
   // Pseudocode - use actual engine validation
   const canConnect = connectionModel.validateConnection(sourcePort, targetPort);
   ```

2. **Show Type Names Only**: Simpler feature - just show port types on hover

   - No compatibility checking
   - Let users learn type names and infer compatibility themselves

3. **Connection Hints After Drag**: Show compatibility when actively dragging a connection
   - Only check compatibility for the connection being created
   - Use the engine's validation since we're about to create the connection anyway

**Time Lost**: ~3-4 hours across multiple debugging sessions

**Files Cleaned Up** (All code removed):

- `packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts`
- `packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNode.ts`

**Documentation**:

- Failure documented in: `dev-docs/tasks/phase-3-editor-ux-overhaul/TASK-000-styles-overhaul/TASK-000I-node-graph-visual-improvements/CHANGELOG.md`
- Task marked as: ❌ REMOVED (FAILED)

**Keywords**: port compatibility, hover preview, type checking, connection validation, node graph, canvas, visual feedback, failed feature, type system, dynamic ports

---

## 🔥 CRITICAL: Electron Blocks window.prompt() and window.confirm() (Dec 2025)

### The Silent Dialog: Native Dialogs Don't Work in Electron

**Context**: Phase 3 TASK-001 Launcher - FolderTree component used `prompt()` and `confirm()` for folder creation/deletion. These worked in browser but silently failed in Electron, causing "Maximum update depth exceeded" React errors and no UI response.

**The Problem**: Electron blocks `window.prompt()` and `window.confirm()` for security reasons. Calling these functions throws an error: `"prompt() is and will not be supported"`.

**Root Cause**: Electron's sandboxed renderer process doesn't allow synchronous native dialogs as they can hang the IPC bridge and create security vulnerabilities.

**The Broken Pattern**:

```typescript
// ❌ WRONG - Throws error in Electron
const handleCreateFolder = () => {
  const name = prompt('Enter folder name:'); // ☠️ Error: prompt() is not supported
  if (name && name.trim()) {
    createFolder(name.trim());
  }
};

const handleDeleteFolder = (folder: Folder) => {
  if (confirm(`Delete "${folder.name}"?`)) {
    // ☠️ Error: confirm() is not supported
    deleteFolder(folder.id);
  }
};
```

**The Solution** - Use React state + inline input for text entry:

```typescript
// ✅ RIGHT - React state-based text input
const [isCreatingFolder, setIsCreatingFolder] = useState(false);
const [newFolderName, setNewFolderName] = useState('');

const handleCreateFolder = () => {
  setIsCreatingFolder(true);
  setNewFolderName('');
};

const handleCreateFolderSubmit = () => {
  if (newFolderName.trim()) {
    createFolder(newFolderName.trim());
  }
  setIsCreatingFolder(false);
};

// JSX
{
  isCreatingFolder ? (
    <input
      type="text"
      value={newFolderName}
      onChange={(e) => setNewFolderName(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleCreateFolderSubmit();
        if (e.key === 'Escape') setIsCreatingFolder(false);
      }}
      onBlur={handleCreateFolderSubmit}
      autoFocus
    />
  ) : (
    <button onClick={handleCreateFolder}>New Folder</button>
  );
}
```

**The Solution** - Use React state + custom dialog for confirmation:

```typescript
// ✅ RIGHT - React state-based confirmation dialog
const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null);

const handleDeleteFolder = (folder: Folder) => {
  setDeletingFolder(folder);
};

const handleDeleteFolderConfirm = () => {
  if (deletingFolder) {
    deleteFolder(deletingFolder.id);
    setDeletingFolder(null);
  }
};

// JSX - Overlay modal
{
  deletingFolder && (
    <div className={css['DeleteConfirmation']}>
      <div className={css['Backdrop']} onClick={() => setDeletingFolder(null)} />
      <div className={css['Dialog']}>
        <h3>Delete Folder</h3>
        <p>Delete "{deletingFolder.name}"?</p>
        <button onClick={() => setDeletingFolder(null)}>Cancel</button>
        <button onClick={handleDeleteFolderConfirm}>Delete</button>
      </div>
    </div>
  );
}
```

**Why This Matters**:

- Native dialogs work fine in browser testing (Storybook)
- Same code fails silently or with cryptic errors in Electron
- Can waste hours debugging what looks like unrelated React errors
- Common pattern developers expect to work doesn't

**Secondary Issue**: The `prompt()` error triggered an infinite loop in `useProjectOrganization` hook because the service wasn't memoized, causing "Maximum update depth exceeded" errors that obscured the root cause.

**Critical Rules**:

1. **Never use `window.prompt()` in Electron** - use inline text input with React state
2. **Never use `window.confirm()` in Electron** - use custom modal dialogs
3. **Never use `window.alert()` in Electron** - use toast notifications or modals
4. **Always test Electron-specific code in the actual Electron app**, not just browser

**Alternative Electron-Native Approach** (for main process):

```javascript
// From main process - can use Electron's dialog
const { dialog } = require('electron');

// Text input dialog (async)
const result = await dialog.showMessageBox(mainWindow, {
  type: 'question',
  buttons: ['Cancel', 'OK'],
  defaultId: 1,
  title: 'Create Folder',
  message: 'Enter folder name:',
  // Note: No built-in text input, would need custom window
});

// Confirmation dialog (async)
const result = await dialog.showMessageBox(mainWindow, {
  type: 'question',
  buttons: ['Cancel', 'Delete'],
  defaultId: 0,
  cancelId: 0,
  title: 'Delete Folder',
  message: `Delete "${folderName}"?`
});
```

**Detection**: If you see errors mentioning `prompt() is not supported` or similar, you're using blocked native dialogs.

**Location**:

- Fixed in: `packages/noodl-core-ui/src/preview/launcher/Launcher/components/FolderTree/FolderTree.tsx`
- Fixed in: `packages/noodl-core-ui/src/preview/launcher/Launcher/hooks/useProjectOrganization.ts` (infinite loop fix)
- Task: Phase 3 TASK-001 Dashboard UX Foundation

**Related Issues**:

- **Infinite loop in useProjectOrganization**: Service object was recreated on every render, causing useEffect to run infinitely. Fixed by wrapping service creation in `useMemo(() => createLocalStorageService(), [])`.

**Keywords**: Electron, window.prompt, window.confirm, window.alert, native dialogs, security, renderer process, React state, modal, confirmation dialog, infinite loop, Maximum update depth

---

[Previous learnings content continues...]

## 🎨 Design Token Consolidation Side Effects (Dec 31, 2025)

### The White-on-White Epidemic: When --theme-color-secondary Changed

**Context**: Phase 3 UX Overhaul - Design token consolidation (TASK-000A) changed `--theme-color-secondary` from teal (#00CEC9) to white (#ffffff). This broke selected/active states across the entire editor UI.

**The Problem**: Dozens of components used `--theme-color-secondary` and `--theme-color-secondary-highlight` as background colors for selected items. When these tokens changed to white, selected items became invisible white-on-white.

**Affected Components**:

- MenuDialog dropdowns (viewport, URL routes, zoom level)
- Component breadcrumb trail (current page indicator)
- Search panel results (active result)
- Components panel (selected components)
- Lesson layer (selected lessons)
- All legacy CSS files using hardcoded teal colors

**Root Cause**: Token meaning changed during consolidation:

- **Before**: `--theme-color-secondary` = teal accent color (good for backgrounds)
- **After**: `--theme-color-secondary` = white/neutral (terrible for backgrounds)

**The Solution Pattern**:

```scss
// ❌ BROKEN (post-consolidation)
.is-selected {
  background-color: var(--theme-color-secondary); // Now white!
  color: var(--theme-color-on-secondary); // Also problematic
}

// ✅ FIXED - Subtle highlight
.is-current {
  background-color: var(--theme-color-bg-4); // Dark gray
  color: var(--theme-color-fg-highlight); // White text
}

// ✅ FIXED - Bold accent (for dropdowns/menus)
.is-selected {
  background-color: var(--theme-color-primary); // Noodl red
  color: var(--theme-color-on-primary); // White text
}
```

**Decision Matrix**: Use different backgrounds based on emphasis level:

- **Subtle**: `--theme-color-bg-4` (dark gray) - breadcrumbs, sidebar
- **Medium**: `--theme-color-bg-5` (lighter gray) - hover states
- **Bold**: `--theme-color-primary` (red) - dropdown selected items

**Files Fixed** (Dec 31, 2025):

- `MenuDialog.module.scss` - Dropdown selected items
- `NodeGraphComponentTrail.module.scss` - Breadcrumb current page
- `search-panel.module.scss` - Active search result
- `componentspanel.css` - Selected components
- `LessonLayerView.css` - Selected lessons
- `EditorTopbar.module.scss` - Static display colors
- `ToggleSwitch.module.scss` - Track visibility
- `popuplayer.css` - Modal triangle color

**Prevention**: New section added to `UI-STYLING-GUIDE.md` (Part 9: Selected/Active State Patterns) documenting the correct approach.

**Critical Rule**: **Never use `--theme-color-secondary` or `--theme-color-fg-highlight` as backgrounds. Always use `--theme-color-bg-*` for backgrounds and `--theme-color-primary` for accent highlights.**

**Time Lost**: 2+ hours debugging across multiple UI components

**Location**:

- Fixed files: See list above
- Documentation: `dev-docs/reference/UI-STYLING-GUIDE.md` (Part 9)
- Token definitions: `packages/noodl-core-ui/src/styles/custom-properties/colors.css`

**Keywords**: design tokens, --theme-color-secondary, white-on-white, selected state, active state, MenuDialog, consolidation, contrast, accessibility

---

## 🎨 CSS Variable Naming Mismatch: --theme-spacing-_ vs --spacing-_ (Dec 31, 2025)

### The Invisible UI: When Padding Doesn't Exist

**Context**: Phase 3 TASK-001 Launcher - Folder tree components had proper padding styles defined but rendered with zero spacing. All padding/margin values appeared to be 0px despite correct-looking SCSS code.

**The Problem**: SCSS files referenced `var(--theme-spacing-2)` but the CSS custom properties file defined `--spacing-2` (without the `theme-` prefix). This mismatch caused all spacing values to resolve to undefined/0px.

**Root Cause**: Inconsistent variable naming between:

- **SCSS files**: Used `var(--theme-spacing-1)`, `var(--theme-spacing-2)`, etc.
- **CSS definitions**: Defined `--spacing-1: 4px`, `--spacing-2: 8px`, etc. (no `theme-` prefix)

**The Broken Pattern**:

```scss
// ❌ WRONG - Variable doesn't exist
.FolderTree {
  padding: var(--theme-spacing-2); // Resolves to nothing!
  gap: var(--theme-spacing-1); // Also undefined
}

.Button {
  padding: var(--theme-spacing-2) var(--theme-spacing-3); // Both 0px
}
```

**The Correct Pattern**:

```scss
// ✅ RIGHT - Matches defined variables
.FolderTree {
  padding: var(--spacing-2); // = 8px ✓
  gap: var(--spacing-1); // = 4px ✓
}

.Button {
  padding: var(--spacing-2) var(--spacing-3); // = 8px 12px ✓
}
```

**How to Detect**:

1. **Visual inspection**: Everything looks squished with no breathing room
2. **DevTools**: Computed padding/margin values show 0px or nothing
3. **Code search**: `grep -r "var(--theme-spacing" packages/` finds non-existent variables
4. **Compare working components**: Other components use `var(--spacing-*)` without `theme-` prefix

**What Makes This Confusing**:

- **Color variables DO use `theme-` prefix**: `var(--theme-color-bg-2)` exists and works
- **Font variables DO use `theme-` prefix**: `var(--theme-font-size-default)` exists and works
- **Spacing variables DON'T use `theme-` prefix**: Only `var(--spacing-2)` works, not `var(--theme-spacing-2)`
- **Radius variables DON'T use prefix**: Just `var(--radius-default)`, not `var(--theme-radius-default)`

**Correct Variable Patterns**:
| Category | Pattern | Example |
|----------|---------|---------|
| Colors | `--theme-color-*` | `var(--theme-color-bg-2)` |
| Fonts | `--theme-font-*` | `var(--theme-font-size-default)` |
| Spacing | `--spacing-*` | `var(--spacing-2)` |
| Radius | `--radius-*` | `var(--radius-default)` |
| Shadows | `--shadow-*` | `var(--shadow-lg)` |

**Files Fixed** (Dec 31, 2025):

- `FolderTree/FolderTree.module.scss` - All spacing variables corrected
- `FolderTreeItem/FolderTreeItem.module.scss` - All spacing variables corrected

**Verification Command**:

```bash
# Find incorrect usage of --theme-spacing-*
grep -r "var(--theme-spacing" packages/noodl-core-ui/src --include="*.scss"

# Should return zero results after fix
```

**Prevention**: Always reference `dev-docs/reference/UI-STYLING-GUIDE.md` which documents the correct variable patterns. Use existing working components as templates.

**Critical Rule**: **Spacing variables are `--spacing-*` NOT `--theme-spacing-*`. When in doubt, check `packages/noodl-core-ui/src/styles/custom-properties/spacing.css` for the actual defined variables.**

**Time Lost**: 30 minutes investigating "missing styles" before discovering the variable mismatch

**Location**:

- Fixed files: `FolderTree.module.scss`, `FolderTreeItem.module.scss`
- Variable definitions: `packages/noodl-core-ui/src/styles/custom-properties/spacing.css`
- Documentation: `dev-docs/reference/UI-STYLING-GUIDE.md`

**Keywords**: CSS variables, custom properties, --spacing, --theme-spacing, zero padding, invisible UI, variable mismatch, design tokens, spacing scale

---

[Rest of the previous learnings content continues...]
