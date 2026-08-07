# COMP-005: Component Import with Version Control

## Overview

Track the source and version of imported components, enabling update notifications, selective updates, and clear understanding of component provenance. When a component is imported from a repository, remember where it came from and notify users when updates are available.

## Context

Currently, imported components lose connection to their source:
- No tracking of where component came from
- No awareness of available updates
- No way to re-sync with source
- Manual process to check for new versions

This task adds version tracking and update management:
- Track component source (built-in, org, personal, docs)
- Store version information
- Check for updates periodically
- Enable selective component updates

### Import Flow Today

```
User clicks "Clone" → Component imported → No source tracking
```

### Import Flow After This Task

```
User clicks "Clone" → Component imported → Source/version tracked
    ↓
Background: Check for updates periodically
    ↓
Notification: "2 components have updates available"
    ↓
User reviews and selects updates
```

## Requirements

### Functional Requirements

1. **Source Tracking**
   - Record source repository/location for each import
   - Store version at time of import
   - Track import timestamp
   - Handle components without source (legacy)

2. **Version Information**
   - Display current version in component panel
   - Show source badge (Built-in, Org name, etc.)
   - Link to source documentation
   - View changelog

3. **Update Detection**
   - Background check for available updates
   - Badge/indicator for components with updates
   - List all updatable components
   - Compare current vs available version

4. **Update Process**
   - Preview what changes in update
   - Selective update (choose which to update)
   - Backup current before update
   - Rollback option if update fails

5. **Import Metadata Storage**
   - Store in project metadata
   - Survive project export/import
   - Handle renamed components

### Non-Functional Requirements

- Update check < 5 seconds
- No performance impact on project load
- Works offline (shows cached status)
- Handles 100+ tracked components

## Technical Approach

### 1. Import Metadata Schema

```typescript
// Stored in project.json metadata
interface ComponentImportMetadata {
  components: ImportedComponent[];
  lastUpdateCheck: string;  // ISO timestamp
}

interface ImportedComponent {
  componentId: string;       // Internal Noodl component ID
  componentName: string;     // Display name at import time
  source: ComponentSource;
  importedVersion: string;
  importedAt: string;        // ISO timestamp
  lastUpdatedAt?: string;    // When user last updated
  updateAvailable?: string;  // Available version if any
  checksum?: string;         // For detecting local modifications
}

interface ComponentSource {
  type: 'builtin' | 'organization' | 'personal' | 'docs' | 'unknown';
  repository?: string;       // GitHub repo URL
  organization?: string;     // Org name if type is 'organization'
  prefabId: string;          // ID in source manifest
}
```

### 2. Import Tracking Service

```typescript
// packages/noodl-editor/src/editor/src/services/ComponentTrackingService.ts

class ComponentTrackingService {
  private static instance: ComponentTrackingService;
  
  // On import
  async trackImport(
    componentId: string,
    source: ComponentSource,
    version: string
  ): Promise<void>;
  
  // Queries
  getImportedComponents(): ImportedComponent[];
  getComponentSource(componentId: string): ComponentSource | null;
  getComponentsWithUpdates(): ImportedComponent[];
  
  // Update checking
  async checkForUpdates(): Promise<UpdateCheckResult>;
  async checkComponentUpdate(componentId: string): Promise<UpdateInfo | null>;
  
  // Update application
  async updateComponent(componentId: string): Promise<UpdateResult>;
  async updateAllComponents(componentIds: string[]): Promise<UpdateResult[]>;
  async rollbackUpdate(componentId: string): Promise<void>;
  
  // Metadata
  async saveMetadata(): Promise<void>;
  async loadMetadata(): Promise<void>;
}

interface UpdateCheckResult {
  checked: number;
  updatesAvailable: number;
  components: {
    componentId: string;
    currentVersion: string;
    availableVersion: string;
    changelogUrl?: string;
  }[];
}
```

### 3. Update Check Process

```typescript
async checkForUpdates(): Promise<UpdateCheckResult> {
  const imported = this.getImportedComponents();
  const result: UpdateCheckResult = {
    checked: 0,
    updatesAvailable: 0,
    components: []
  };
  
  // Group by source for efficient checking
  const bySource = groupBy(imported, c => c.source.repository);
  
  for (const [repo, components] of Object.entries(bySource)) {
    const source = PrefabRegistry.instance.getSource(repo);
    if (!source) continue;
    
    // Fetch latest manifest
    const manifest = await source.getManifest();
    
    for (const component of components) {
      result.checked++;
      
      const latest = manifest.components.find(
        c => c.id === component.source.prefabId
      );
      
      if (latest && semver.gt(latest.version, component.importedVersion)) {
        result.updatesAvailable++;
        result.components.push({
          componentId: component.componentId,
          currentVersion: component.importedVersion,
          availableVersion: latest.version,
          changelogUrl: latest.changelog
        });
        
        // Update metadata
        component.updateAvailable = latest.version;
      }
    }
  }
  
  await this.saveMetadata();
  return result;
}
```

### 4. UI Components

#### Component Panel Badge

```
┌─────────────────────────────────────────────────────────────────────┐
│ Components                                                          │
├─────────────────────────────────────────────────────────────────────┤
│ ├── Pages                                                           │
│ │   └── HomePage                                                    │
│ │   └── LoginPage                                                   │
│ ├── Components                                                      │
│ │   └── AcmeButton  [🏢 v2.1.0] [⬆️ Update]                         │
│ │   └── AcmeCard    [🏢 v1.3.0]                                     │
│ │   └── MyCustomButton                                              │
│ │   └── FormInput   [📦 v1.0.0]                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Update Available Notification

```
┌─────────────────────────────────────────────────────────────────────┐
│ 🔔 Component Updates Available                                      │
│                                                                     │
│ 2 components have updates available from your organization.         │
│                                                                     │
│ [View Updates]                                    [Remind Me Later] │
└─────────────────────────────────────────────────────────────────────┘
```

#### Update Modal

```
┌─────────────────────────────────────────────────────────────────────┐
│ Component Updates                                             [×]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ Available Updates                                                   │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ ☑ AcmeButton                                                    │ │
│ │   Current: v2.1.0 → Available: v2.2.0                           │ │
│ │   Source: Acme Corp                                             │ │
│ │   Changes: Added loading state, fixed hover color               │ │
│ │   [View Full Changelog]                                          │ │
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │ ☑ AcmeCard                                                      │ │
│ │   Current: v1.3.0 → Available: v1.4.0                           │ │
│ │   Source: Acme Corp                                             │ │
│ │   Changes: Added shadow variants                                │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ⚠️ Updates will replace your imported components. Local            │
│    modifications may be lost.                                       │
│                                                                     │
│                                    [Cancel]  [Update Selected (2)]  │
└─────────────────────────────────────────────────────────────────────┘
```

### 5. Integration Points

```typescript
// Hook into existing import flow
// packages/noodl-editor/src/editor/src/models/modulelibrarymodel.ts

async installPrefab(prefabId: string, options?: InstallOptions): Promise<void> {
  // ... existing import logic ...
  
  // After successful import, track it
  const source = this.detectSource(prefabId);
  const version = await this.getPrefabVersion(prefabId);
  
  for (const componentId of importedComponentIds) {
    await ComponentTrackingService.instance.trackImport(
      componentId,
      source,
      version
    );
  }
}
```

## Files to Create

1. `packages/noodl-editor/src/editor/src/services/ComponentTrackingService.ts`
2. `packages/noodl-core-ui/src/components/common/ComponentSourceBadge/ComponentSourceBadge.tsx`
3. `packages/noodl-core-ui/src/components/modals/ComponentUpdatesModal/ComponentUpdatesModal.tsx`
4. `packages/noodl-core-ui/src/components/modals/ComponentUpdatesModal/UpdateItem.tsx`
5. `packages/noodl-core-ui/src/components/notifications/UpdateAvailableToast/UpdateAvailableToast.tsx`

## Files to Modify

1. `packages/noodl-editor/src/editor/src/models/modulelibrarymodel.ts`
   - Track imports after install
   - Add version detection

2. `packages/noodl-editor/src/editor/src/views/panels/componentspanel.tsx`
   - Show source badge
   - Show update indicator
   - Add "Check for Updates" action

3. `packages/noodl-editor/src/editor/src/models/projectmodel.ts`
   - Store/load import metadata
   - Add to project.json

4. `packages/noodl-editor/src/editor/src/pages/EditorPage/EditorPage.tsx`
   - Periodic update check
   - Show update notification

5. `packages/noodl-editor/src/editor/src/utils/projectimporter.js`
   - Return component IDs after import
   - Support update (re-import)

## Implementation Steps

### Phase 1: Tracking Infrastructure
1. Create ComponentTrackingService
2. Define metadata schema
3. Add to project.json structure
4. Implement track/load/save

### Phase 2: Import Integration
1. Hook into installPrefab
2. Extract version from manifest
3. Track after successful import
4. Handle import errors

### Phase 3: Update Checking
1. Implement checkForUpdates
2. Compare versions (semver)
3. Store update availability
4. Background check timer

### Phase 4: UI - Badges & Indicators
1. Create ComponentSourceBadge
2. Add to component panel
3. Show update indicator
4. Add "Check for Updates" button

### Phase 5: UI - Update Modal
1. Create ComponentUpdatesModal
2. Show changelog summaries
3. Selective update checkboxes
4. Implement update action

### Phase 6: Update Application
1. Backup current component
2. Re-import from source
3. Update metadata
4. Handle errors/rollback

## Testing Checklist

- [ ] Import tracks source correctly
- [ ] Version stored in metadata
- [ ] Badge shows in component panel
- [ ] Update check finds updates
- [ ] Notification appears when updates available
- [ ] Update modal lists all updates
- [ ] Selective update works
- [ ] Update replaces component correctly
- [ ] Changelog link works
- [ ] Rollback restores previous
- [ ] Works with built-in prefabs
- [ ] Works with org prefabs
- [ ] Legacy imports show "unknown" source
- [ ] Offline shows cached status

## Dependencies

- COMP-001 (Prefab System Refactoring)
- COMP-002 (Built-in Prefabs) - for version tracking
- COMP-004 (Organization Components) - for org tracking

## Blocked By

- COMP-001
- COMP-002

## Blocks

- COMP-006 (extends tracking for forking)

## Estimated Effort

- Tracking service: 4-5 hours
- Import integration: 3-4 hours
- Update checking: 3-4 hours
- UI badges/indicators: 3-4 hours
- Update modal: 3-4 hours
- Update application: 3-4 hours
- **Total: 19-25 hours**

## Success Criteria

1. Imported components track their source
2. Version visible in component panel
3. Updates detected automatically
4. Users notified of available updates
5. Selective update works smoothly
6. Update preserves project integrity

## Future Enhancements

- Auto-update option (for trusted sources)
- Diff view before update
- Local modification detection
- Update scheduling
- Update history
- Component dependency updates
- Breaking change warnings
