# TASK-004B Implementation Phases

This directory contains detailed implementation guides for each phase of the ComponentsPanel React migration.

## Phase Overview

| Phase | Name                                            | Time | Complexity | Status         |
| ----- | ----------------------------------------------- | ---- | ---------- | -------------- |
| 1     | [Foundation](./PHASE-1-FOUNDATION.md)           | 1-2h | Low        | ✅ Ready       |
| 2     | [Tree Rendering](./PHASE-2-TREE-RENDERING.md)   | 1-2h | Medium     | 📝 In Progress |
| 3     | [Context Menus](./PHASE-3-CONTEXT-MENUS.md)     | 1h   | Low        | ⏳ Pending     |
| 4     | [Drag-Drop](./PHASE-4-DRAG-DROP.md)             | 2h   | High       | ⏳ Pending     |
| 5     | [Inline Rename](./PHASE-5-INLINE-RENAME.md)     | 1h   | Medium     | ⏳ Pending     |
| 6     | [Sheet Selector](./PHASE-6-SHEET-SELECTOR.md)   | 30m  | Low        | ⏳ Pending     |
| 7     | [Polish & Cleanup](./PHASE-7-POLISH-CLEANUP.md) | 1h   | Low        | ⏳ Pending     |

**Total Estimated Time:** 6-8 hours

## Implementation Strategy

### Sequential Implementation (Recommended)

Implement phases in order 1→7. Each phase builds on the previous:

- Phase 1 creates the foundation
- Phase 2 adds data display
- Phase 3 adds user interactions
- Phase 4 adds drag-drop
- Phase 5 adds inline editing
- Phase 6 adds sheet switching
- Phase 7 polishes and prepares for TASK-004

### Parallel Implementation (Advanced)

If working with multiple developers:

- **Developer A:** Phases 1, 2, 6 (core rendering)
- **Developer B:** Phases 3, 5 (user interactions)
- **Developer C:** Phase 4 (drag-drop)
- **Developer D:** Phase 7 (polish)

Merge in order: 1 → 2 → 6 → 3 → 5 → 4 → 7

## Quick Start

1. Read [Phase 1: Foundation](./PHASE-1-FOUNDATION.md)
2. Implement and test Phase 1
3. Verify all Phase 1 success criteria
4. Move to next phase
5. Repeat until complete

## Testing Strategy

### After Each Phase

- Run `npm run dev`
- Manually test new features
- Check console for errors
- Verify TypeScript compiles

### Integration Testing

After Phase 7, test:

- All context menu actions
- Drag-drop all scenarios
- Rename validation
- Sheet switching
- Selection persistence
- Undo/redo for all operations

## Common Patterns

### ProjectModel Integration

```typescript
import { ProjectModel } from '@noodl-models/projectmodel';

// Subscribe to events
useEffect(() => {
  const handleComponentAdded = (args) => {
    // Handle addition
  };

  ProjectModel.instance.on('componentAdded', handleComponentAdded);

  return () => {
    ProjectModel.instance.off('componentAdded', handleComponentAdded);
  };
}, []);
```

### UndoQueue Pattern

```typescript
import { UndoQueue, UndoActionGroup } from '@noodl-models/undo-queue-model';

UndoQueue.instance.pushAndDo(
  new UndoActionGroup({
    label: 'action description',
    do: () => {
      // Perform action
    },
    undo: () => {
      // Reverse action
    }
  })
);
```

### PopupMenu Pattern

```typescript
import PopupLayer from '@noodl-views/popuplayer';

const menu = new PopupLayer.PopupMenu({
  items: [
    {
      icon: IconName.Plus,
      label: 'Add Component',
      onClick: () => {
        /* handler */
      }
    },
    { type: 'divider' },
    {
      icon: IconName.Trash,
      label: 'Delete',
      onClick: () => {
        /* handler */
      }
    }
  ]
});

PopupLayer.instance.showPopup({
  content: menu,
  attachTo: buttonElement,
  position: 'bottom'
});
```

## Troubleshooting

### Phase 1 Issues

- **Panel doesn't appear:** Check SidebarModel registration
- **Styles not loading:** Verify webpack CSS module config
- **TypeScript errors:** Check @noodl-models imports

### Phase 2 Issues

- **Tree not updating:** Verify ProjectModel event subscriptions
- **Wrong components shown:** Check sheet filtering logic
- **Selection not working:** Verify NodeGraphEditor integration

### Phase 3 Issues

- **Menu doesn't show:** Check PopupLayer z-index
- **Actions fail:** Verify UndoQueue integration
- **Icons missing:** Check IconName imports

### Phase 4 Issues

- **Drag not starting:** Verify PopupLayer.startDragging call
- **Drop validation wrong:** Check getAcceptableDropType logic
- **Undo broken:** Verify undo action includes all state changes

### Phase 5 Issues

- **Rename input not appearing:** Check CSS positioning
- **Name validation failing:** Verify ProjectModel.getComponentWithName
- **Focus lost:** Ensure input autoFocus and blur handlers

### Phase 6 Issues

- **Sheets not filtering:** Check currentSheet state
- **Hidden sheets appear:** Verify hideSheets prop filtering

### Phase 7 Issues

- **Old panel still showing:** Remove old require() in router.setup.ts
- **Tests failing:** Update test imports to new location

## Resources

### Legacy Code References

- `packages/noodl-editor/src/editor/src/views/panels/componentspanel/ComponentsPanel.ts`
- `packages/noodl-editor/src/editor/src/templates/componentspanel.html`
- `packages/noodl-editor/src/editor/src/styles/componentspanel.css`

### React Panel Examples

- `packages/noodl-editor/src/editor/src/views/panels/SearchPanel/`
- `packages/noodl-editor/src/editor/src/views/VersionControlPanel/`

### Documentation

- `packages/noodl-editor/docs/sidebar.md` - Sidebar panel registration
- `dev-docs/reference/UI-STYLING-GUIDE.md` - Styling guidelines
- `dev-docs/guidelines/CODING-STANDARDS.md` - Code standards

## Success Criteria

The migration is complete when:

- ✅ All 7 phases implemented
- ✅ All existing functionality works
- ✅ No console errors
- ✅ TypeScript compiles without errors
- ✅ All tests pass
- ✅ Legacy files removed
- ✅ Ready for TASK-004 badges/filters

## Next Steps After Completion

Once all phases are complete:

1. **TASK-004 Part 2:** Add migration status badges
2. **TASK-004 Part 3:** Add filter system
3. **Documentation:** Update migration learnings
4. **Pattern Sharing:** Use as template for other panel migrations

---

**Questions?** Check the individual phase documents or refer to the main [README.md](../README.md).
