# DASH-001B-2: Service Integration

## Overview

Connect the real `ProjectOrganizationService` from noodl-editor to the launcher UI so folders appear correctly in the "Move to Folder" modal.

## Problem

The `useProjectOrganization` hook creates its own isolated localStorage service:

```typescript
// In useProjectOrganization.ts
const service = useMemo(() => {
  // TODO: In production, get this from window context or inject it
  return createLocalStorageService(); // ❌ Creates separate storage
}, []);
```

This means:

- Folders created in the sidebar go to one storage
- "Move to Folder" modal reads from a different storage
- The two never sync

## Solution

Bridge the service through the launcher context, similar to how GitHub OAuth is handled.

## Implementation Steps

### 1. Expose service through launcher context

**File:** `packages/noodl-core-ui/src/preview/launcher/Launcher/LauncherContext.tsx`

Add organization service to context:

```typescript
import { ProjectOrganizationService } from '@noodl-editor';

// TODO: Add proper import path

export interface LauncherContextValue {
  // ... existing properties

  // Project organization service (optional for Storybook compatibility)
  projectOrganizationService?: any; // Use 'any' to avoid circular deps
}
```

### 2. Pass service from ProjectsPage

**File:** `packages/noodl-editor/src/editor/src/pages/ProjectsPage/ProjectsPage.tsx`

Add to Launcher component:

```typescript
import { ProjectOrganizationService } from '../../services/ProjectOrganizationService';

export function ProjectsPage(props: ProjectsPageProps) {
  // ... existing code

  return (
    <Launcher
      projects={realProjects}
      onCreateProject={handleCreateProject}
      onOpenProject={handleOpenProject}
      onLaunchProject={handleLaunchProject}
      onOpenProjectFolder={handleOpenProjectFolder}
      onDeleteProject={handleDeleteProject}
      projectOrganizationService={ProjectOrganizationService.instance} // ✅ Add this
      githubUser={githubUser}
      githubIsAuthenticated={githubIsAuthenticated}
      githubIsConnecting={githubIsConnecting}
      onGitHubConnect={handleGitHubConnect}
      onGitHubDisconnect={handleGitHubDisconnect}
    />
  );
}
```

### 3. Update Launcher component

**File:** `packages/noodl-core-ui/src/preview/launcher/Launcher/Launcher.tsx`

Accept and pass service through context:

```typescript
export interface LauncherProps {
  // ... existing props
  projectOrganizationService?: any; // Optional for Storybook
}

export function Launcher({
  projects = [],
  initialPage = 'projects',
  useMockData: useMockDataProp = false,
  onCreateProject,
  onOpenProject,
  onLaunchProject,
  onOpenProjectFolder,
  onDeleteProject,
  projectOrganizationService, // ✅ Add this
  githubUser,
  githubIsAuthenticated = false,
  githubIsConnecting = false,
  onGitHubConnect,
  onGitHubDisconnect
}: LauncherProps) {
  // ... existing state

  const contextValue: LauncherContextValue = {
    activePageId,
    setActivePageId,
    viewMode,
    setViewMode,
    useMockData,
    setUseMockData,
    projects: displayProjects,
    hasRealProjects,
    selectedFolderId,
    setSelectedFolderId,
    onCreateProject,
    onOpenProject,
    onLaunchProject,
    onOpenProjectFolder,
    onDeleteProject,
    projectOrganizationService, // ✅ Add this
    githubUser,
    githubIsAuthenticated,
    githubIsConnecting,
    onGitHubConnect,
    onGitHubDisconnect
  };

  // ... rest of component
}
```

### 4. Update useProjectOrganization hook

**File:** `packages/noodl-core-ui/src/preview/launcher/Launcher/hooks/useProjectOrganization.ts`

Use real service when available:

```typescript
import { useLauncherContext } from '../LauncherContext';

export function useProjectOrganization(): UseProjectOrganizationReturn {
  const { projectOrganizationService } = useLauncherContext();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [, setUpdateTrigger] = useState(0);

  // Use real service if available, otherwise fall back to localStorage
  const service = useMemo(() => {
    if (projectOrganizationService) {
      console.log('✅ Using real ProjectOrganizationService');
      return projectOrganizationService;
    }

    console.warn('⚠️ ProjectOrganizationService not available, using localStorage fallback');
    return createLocalStorageService();
  }, [projectOrganizationService]);

  // ... rest of hook (unchanged)
}
```

### 5. Add export path for service

**File:** `packages/noodl-editor/src/editor/src/index.ts` (or appropriate export file)

Ensure `ProjectOrganizationService` is exported:

```typescript
export { ProjectOrganizationService } from './services/ProjectOrganizationService';
```

## Files to Modify

1. `packages/noodl-core-ui/src/preview/launcher/Launcher/LauncherContext.tsx`
2. `packages/noodl-editor/src/editor/src/pages/ProjectsPage/ProjectsPage.tsx`
3. `packages/noodl-core-ui/src/preview/launcher/Launcher/Launcher.tsx`
4. `packages/noodl-core-ui/src/preview/launcher/Launcher/hooks/useProjectOrganization.ts`
5. `packages/noodl-editor/src/editor/src/index.ts` (if not already exporting service)

## Testing Checklist

- [ ] Service is passed to Launcher component
- [ ] useProjectOrganization receives real service
- [ ] Console shows "Using real ProjectOrganizationService" message
- [ ] Can create folder in sidebar
- [ ] Folder appears immediately in sidebar
- [ ] Click "Move to Folder" on project card
- [ ] Modal shows all user-created folders
- [ ] Moving project to folder works correctly
- [ ] Folder counts update correctly
- [ ] Storybook still works (falls back to localStorage)

## Data Flow

```
ProjectsPage.tsx
  └─> ProjectOrganizationService.instance
       └─> Launcher.tsx (prop)
            └─> LauncherContext (context value)
                 └─> useProjectOrganization (hook)
                      └─> FolderTree, Projects view, etc.
```

## Storybook Compatibility

The service is optional in the context, so Storybook stories will still work:

```typescript
// In Launcher.stories.tsx
<Launcher
  projects={mockProjects}
  // projectOrganizationService not provided - uses localStorage fallback
/>
```

## Benefits

1. **Single source of truth** - All components read from same service
2. **Real-time sync** - Changes immediately visible everywhere
3. **Persistent storage** - Combined with Subtask 1, data survives restarts
4. **Backward compatible** - Storybook continues to work

## Edge Cases

### Service not available

If `projectOrganizationService` is undefined (e.g., in Storybook), the hook falls back to localStorage service with a warning.

### Multiple service instances

The service uses a singleton pattern (`instance` getter), so all references point to the same instance.

## Follow-up

After this subtask, proceed to **DASH-001B-3** (Remove List View) to simplify the UI.

---

**Estimated Time:** 2-3 hours
**Status:** Not Started
