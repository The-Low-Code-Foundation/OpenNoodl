# TASK-001D: Legacy Project Read-Only Enforcement

## Overview

When users open legacy (React 17) projects in "read-only" mode, they need clear visual feedback and actual editing prevention. Currently, `NodeGraphEditor.setReadOnly(true)` is called, but users can still edit everything.

## Problem Statement

**Current Behavior:**

- User clicks "Open Read-Only" on legacy project
- Project opens in editor
- User can edit nodes, connections, properties, etc. (nothing is actually blocked!)
- No visual indication that project is in special mode
- No way to start migration from within editor

**Expected Behavior:**

- EditorBanner appears explaining read-only mode
- Banner offers "Migrate Now" button
- All editing operations are blocked with helpful tooltips
- User can still navigate, inspect, and preview
- Clear path to migration without leaving editor

## Success Criteria

- [ ] EditorBanner component created and styled
- [ ] Banner shows when `NodeGraphEditor.isReadOnly()` is true
- [ ] Banner has "Migrate Now" and "Learn More" buttons
- [ ] Node editing blocked (properties panel shows "Read-only mode")
- [ ] Connection creation/deletion blocked
- [ ] Node creation/deletion blocked
- [ ] Hover tooltips explain "Migrate to React 19 to edit"
- [ ] Preview/deploy still work (no editing needed)
- [ ] "Migrate Now" launches MigrationWizard successfully

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Editor (Legacy Project)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  EditorBanner (NEW)                                  │   │
│  │  ⚠️ Legacy Project (React 17) - Read-Only Mode      │   │
│  │                                                       │   │
│  │  This project needs migration to React 19 before     │   │
│  │  editing. You can inspect safely or migrate now.     │   │
│  │                                                       │   │
│  │  [Migrate Now]  [Learn More]  [✕ Dismiss]           │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Canvas (Read-Only)                                  │   │
│  │  • Nodes display normally                            │   │
│  │  • Can select and inspect                            │   │
│  │  • Cannot drag or delete                             │   │
│  │  • Hover shows: "Read-only - Migrate to edit"       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Properties Panel (Read-Only)                        │   │
│  │  ⚠️ Read-Only Mode - Migrate to React 19 to edit    │   │
│  │  [All inputs disabled/grayed out]                    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: EditorBanner Component (2-3 hours)

**Create Banner Component:**

- `packages/noodl-editor/src/editor/src/views/EditorBanner/EditorBanner.tsx`
- `packages/noodl-editor/src/editor/src/views/EditorBanner/EditorBanner.module.scss`
- `packages/noodl-editor/src/editor/src/views/EditorBanner/index.ts`

**Banner Features:**

- Fixed positioning at top of editor (above canvas, below menu bar)
- Yellow/orange warning color scheme
- Clear messaging about read-only status
- Action buttons: "Migrate Now", "Learn More", "Dismiss"
- Dismiss saves state (don't show again this session)
- Re-appears on next project open

**Styling:**

```scss
.EditorBanner {
  position: fixed;
  top: var(--menu-bar-height);
  left: 0;
  right: 0;
  z-index: 1000;
  background: var(--theme-color-warning-bg);
  border-bottom: 2px solid var(--theme-color-warning);
  padding: 12px 20px;
  display: flex;
  align-items: center;
  gap: 16px;
}
```

### Phase 2: Wire Banner to Editor (1 hour)

**Integration Points:**

- `packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts`
- Check `this.isReadOnly()` on project load
- Emit event when read-only state changes
- React component listens to event and shows/hides banner

**Event Pattern:**

```typescript
// In NodeGraphEditor
if (this.isReadOnly()) {
  EventDispatcher.instance.emit('NodeGraphEditor.readOnlyModeEnabled', {
    projectName: this.getProject().name,
    runtimeVersion: this.getProject().runtimeVersion
  });
}
```

### Phase 3: Enforce Read-Only Restrictions (3-4 hours)

**Canvas Restrictions:**

- Block node dragging
- Block connection creation (mouse events)
- Block node deletion (keyboard + context menu)
- Show tooltip on hover: "Read-only mode - migrate to edit"

**Properties Panel:**

- Add banner at top: "⚠️ Read-Only Mode"
- Disable all input fields
- Gray out all controls
- Keep visibility/fold states working

**Context Menus:**

- Disable "Delete", "Duplicate", "Cut", "Paste"
- Keep "Copy", "Select All", "View", etc.

**Keyboard Shortcuts:**

- Block: Delete, Backspace, Ctrl+V, Ctrl+X
- Allow: Ctrl+C, Arrow keys, Zoom, Pan

**Components Panel:**

- Show disabled state when dragging
- Tooltip: "Cannot add nodes in read-only mode"

### Phase 4: Migration Flow from Editor (1-2 hours)

**"Migrate Now" Button:**

- Opens MigrationWizard as dialog overlay
- Pre-fills source path from current project
- On completion:
  - Save any inspection notes
  - Close current project
  - Open migrated project
  - Remove read-only mode
  - Show success toast

**Implementation:**

```typescript
const handleMigrateNow = () => {
  const currentProject = NodeGraphEditor.instance.getProject();
  const sourcePath = currentProject._retainedProjectDirectory;

  DialogLayerModel.instance.showDialog((close) => (
    <MigrationWizard
      sourcePath={sourcePath}
      projectName={currentProject.name}
      onComplete={(targetPath) => {
        close();
        // Navigate to migrated project
        router.route({ to: 'editor', projectPath: targetPath });
      }}
      onCancel={close}
    />
  ));
};
```

## Files to Create

```
packages/noodl-editor/src/editor/src/views/EditorBanner/
├── EditorBanner.tsx         # Main banner component
├── EditorBanner.module.scss # Banner styling
└── index.ts                 # Exports
```

## Files to Modify

```
packages/noodl-editor/src/editor/src/views/
├── nodegrapheditor.ts       # Emit read-only events
└── EditorPage.tsx           # Mount EditorBanner

packages/noodl-editor/src/editor/src/views/panels/propertyeditor/
└── PropertyPanel.tsx        # Show read-only banner + disable inputs

packages/noodl-editor/src/editor/src/views/
├── NodeGraphEditor/         # Block editing interactions
└── ContextMenu/             # Disable destructive actions
```

## Testing Strategy

### Manual Testing

1. **Banner Appearance**

   - Open legacy project in read-only mode
   - Banner appears at top
   - Correct messaging displayed
   - Buttons are clickable

2. **Editing Prevention**

   - Try to drag nodes → Blocked
   - Try to create connections → Blocked
   - Try to delete nodes → Blocked
   - Try to edit properties → Blocked
   - Try keyboard shortcuts → Blocked

3. **Allowed Operations**

   - Navigate canvas → Works
   - Select nodes → Works
   - View properties → Works
   - Copy nodes → Works
   - Preview project → Works

4. **Migration Flow**
   - Click "Migrate Now" → Wizard opens
   - Complete migration → Opens migrated project
   - Verify read-only mode gone → Can edit

### Automated Tests

```typescript
describe('EditorBanner', () => {
  it('shows when project is read-only', () => {
    // Test banner visibility
  });

  it('hides when dismissed', () => {
    // Test dismiss button
  });

  it('launches migration wizard on "Migrate Now"', () => {
    // Test migration flow
  });
});

describe('Read-Only Enforcement', () => {
  it('blocks node dragging', () => {
    // Test canvas interactions
  });

  it('blocks property editing', () => {
    // Test property panel
  });

  it('allows navigation and viewing', () => {
    // Test allowed operations
  });
});
```

## Design Considerations

### User Experience

- **Progressive Disclosure**: Don't overwhelm with restrictions, let user discover naturally
- **Clear Messaging**: Always explain WHY (legacy project) and WHAT to do (migrate)
- **Non-Blocking**: Allow inspection and navigation freely
- **Easy Path Forward**: One-click migration from banner

### Visual Design

- **Warning Color**: Yellow/orange to indicate caution, not error
- **Prominent Position**: Top of editor, can't be missed
- **Dismissible**: User can focus on inspection without constant reminder
- **Consistent**: Match warning badge style from launcher

### Technical Design

- **Event-Driven**: Banner reacts to read-only state changes
- **Reusable**: EditorBanner component can be used for other notifications
- **Performant**: No impact on editor load time
- **Testable**: Clear separation of concerns

## Dependencies

- ✅ TASK-001C SUBTASK-A & D (Completed - provides detection + launcher UI)
- ✅ Phase 2 TASK-004 (Migration system exists)
- ✅ NodeGraphEditor.setReadOnly() (Exists, just needs enforcement)

## Blocks

None - can be implemented independently

## Success Metrics

- **Edit Prevention**: 100% of destructive operations blocked
- **User Clarity**: Banner message tested with 5+ users for comprehension
- **Migration Conversion**: Track % of read-only opens that lead to migration
- **Performance**: No measurable impact on editor load time (<50ms)

## Future Enhancements

1. **Custom Dialog**: Replace native `confirm()` with React dialog for better UX
2. **Inspection Mode**: Add special features for read-only (compare with other version, etc.)
3. **Partial Migration**: Allow user to migrate just certain components
4. **Preview Comparison**: Show before/after preview of migration changes

## Notes

### Why This is Important

Users who choose "Open Read-Only" expect:

1. **Safety**: Can't accidentally break their legacy project
2. **Clarity**: Understand why they can't edit
3. **Path Forward**: Easy way to migrate when ready

Without enforcement, "read-only" is just a label that doesn't prevent damage.

### Technical Challenges

1. **Event Blocking**: Need to intercept at multiple levels (mouse, keyboard, API)
2. **UI State**: Many components need to know about read-only mode
3. **Migration Context**: Need to maintain project path/state during migration

### Reference Implementation

Look at how Figma handles "View-only" mode:

- Clear banner at top
- Disabled editing with tooltips
- Easy upgrade path
- Preview still works

---

_Created: January 13, 2026_  
_Status: 📋 Ready for Implementation_  
_Priority: High - Blocks legacy project safety_  
_Estimated Time: 6-9 hours_
