# TASK-001B: Launcher Fixes & Improvements

## Overview

This task addresses critical bugs and UX issues discovered after the initial launcher implementation (TASK-001). Four main issues are resolved: folder persistence, service integration, view mode simplification, and project creation UX.

## Problem Statement

After deploying the new launcher dashboard, several issues were identified:

1. **Folders don't appear in "Move to Folder" modal** - The UI and service are disconnected
2. **Can't create new project** - Using basic browser `prompt()` provides poor UX
3. **List view is unnecessary** - Grid view should be the only option
4. **Folders don't persist** - Data lost after `npm run dev:clean` or reinstall

## Root Causes

### Issue 1: Disconnected Service

The `useProjectOrganization` hook creates its own localStorage service instead of using the real `ProjectOrganizationService` from noodl-editor. This creates two separate data stores that don't communicate.

```typescript
// In useProjectOrganization.ts
// TODO: In production, get this from window context or inject it
return createLocalStorageService(); // ❌ Creates isolated storage
```

### Issue 2: Poor Project Creation UX

The current implementation uses browser `prompt()`:

```typescript
const name = prompt('Project name:'); // ❌ Bad UX
```

### Issue 3: Unnecessary Complexity

Both list and grid views were implemented per spec, but only grid view is needed, adding unnecessary code and maintenance burden.

### Issue 4: Non-Persistent Storage

`ProjectOrganizationService` uses localStorage which is cleared during dev mode restarts:

```typescript
private loadData(): ProjectOrganizationData {
  const stored = localStorage.getItem(this.storageKey); // ❌ Session-only
}
```

## Solution Overview

### Subtask 1: Migrate to electron-store

Replace localStorage with electron-store for persistent, disk-based storage that survives reinstalls and updates.

**Files affected:**

- `packages/noodl-editor/src/editor/src/services/ProjectOrganizationService.ts`

**Details:** See `DASH-001B-electron-store-migration.md`

### Subtask 2: Connect Service to UI

Bridge the real `ProjectOrganizationService` to the launcher context so folders appear correctly in the modal.

**Files affected:**

- `packages/noodl-editor/src/editor/src/pages/ProjectsPage/ProjectsPage.tsx`
- `packages/noodl-core-ui/src/preview/launcher/Launcher/hooks/useProjectOrganization.ts`
- `packages/noodl-core-ui/src/preview/launcher/Launcher/Launcher.tsx`
- `packages/noodl-core-ui/src/preview/launcher/Launcher/LauncherContext.tsx`

**Details:** See `DASH-001B-service-integration.md`

### Subtask 3: Remove List View

Delete all list view code and make grid view the standard.

**Files affected:**

- `packages/noodl-core-ui/src/preview/launcher/Launcher/components/ViewModeToggle/` (delete)
- `packages/noodl-core-ui/src/preview/launcher/Launcher/components/ProjectList/` (delete)
- `packages/noodl-core-ui/src/preview/launcher/Launcher/views/Projects.tsx`
- `packages/noodl-core-ui/src/preview/launcher/Launcher/LauncherContext.tsx`
- `packages/noodl-core-ui/src/preview/launcher/Launcher/Launcher.tsx`

**Details:** See `DASH-001B-remove-list-view.md`

### Subtask 4: Add Project Creation Modal

Replace prompt() with a proper React modal for better UX.

**Files to create:**

- `packages/noodl-core-ui/src/preview/launcher/Launcher/components/CreateProjectModal/CreateProjectModal.tsx`
- `packages/noodl-core-ui/src/preview/launcher/Launcher/components/CreateProjectModal/CreateProjectModal.module.scss`
- `packages/noodl-core-ui/src/preview/launcher/Launcher/components/CreateProjectModal/index.ts`

**Files to modify:**

- `packages/noodl-editor/src/editor/src/pages/ProjectsPage/ProjectsPage.tsx`

**Details:** See `DASH-001B-create-project-modal.md`

## Implementation Order

The subtasks should be completed in sequence:

1. **Electron-store migration** - Foundation for persistence
2. **Service integration** - Fixes folder modal immediately
3. **Remove list view** - Simplifies codebase
4. **Create project modal** - Improves new project UX

Each subtask is independently testable and provides immediate value.

## Testing Strategy

After each subtask:

- **Subtask 1:** Verify data persists after `npm run dev:clean`
- **Subtask 2:** Verify folders appear in "Move to Folder" modal
- **Subtask 3:** Verify only grid view renders, no toggle button
- **Subtask 4:** Verify new project modal works correctly

## Success Criteria

- [x] Folders persist across editor restarts and `npm run dev:clean`
- [x] "Move to Folder" modal shows all user-created folders
- [x] Only grid view exists (no list view toggle)
- [x] Project creation uses modal with name + folder picker
- [x] All existing functionality continues to work

## Dependencies

- Phase 3 TASK-001 (Dashboard UX Foundation) - completed
- electron-store package (already installed)

## Blocked By

None

## Blocks

None (this is a bug fix task)

## Estimated Effort

- Subtask 1: 1-2 hours
- Subtask 2: 2-3 hours
- Subtask 3: 1-2 hours
- Subtask 4: 2-3 hours
- **Total: 6-10 hours**

## Notes

- **No backward compatibility needed** - Fresh start with electron-store is acceptable
- **Delete list view completely** - No need to keep for future revival
- **Minimal modal scope** - Name + folder picker only (Phase 8 wizard will enhance later)
- This task prepares the foundation for Phase 8 WIZARD-001 (full project creation wizard)

## Related Tasks

- **TASK-001** (Dashboard UX Foundation) - Original implementation
- **Phase 8 WIZARD-001** (Project Creation Wizard) - Future enhancement

---

_Created: January 2026_
_Status: ✅ Complete (verified 2026-01-07)_
