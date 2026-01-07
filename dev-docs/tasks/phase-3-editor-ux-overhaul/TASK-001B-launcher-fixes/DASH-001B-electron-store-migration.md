# DASH-001B-1: Electron-Store Migration

## Overview

Migrate `ProjectOrganizationService` from localStorage to electron-store for persistent, disk-based storage that survives editor restarts, reinstalls, and `npm run dev:clean`.

## Problem

Current implementation uses localStorage:

```typescript
private loadData(): ProjectOrganizationData {
  const stored = localStorage.getItem(this.storageKey);
  // ...
}

private saveData(): void {
  localStorage.setItem(this.storageKey, JSON.stringify(this.data));
}
```

**Issues:**

- Data cleared during `npm run dev:clean`
- Lost on editor reinstall/update
- Stored in Electron session cache (temporary)

## Solution

Use `electron-store` like `GitStore` does:

```typescript
import Store from 'electron-store';

const store = new Store<ProjectOrganizationData>({
  name: 'project_organization',
  encryptionKey: 'unique-key-here' // Optional
});
```

## Implementation Steps

### 1. Update ProjectOrganizationService.ts

**File:** `packages/noodl-editor/src/editor/src/services/ProjectOrganizationService.ts`

Replace localStorage with electron-store:

```typescript
import Store from 'electron-store';

import { EventDispatcher } from '../../../shared/utils/EventDispatcher';

// ... (keep existing interfaces)

export class ProjectOrganizationService extends EventDispatcher {
  private static _instance: ProjectOrganizationService;
  private store: Store<ProjectOrganizationData>;
  private data: ProjectOrganizationData;

  private constructor() {
    super();

    // Initialize electron-store
    this.store = new Store<ProjectOrganizationData>({
      name: 'project_organization',
      defaults: {
        version: 1,
        folders: [],
        tags: [],
        projectMeta: {}
      }
    });

    this.data = this.loadData();
  }

  private loadData(): ProjectOrganizationData {
    try {
      return this.store.store; // Get all data from store
    } catch (error) {
      console.error('[ProjectOrganizationService] Failed to load data:', error);
      return {
        version: 1,
        folders: [],
        tags: [],
        projectMeta: {}
      };
    }
  }

  private saveData(): void {
    try {
      this.store.store = this.data; // Save all data to store
      this.notifyListeners('dataChanged', this.data);
    } catch (error) {
      console.error('[ProjectOrganizationService] Failed to save data:', error);
    }
  }

  // ... (rest of the methods remain the same)
}
```

### 2. Remove localStorage references

Remove the `storageKey` property as it's no longer needed:

```typescript
// DELETE THIS:
private storageKey = 'projectOrganization';
```

### 3. Test persistence

After implementation:

1. Create a folder in the launcher
2. Run `npm run dev:clean`
3. Restart the editor
4. Verify the folder still exists

## Files to Modify

1. `packages/noodl-editor/src/editor/src/services/ProjectOrganizationService.ts`

## Changes Summary

**Before:**

- Used `localStorage.getItem()` and `localStorage.setItem()`
- Data stored in Electron session
- Cleared on dev mode restart

**After:**

- Uses `electron-store` with disk persistence
- Data stored in OS-appropriate app data folder:
  - macOS: `~/Library/Application Support/Noodl/project_organization.json`
  - Windows: `%APPDATA%\Noodl\project_organization.json`
  - Linux: `~/.config/Noodl/project_organization.json`
- Survives all restarts and reinstalls

## Testing Checklist

- [ ] Import `electron-store` successfully
- [ ] Service initializes without errors
- [ ] Can create folders
- [ ] Can rename folders
- [ ] Can delete folders
- [ ] Can move projects to folders
- [ ] Data persists after `npm run dev:clean`
- [ ] Data persists after editor restart
- [ ] No console errors

## Edge Cases

### If electron-store fails to initialize

The service should gracefully fall back:

```typescript
private loadData(): ProjectOrganizationData {
  try {
    return this.store.store;
  } catch (error) {
    console.error('[ProjectOrganizationService] Failed to load data:', error);
    // Return empty structure - don't crash the app
    return {
      version: 1,
      folders: [],
      tags: [],
      projectMeta: {}
    };
  }
}
```

### Data corruption

If the stored JSON is corrupted, electron-store will throw an error. The loadData method catches this and returns empty defaults.

## Benefits

1. **Persistent storage** - Data survives restarts
2. **Proper location** - Stored in OS app data folder
3. **Consistent pattern** - Matches GitStore implementation
4. **Type safety** - Generic `Store<ProjectOrganizationData>` provides type checking
5. **Atomic writes** - electron-store handles file write safety

## Follow-up

After this subtask, proceed to **DASH-001B-2** (Service Integration) to connect the service to the UI.

---

**Estimated Time:** 1-2 hours
**Status:** Not Started
