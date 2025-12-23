# TASK-005 Working Notes

## Quick Links

- Legacy implementation: `packages/noodl-editor/src/editor/src/views/panels/componentspanel/ComponentsPanel.ts`
- Template: `packages/noodl-editor/src/editor/src/templates/componentspanel.html`
- Styles: `packages/noodl-editor/src/editor/src/styles/componentspanel.css`
- Folder model: `packages/noodl-editor/src/editor/src/views/panels/componentspanel/ComponentsPanelFolder.ts`
- Templates: `packages/noodl-editor/src/editor/src/views/panels/componentspanel/ComponentTemplates.ts`
- Sidebar docs: `packages/noodl-editor/docs/sidebar.md`

## Reference Components

Good patterns to follow:
- `views/SidePanel/SidePanel.tsx` - Container for sidebar panels
- `views/panels/SearchPanel/SearchPanel.tsx` - Modern React panel example
- `views/panels/VersionControlPanel/VersionControlPanel.tsx` - Another React panel
- `views/PopupLayer/PopupMenu.tsx` - Context menu component

## Key Decisions

### Decision 1: State Management Approach

**Options considered:**
1. useState + useEffect for ProjectModel subscription
2. useModernModel hook (existing pattern)
3. New Zustand store

**Decision:** Use `useModernModel` hook

**Reasoning:** Matches existing patterns in codebase, already handles subscription cleanup, proven to work with ProjectModel.

---

### Decision 2: Tree Structure Representation

**Options considered:**
1. Reuse ComponentsPanelFolder class
2. Create new TreeNode interface
3. Flat array with parent references

**Decision:** [TBD during implementation]

**Reasoning:** [TBD]

---

### Decision 3: Drag-Drop Implementation

**Options considered:**
1. Native HTML5 drag-drop with PopupLayer
2. @dnd-kit library
3. react-dnd

**Decision:** Native HTML5 with PopupLayer (initially)

**Reasoning:** Maintains consistency with existing drag-drop patterns in codebase, no new dependencies. Can upgrade to dnd-kit later if needed for DASH-003.

---

## Technical Discoveries

### ProjectModel Events

Key events to subscribe to:
```typescript
const events = [
  'componentAdded',
  'componentRemoved', 
  'componentRenamed',
  'rootComponentChanged',
  'projectLoaded'
];
```

### ComponentsPanelFolder Structure

The folder structure is built dynamically from component names:
```
/Component1          → root folder
/Folder1/Component2  → Folder1 contains Component2
/Folder1/            → Folder1 (folder component - both folder AND component)
```

Key insight: A folder can also BE a component. This is the "folder component" pattern where `folder.component` is set.

### Icon Type Detection

From `ComponentIcon.ts`:
```typescript
export function getComponentIconType(component: ComponentModel): ComponentIconType {
  // Cloud functions
  if (isComponentModel_CloudRuntime(component)) {
    return ComponentIconType.CloudFunction;
  }
  // Pages (visual with router)
  if (hasRouterChildren(component)) {
    return ComponentIconType.Page;
  }
  // Visual components
  if (isVisualComponent(component)) {
    return ComponentIconType.Visual;
  }
  // Default: logic
  return ComponentIconType.Logic;
}
```

### Sheet System

Sheets are special top-level folders that start with `#`:
- `/#__cloud__` - Cloud functions sheet (often hidden)
- `/#pages` - Pages sheet
- `/` - Default sheet (root)

The `hideSheets` option filters these from display.

### PopupLayer Drag-Drop Pattern

```typescript
// Start drag
PopupLayer.instance.startDragging({
  label: 'Component Name',
  type: 'component',
  component: componentModel,
  folder: parentFolder
});

// During drag (on drop target)
PopupLayer.instance.isDragging(); // Check if drag active
PopupLayer.instance.dragItem;     // Get current drag item
PopupLayer.instance.indicateDropType('move' | 'none');

// On drop
PopupLayer.instance.dragCompleted();
```

---

## Gotchas Discovered

### Gotcha 1: Folder Component Selection

When clicking a "folder component", the folder scope should be selected, not the component scope. See `selectComponent()` in original.

### Gotcha 2: Sheet Auto-Selection

When a component is selected, its sheet should automatically become active. See `selectSheet()` calls.

### Gotcha 3: Rename Input Focus

The rename input needs careful focus management - it should select all text on focus and prevent click-through issues.

### Gotcha 4: Empty Folder Cleanup

When a folder becomes empty (no components, no subfolders), and it's a "folder component", it should revert to a regular component.

---

## Useful Commands

```bash
# Find all usages of ComponentsPanel
grep -r "ComponentsPanel" packages/noodl-editor/src/ --include="*.ts" --include="*.tsx"

# Find ProjectModel event subscriptions
grep -r "ProjectModel.instance.on" packages/noodl-editor/src/editor/

# Find useModernModel usage examples
grep -r "useModernModel" packages/noodl-editor/src/editor/

# Find PopupLayer drag-drop usage
grep -r "startDragging" packages/noodl-editor/src/editor/

# Test build
cd packages/noodl-editor && npm run build

# Type check
cd packages/noodl-editor && npx tsc --noEmit
```

---

## Debug Log

_Add entries as you work through implementation_

### [Date/Time] - Phase 1: Foundation

- Trying: [what you're attempting]
- Result: [what happened]
- Next: [what to try next]

---

## Questions to Resolve

- [ ] Does SidebarModel need changes to accept React functional components directly?
- [ ] Should we keep ComponentsPanelFolder.ts or inline the logic?
- [ ] How do we handle the `nodeGraphEditor` reference passed via options?
- [ ] What's the right pattern for context menu positioning?

---

## Discoveries for LEARNINGS.md

_Note patterns discovered that should be added to dev-docs/reference/LEARNINGS.md_

### Pattern: Migrating Legacy View to React

**Context:** Converting jQuery View classes to React components

**Pattern:**
1. Create React component with same props
2. Use useModernModel for model subscriptions
3. Replace data-click handlers with onClick props
4. Replace data-class bindings with conditional classNames
5. Replace $(selector) queries with refs or state
6. Port CSS to CSS modules

**Location:** Sidebar panels

---

### Pattern: [TBD]

**Context:** [TBD during implementation]

**Pattern:** [TBD]

**Location:** [TBD]
