# TASK-001C: Restore Legacy Runtime Detection & Migration in New Launcher

## Overview

During the migration to the new React 19 launcher (`packages/noodl-core-ui/src/preview/launcher/`), we lost all visual indicators and migration controls for legacy React 17 projects. This task restores that critical functionality.

## Problem Statement

When we rebuilt the launcher in Phase 3 TASK-001, we inadvertently removed:

1. **Visual indicators** - No warning badges showing which projects are React 17
2. **Migration controls** - No "Migrate Project" or "View Read-Only" buttons
3. **Read-only mode UX** - Projects open as "read-only" but provide no UI explanation or migration path
4. **Detection flow** - No interception when opening legacy projects

### Current State Issues

**Issue 1: Silent Legacy Projects**
Legacy projects appear identical to modern projects in the launcher. Users have no way to know which projects need migration until they try to open them and encounter compatibility issues.

**Issue 2: Missing Migration Path**
Even though the `MigrationWizard` component exists and works perfectly, users have no way to access it from the new launcher.

**Issue 3: Read-Only Mode is Invisible**
When a project is opened in read-only mode (`NodeGraphEditor.setReadOnly(true)`), editing is prevented but there's:

- No banner explaining WHY it's read-only
- No button to migrate the project
- No visual indication that it's in a special mode

**Issue 4: Incomplete Integration**
The old launcher (`projectsview.ts`) had full integration with runtime detection, but the new launcher doesn't use any of it despite `LocalProjectsModel` having all the necessary methods.

## What Already Works (Don't Need to Build)

- ✅ **Runtime Detection**: `LocalProjectsModel.detectProjectRuntime()` works perfectly
- ✅ **Persistent Cache**: Runtime info survives restarts via electron-store
- ✅ **Migration Wizard**: `MigrationWizard.tsx` is fully implemented and tested
- ✅ **Read-Only Mode**: `NodeGraphEditor.setReadOnly()` prevents editing
- ✅ **Project Scanner**: `detectRuntimeVersion()` accurately identifies React 17 projects

## Solution Overview

Restore legacy project detection to the new launcher by:

1. **Adding visual indicators** to `LauncherProjectCard` for legacy projects
2. **Exposing migration controls** with "Migrate" and "View Read-Only" buttons
3. **Implementing EditorBanner** to show read-only status and offer migration
4. **Integrating detection** into the project opening flow

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Launcher                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  LauncherProjectCard (Modified)                      │   │
│  │  ┌────────────┐  ┌──────────────┐                   │   │
│  │  │ ⚠️ Legacy  │  │ React 17     │  Show if legacy   │   │
│  │  │   Badge    │  │ Warning Bar  │                   │   │
│  │  └────────────┘  └──────────────┘                   │   │
│  │                                                       │   │
│  │  Actions (if legacy):                                │   │
│  │  [Migrate Project]  [View Read-Only]  [Learn More]  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Click "Migrate Project"
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   MigrationWizard                           │
│              (Already exists - just wire it up)             │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Click "View Read-Only"
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Editor (Read-Only Mode)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  EditorBanner (NEW)                                  │   │
│  │  ⚠️ This project uses React 17 and is read-only.    │   │
│  │     [Migrate Now]  [Dismiss]                         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  [Canvas - editing disabled]                                │
│  [Panels - viewing only]                                    │
└─────────────────────────────────────────────────────────────┘
```

## Subtasks

### Subtask A: Add Legacy Indicators to LauncherProjectCard ✅ COMPLETE

**Status**: ✅ **COMPLETED** - January 13, 2026

Add visual indicators to project cards showing legacy status with migration options.

**What Was Implemented**:

- Legacy warning badge on project cards
- Yellow warning bar with migration message
- "Migrate Project" and "Open Read-Only" action buttons
- Runtime version markers for new projects

**Documentation**: See `SUBTASK-A-D-COMPLETE.md`

---

### Subtask B: Wire Up Migration Controls

**Estimated Time**: 4-5 hours

Connect migration buttons to the existing MigrationWizard and implement read-only project opening.

**Files to modify**:

- `packages/noodl-editor/src/editor/src/pages/ProjectsPage/ProjectsPage.tsx`
- `packages/noodl-core-ui/src/preview/launcher/Launcher/LauncherContext.tsx`
- `packages/noodl-core-ui/src/preview/launcher/Launcher/Launcher.tsx`

**Files to create**:

- `packages/noodl-core-ui/src/preview/launcher/Launcher/components/LegacyProjectWarning/LegacyProjectWarning.tsx`
- `packages/noodl-core-ui/src/preview/launcher/Launcher/components/LegacyProjectWarning/LegacyProjectWarning.module.scss`

**Implementation**: See `SUBTASK-B-migration-controls.md`

---

### Subtask C: Implement EditorBanner for Read-Only Mode

**Estimated Time**: 3-4 hours

Create a persistent banner in the editor that explains read-only mode and offers migration.

**Files to create**:

- `packages/noodl-editor/src/editor/src/views/EditorBanner/EditorBanner.tsx`
- `packages/noodl-editor/src/editor/src/views/EditorBanner/EditorBanner.module.scss`
- `packages/noodl-editor/src/editor/src/views/EditorBanner/index.ts`

**Files to modify**:

- `packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts`
- `packages/noodl-editor/src/editor/src/pages/EditorPage.tsx`

**Implementation**: See `SUBTASK-C-editor-banner.md`

---

### Subtask D: Add Legacy Detection to Project Opening Flow

**Estimated Time**: 2-3 hours

Intercept legacy projects when opening and show options before proceeding.

**Files to modify**:

- `packages/noodl-editor/src/editor/src/utils/LocalProjectsModel.ts`
- `packages/noodl-editor/src/editor/src/views/projectsview.ts` (if still used)

**Files to create**:

- `packages/noodl-core-ui/src/components/dialogs/LegacyProjectDialog/LegacyProjectDialog.tsx`
- `packages/noodl-core-ui/src/components/dialogs/LegacyProjectDialog/LegacyProjectDialog.module.scss`

**Implementation**: See `SUBTASK-D-opening-flow.md`

---

## Implementation Order

Complete subtasks sequentially:

1. **Subtask A** - Visual foundation (cards show legacy status)
2. **Subtask B** - Connect migration (buttons work)
3. **Subtask C** - Read-only UX (banner shows in editor)
4. **Subtask D** - Opening flow (intercept before opening)

Each subtask can be tested independently and provides immediate value.

## Success Criteria

- [ ] Legacy projects show warning badge in launcher
- [ ] Legacy projects display "React 17" warning bar
- [ ] "Migrate Project" button opens MigrationWizard correctly
- [ ] "View Read-Only" button opens project in read-only mode
- [ ] Read-only mode shows EditorBanner with migration option
- [ ] EditorBanner "Migrate Now" launches migration wizard
- [ ] Opening a legacy project shows detection dialog with options
- [ ] Runtime detection cache persists across editor restarts
- [ ] All existing functionality continues to work
- [ ] No regressions in modern (React 19) project opening

## Testing Strategy

### Unit Tests

- Runtime detection correctly identifies React 17 projects
- Cache loading/saving works correctly
- Legacy badge renders conditionally

### Integration Tests

- Clicking "Migrate" opens wizard with correct project path
- Clicking "View Read-Only" opens project with editing disabled
- EditorBanner "Migrate Now" works from within editor
- Migration completion refreshes launcher with updated projects

### Manual Testing

- Test with real React 17 project (check `project-examples/version 1.1.0/`)
- Test migration flow end-to-end
- Test read-only mode restrictions (canvas, properties, etc.)
- Test with projects that don't have explicit version markers

## Dependencies

- Phase 2 TASK-004 (Runtime Migration System) - ✅ Complete
- Phase 3 TASK-001 (Dashboard UX Foundation) - ✅ Complete
- Phase 3 TASK-001B (Launcher Fixes) - ✅ Complete

## Blocks

None (this is a restoration of lost functionality)

## Related Tasks

- **TASK-004** (Runtime Migration System) - Provides backend infrastructure
- **TASK-001** (Dashboard UX Foundation) - Created new launcher
- **TASK-001B** (Launcher Fixes) - Improved launcher functionality

## Notes

### Why This Was Lost

When we rebuilt the launcher as a React component in `noodl-core-ui`, we focused on modern UI/UX and forgot to port over the legacy project handling from the old jQuery-based launcher.

### Why This Is Important

Users opening old Noodl projects will be confused when:

- Projects fail to open without explanation
- Projects open but behave strangely (React 17 vs 19 incompatibilities)
- No migration path is offered

This creates a poor first impression and blocks users from upgrading their projects.

### Design Considerations

- **Non-Intrusive**: Warning badges should be informative but not scary
- **Clear Path Forward**: Always offer migration as the primary action
- **Safe Exploration**: Read-only mode lets users inspect projects safely
- **Persistent Indicators**: Cache runtime detection so it doesn't slow down launcher

---

_Created: January 2026_
_Status: 📋 Draft - Ready for Implementation_
