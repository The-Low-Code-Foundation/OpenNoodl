# DASH-001B-4: Create Project Modal

## Overview

Replace the basic browser `prompt()` dialog with a proper React modal for creating new projects. Provides name input and folder picker in a clean UI.

## Problem

Current implementation uses a browser prompt:

```typescript
const name = prompt('Project name:'); // ❌ Bad UX
if (!name) return;
```

**Issues:**

- Poor UX (browser native prompt looks outdated)
- No validation feedback
- No folder selection context
- Doesn't match app design
- Not accessible

## Solution

Create a React modal component with:

- Project name input field
- Folder picker button
- Validation (name required, path valid)
- Cancel/Create buttons
- Proper styling matching launcher theme

## Component Design

### Modal Structure

```
┌─────────────────────────────────────────────┐
│  Create New Project                    ✕    │
├─────────────────────────────────────────────┤
│                                             │
│  Project Name                               │
│  ┌─────────────────────────────────────┐   │
│  │ My New Project                      │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Location                                   │
│  ┌──────────────────────────────┐ [Choose] │
│  │ ~/Documents/Noodl Projects/  │          │
│  └──────────────────────────────┘          │
│                                             │
│  Full path: ~/Documents/Noodl Projects/    │
│             My New Project/                 │
│                                             │
│                    [Cancel]  [Create]       │
└─────────────────────────────────────────────┘
```

### Props Interface

```typescript
export interface CreateProjectModalProps {
  isVisible: boolean;
  onClose: () => void;
  onConfirm: (name: string, location: string) => void;
}
```

## Implementation Steps

### 1. Create CreateProjectModal component

**File:** `packages/noodl-core-ui/src/preview/launcher/Launcher/components/CreateProjectModal/CreateProjectModal.tsx`

```typescript
import React, { useState, useEffect } from 'react';

import { PrimaryButton, PrimaryButtonVariant, PrimaryButtonSize } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { TextInput } from '@noodl-core-ui/components/inputs/TextInput';
import { BaseDialog } from '@noodl-core-ui/components/layout/BaseDialog';
import { Label } from '@noodl-core-ui/components/typography/Label';
import { Text } from '@noodl-core-ui/components/typography/Text';

import css from './CreateProjectModal.module.scss';

export interface CreateProjectModalProps {
  isVisible: boolean;
  onClose: () => void;
  onConfirm: (name: string, location: string) => void;
  onChooseLocation?: () => Promise<string | null>; // For folder picker
}

export function CreateProjectModal({ isVisible, onClose, onConfirm, onChooseLocation }: CreateProjectModalProps) {
  const [projectName, setProjectName] = useState('');
  const [location, setLocation] = useState('');
  const [isChoosingLocation, setIsChoosingLocation] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isVisible) {
      setProjectName('');
      setLocation('');
    }
  }, [isVisible]);

  const handleChooseLocation = async () => {
    if (!onChooseLocation) return;

    setIsChoosingLocation(true);
    try {
      const chosen = await onChooseLocation();
      if (chosen) {
        setLocation(chosen);
      }
    } finally {
      setIsChoosingLocation(false);
    }
  };

  const handleCreate = () => {
    if (!projectName.trim() || !location) return;
    onConfirm(projectName.trim(), location);
  };

  const isValid = projectName.trim().length > 0 && location.length > 0;

  if (!isVisible) return null;

  return (
    <BaseDialog
      isVisible={isVisible}
      title="Create New Project"
      onClose={onClose}
      onPrimaryAction={handleCreate}
      primaryActionLabel="Create"
      primaryActionDisabled={!isValid}
      onSecondaryAction={onClose}
      secondaryActionLabel="Cancel"
    >
      <div className={css['Content']}>
        {/* Project Name */}
        <div className={css['Field']}>
          <Label>Project Name</Label>
          <TextInput
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="My New Project"
            autoFocus
            UNSAFE_style={{ marginTop: 'var(--spacing-2)' }}
          />
        </div>

        {/* Location */}
        <div className={css['Field']}>
          <Label>Location</Label>
          <div className={css['LocationRow']}>
            <TextInput
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Choose folder..."
              readOnly
              UNSAFE_style={{ flex: 1 }}
            />
            <PrimaryButton
              label="Choose..."
              size={PrimaryButtonSize.Small}
              variant={PrimaryButtonVariant.Muted}
              onClick={handleChooseLocation}
              isDisabled={isChoosingLocation}
              UNSAFE_style={{ marginLeft: 'var(--spacing-2)' }}
            />
          </div>
        </div>

        {/* Preview full path */}
        {projectName && location && (
          <div className={css['PathPreview']}>
            <Text variant="shy">
              Full path: {location}/{projectName}/
            </Text>
          </div>
        )}
      </div>
    </BaseDialog>
  );
}
```

### 2. Create styles

**File:** `packages/noodl-core-ui/src/preview/launcher/Launcher/components/CreateProjectModal/CreateProjectModal.module.scss`

```scss
.Content {
  min-width: 400px;
  padding: var(--spacing-4) 0;
}

.Field {
  margin-bottom: var(--spacing-4);

  &:last-child {
    margin-bottom: 0;
  }
}

.LocationRow {
  display: flex;
  align-items: center;
  margin-top: var(--spacing-2);
}

.PathPreview {
  margin-top: var(--spacing-3);
  padding: var(--spacing-3);
  background-color: var(--theme-color-bg-3);
  border-radius: var(--radius-default);
  border: 1px solid var(--theme-color-border-default);
}
```

### 3. Create index export

**File:** `packages/noodl-core-ui/src/preview/launcher/Launcher/components/CreateProjectModal/index.ts`

```typescript
export { CreateProjectModal } from './CreateProjectModal';
export type { CreateProjectModalProps } from './CreateProjectModal';
```

### 4. Update ProjectsPage to use modal

**File:** `packages/noodl-editor/src/editor/src/pages/ProjectsPage/ProjectsPage.tsx`

Replace prompt-based flow with modal:

```typescript
import { CreateProjectModal } from '@noodl-core-ui/preview/launcher/Launcher/components/CreateProjectModal';

export function ProjectsPage(props: ProjectsPageProps) {
  // ... existing code

  // Add state for modal
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);

  const handleCreateProject = useCallback(() => {
    // Open modal instead of prompt
    setIsCreateModalVisible(true);
  }, []);

  const handleChooseLocation = useCallback(async (): Promise<string | null> => {
    try {
      const direntry = await filesystem.openDialog({
        allowCreateDirectory: true
      });
      return direntry || null;
    } catch (error) {
      console.error('Failed to choose location:', error);
      return null;
    }
  }, []);

  const handleCreateProjectConfirm = useCallback(
    async (name: string, location: string) => {
      setIsCreateModalVisible(false);

      try {
        const path = filesystem.makeUniquePath(filesystem.join(location, name));

        const activityId = 'creating-project';
        ToastLayer.showActivity('Creating new project', activityId);

        LocalProjectsModel.instance.newProject(
          (project) => {
            ToastLayer.hideActivity(activityId);
            if (!project) {
              ToastLayer.showError('Could not create project');
              return;
            }
            // Navigate to editor with the newly created project
            props.route.router.route({ to: 'editor', project });
          },
          { name, path, projectTemplate: '' }
        );
      } catch (error) {
        console.error('Failed to create project:', error);
        ToastLayer.showError('Failed to create project');
      }
    },
    [props.route]
  );

  const handleCreateModalClose = useCallback(() => {
    setIsCreateModalVisible(false);
  }, []);

  // ... existing code

  return (
    <>
      <Launcher
        projects={realProjects}
        onCreateProject={handleCreateProject}
        onOpenProject={handleOpenProject}
        onLaunchProject={handleLaunchProject}
        onOpenProjectFolder={handleOpenProjectFolder}
        onDeleteProject={handleDeleteProject}
        projectOrganizationService={ProjectOrganizationService.instance}
        githubUser={githubUser}
        githubIsAuthenticated={githubIsAuthenticated}
        githubIsConnecting={githubIsConnecting}
        onGitHubConnect={handleGitHubConnect}
        onGitHubDisconnect={handleGitHubDisconnect}
      />

      {/* Add modal */}
      <CreateProjectModal
        isVisible={isCreateModalVisible}
        onClose={handleCreateModalClose}
        onConfirm={handleCreateProjectConfirm}
        onChooseLocation={handleChooseLocation}
      />
    </>
  );
}
```

## Files to Create

1. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/CreateProjectModal/CreateProjectModal.tsx`
2. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/CreateProjectModal/CreateProjectModal.module.scss`
3. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/CreateProjectModal/index.ts`

## Files to Modify

1. `packages/noodl-editor/src/editor/src/pages/ProjectsPage/ProjectsPage.tsx`

## Testing Checklist

- [ ] Click "Create new project" button
- [ ] Modal appears with focus on name input
- [ ] Can type project name
- [ ] Create button disabled until name and location provided
- [ ] Click "Choose..." button
- [ ] Folder picker dialog appears
- [ ] Selected folder displays in location field
- [ ] Full path preview shows correctly
- [ ] Click Cancel closes modal without action
- [ ] Click Create with valid inputs creates project
- [ ] Navigate to editor after successful creation
- [ ] Invalid input shows appropriate feedback

## Validation Rules

1. **Project name:**

   - Must not be empty
   - Trim whitespace
   - Allow any characters (filesystem will sanitize if needed)

2. **Location:**

   - Must not be empty
   - Must be a valid directory path
   - User must select via picker (not manual entry)

3. **Full path:**
   - Combination of location + name
   - Must be unique (handled by `filesystem.makeUniquePath`)

## Benefits

1. **Better UX** - Modern modal matches app design
2. **Visual feedback** - See full path before creating
3. **Validation** - Clear indication of required fields
4. **Accessibility** - Proper keyboard navigation
5. **Consistent** - Uses existing UI components

## Future Enhancements (Phase 8)

This modal is intentionally minimal. Phase 8 WIZARD-001 will add:

- Template selection
- Git initialization option
- AI-assisted project setup
- Multi-step wizard flow

## Edge Cases

### Location picker cancelled

If user cancels the folder picker, the location field remains unchanged (keeps previous value or stays empty).

### Invalid name characters

The filesystem will handle sanitization if the name contains invalid characters for the OS.

### Path already exists

`filesystem.makeUniquePath()` automatically appends a number if the path exists (e.g., "My Project (2)").

## Follow-up

This completes the TASK-001B fixes. After all subtasks are implemented, verify:

- Folders persist after restart
- Folders appear in modal
- Only grid view visible
- Project creation uses modal

---

**Estimated Time:** 2-3 hours
**Status:** Not Started
