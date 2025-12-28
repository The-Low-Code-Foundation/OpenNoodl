# DASH Series: Dashboard UX Foundation

## Overview

The DASH series modernizes the OpenNoodl editor dashboard, transforming it from a basic project launcher into a proper workspace management hub. These tasks focus on the **new React 19 launcher** in `packages/noodl-core-ui/src/preview/launcher/`.

## Target Environment

- **Editor**: React 19 version only
- **Runtime**: React 19 version (if applicable)
- **Backwards Compatibility**: Not required for old launcher

## Task Dependency Graph

```
DASH-001 (Tabbed Navigation)
    │
    ├── DASH-002 (Project List Redesign)
    │       │
    │       └── DASH-003 (Project Organization)
    │
    └── DASH-004 (Tutorial Section Redesign)
```

## Task Summary

| Task ID | Name | Est. Hours | Priority |
|---------|------|------------|----------|
| DASH-001 | Tabbed Navigation System | 5-8 | Critical |
| DASH-002 | Project List Redesign | 9-14 | High |
| DASH-003 | Project Organization | 16-22 | Medium |
| DASH-004 | Tutorial Section Redesign | 13-19 | Medium |

**Total Estimated: 43-63 hours**

## Implementation Order

### Week 1: Foundation
1. **DASH-001** - Tabbed navigation (foundation for everything)
2. **DASH-004** - Tutorial redesign (can parallel with DASH-002)

### Week 2: Project Management
3. **DASH-002** - Project list redesign
4. **DASH-003** - Folders and tags

## Key Technical Decisions

### Location
All new components go in:
```
packages/noodl-core-ui/src/preview/launcher/Launcher/
```

### State Management
- Use React Context for launcher-wide state
- Use electron-store for persistence
- Keep component state minimal

### Styling
- Use existing noodl-core-ui components
- CSS Modules for custom styling
- Follow existing color/spacing tokens

### Data
- Services in `packages/noodl-editor/src/editor/src/services/`
- Hooks in launcher `hooks/` folder
- Types in component folders or shared types file

## Shared Components to Create

These components will be reused across DASH tasks:

| Component | Created In | Used By |
|-----------|------------|---------|
| TabBar | DASH-001 | All views |
| GitStatusBadge | DASH-002 | Project list |
| ViewModeToggle | DASH-002 | Project list |
| FolderTree | DASH-003 | Sidebar |
| TagPill | DASH-003 | Project rows |
| ProgressRing | DASH-004 | Tutorial cards |
| DifficultyBadge | DASH-004 | Tutorial cards |

## Testing Strategy

Each task includes a testing checklist. Additionally:

1. **Visual Testing**: Use Storybook for component development
2. **Integration Testing**: Test in actual launcher context
3. **Persistence Testing**: Verify data survives app restart
4. **Performance Testing**: Check with 100+ projects/tutorials

## Cline Usage Notes

### Before Starting Each Task

1. Read the task document completely
2. Explore the existing code in `packages/noodl-core-ui/src/preview/launcher/`
3. Check existing components in `packages/noodl-core-ui/src/components/`
4. Understand the data flow

### During Implementation

1. Create components incrementally with Storybook stories
2. Test in isolation before integration
3. Update imports/exports in index files
4. Follow existing code style

### Confidence Checkpoints

Rate confidence (1-10) at these points:
- After reading task document
- After exploring existing code
- Before creating first component
- After completing each phase
- Before marking task complete

### Common Gotchas

1. **Mock Data**: The launcher currently uses mock data - don't try to connect to real data yet
2. **FIXME Alerts**: Many click handlers are `alert('FIXME: ...')` - that's expected
3. **Storybook**: Run `npm run storybook` in noodl-core-ui to test components
4. **Imports**: noodl-core-ui uses path aliases - check existing imports for patterns

## Success Criteria (Series Complete)

1. ✅ Launcher has tabbed navigation (Projects, Learn, Templates)
2. ✅ Projects display in sortable list with git status
3. ✅ Projects can be organized with folders and tags
4. ✅ Tutorials are organized by category with progress tracking
5. ✅ All preferences persist across sessions
6. ✅ UI is responsive and accessible
7. ✅ New components are reusable

## Future Work (Post-DASH)

The DASH series sets up infrastructure for:
- **GIT series**: GitHub integration, sync status
- **COMP series**: Shared components system
- **AI series**: AI project creation
- **DEPLOY series**: Deployment automation

These will be documented separately.

## Files in This Series

- `DASH-001-tabbed-navigation.md`
- `DASH-002-project-list-redesign.md`
- `DASH-003-project-organization.md`
- `DASH-004-tutorial-section-redesign.md`
- `DASH-OVERVIEW.md` (this file)
