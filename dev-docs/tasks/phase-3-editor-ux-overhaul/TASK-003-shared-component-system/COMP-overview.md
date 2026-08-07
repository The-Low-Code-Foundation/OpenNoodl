# COMP Series: Shared Component System

## Overview

The COMP series transforms Noodl's component sharing from manual zip file exchanges into a modern, Git-based collaborative ecosystem. Teams can share design systems via organization repositories, individuals can build personal component libraries, and improvements can flow back upstream via pull requests.

## Target Environment

- **Editor**: React 19 version only
- **Runtime**: Not affected (components work in any runtime)
- **Backwards Compatibility**: Existing prefabs continue to work

## Task Dependency Graph

```
COMP-001 (Prefab System Refactoring)
    │
    ├────────────────────────┬───────────────────────┐
    ↓                        ↓                       ↓
COMP-002 (Built-in)    COMP-003 (Export)      GIT-001 (OAuth)
    │                        │                       │
    ↓                        ↓                       │
    │                  COMP-004 (Org Components) ←───┘
    │                        │
    └────────────┬───────────┘
                 ↓
         COMP-005 (Version Control)
                 │
                 ↓
         COMP-006 (Forking & PR)
```

## Task Summary

| Task ID | Name | Est. Hours | Priority |
|---------|------|------------|----------|
| COMP-001 | Prefab System Refactoring | 14-20 | Critical |
| COMP-002 | Built-in Prefabs | 19-26 | High |
| COMP-003 | Component Export to Repository | 19-25 | High |
| COMP-004 | Organization Components Repository | 18-24 | High |
| COMP-005 | Component Import with Version Control | 19-25 | Medium |
| COMP-006 | Component Forking & PR Workflow | 28-35 | Medium |

**Total Estimated: 117-155 hours**

## Implementation Order

### Phase 1: Foundation (Weeks 1-2)
1. **COMP-001** - Refactor prefab system for multiple sources

### Phase 2: Local & Built-in (Weeks 3-4)
2. **COMP-002** - Bundle essential prefabs with editor

### Phase 3: Export & Organization (Weeks 5-7)
3. **COMP-003** - Enable exporting to GitHub repositories
4. **COMP-004** - Auto-detect and load organization repos

### Phase 4: Version Control & Collaboration (Weeks 8-10)
5. **COMP-005** - Track imports, detect updates
6. **COMP-006** - Fork detection, PR workflow

## Existing Infrastructure

### ModuleLibraryModel

```typescript
// Current implementation
class ModuleLibraryModel {
  modules: IModule[];    // External libraries
  prefabs: IModule[];    // Component bundles
  
  fetchModules(type: 'modules' | 'prefabs'): Promise<IModule[]>;
  installModule(path: string): Promise<void>;
  installPrefab(path: string): Promise<void>;
}
```

### ProjectImporter

```typescript
// Handles actual component import
class ProjectImporter {
  listComponentsAndDependencies(dir, callback);
  checkForCollisions(imports, callback);
  import(dir, imports, callback);
}
```

### NodePicker

```
packages/noodl-editor/src/editor/src/views/NodePicker/
├── NodePicker.tsx           # Main component
├── NodePicker.context.tsx   # State management
├── tabs/
│   ├── NodeLibrary/         # Built-in nodes
│   ├── NodePickerSearchView/ # Prefabs & modules
│   └── ImportFromProject/   # Import from other project
└── components/
    └── ModuleCard/          # Prefab/module display card
```

### Export Functionality

```typescript
// exportProjectComponents.ts
export function exportProjectComponents() {
  // Shows export popup
  // User selects components
  // Creates zip file with dependencies
}
```

## New Architecture

### PrefabRegistry (COMP-001)

Central hub for all prefab sources:

```typescript
class PrefabRegistry {
  private sources: Map<string, PrefabSource>;
  
  registerSource(source: PrefabSource): void;
  getAllPrefabs(): Promise<PrefabMetadata[]>;
  installPrefab(id: string): Promise<void>;
}
```

### Source Types

| Source | Priority | Description |
|--------|----------|-------------|
| BuiltInPrefabSource | 100 | Bundled with editor |
| OrganizationPrefabSource | 80 | Team component repos |
| PersonalPrefabSource | 70 | User's own repos |
| DocsPrefabSource | 50 | Community prefabs |

### Component Tracking (COMP-005)

```typescript
interface ImportedComponent {
  componentId: string;
  source: ComponentSource;
  importedVersion: string;
  isFork: boolean;
  updateAvailable?: string;
  activePR?: PRInfo;
}
```

## Repository Structure Convention

All component repositories follow this structure:

```
noodl-components/
├── index.json              # Repository manifest
├── README.md               # Documentation
├── LICENSE                 # License file
└── components/
    ├── component-name/
    │   ├── prefab.json     # Component metadata
    │   ├── component.ndjson # Component data
    │   ├── dependencies/   # Styles, variants
    │   └── assets/         # Images, fonts
    └── ...
```

### Manifest Format (index.json)

```json
{
  "name": "Acme Design System",
  "version": "2.1.0",
  "noodlVersion": ">=2.10.0",
  "components": [
    {
      "id": "acme-button",
      "name": "Acme Button",
      "version": "2.1.0",
      "path": "components/acme-button"
    }
  ]
}
```

## Key User Flows

### 1. Team Member Imports Org Component

```
User opens NodePicker
    ↓
Sees "Acme Corp" section with org components
    ↓
Clicks "Clone" on AcmeButton
    ↓
Component imported, source tracked
    ↓
Later: notification "AcmeButton update available"
```

### 2. Developer Shares Component

```
User right-clicks component
    ↓
Selects "Export to Repository"
    ↓
Chooses personal repo or org repo
    ↓
Fills metadata (description, tags)
    ↓
Component committed and pushed
```

### 3. Developer Improves Org Component

```
User modifies imported AcmeButton
    ↓
System detects fork, shows badge
    ↓
User right-clicks → "Contribute Changes"
    ↓
PR created in org repo
    ↓
Team reviews and merges
```

## Services to Create

| Service | Purpose |
|---------|---------|
| PrefabRegistry | Central source management |
| ComponentTrackingService | Import/version tracking |
| ComponentExportService | Export to repositories |
| OrganizationService | Org detection & management |
| ComponentForkService | Fork detection & PR workflow |

## UI Components to Create

| Component | Location | Purpose |
|-----------|----------|---------|
| ComponentSourceBadge | noodl-core-ui | Show source (Built-in, Org, etc.) |
| ForkBadge | noodl-core-ui | Show fork status |
| ExportToRepoModal | noodl-core-ui | Export workflow |
| ComponentUpdatesModal | noodl-core-ui | Update selection |
| ComponentDiffModal | noodl-core-ui | View changes |
| CreatePRModal | noodl-core-ui | PR creation |
| OrganizationSettings | noodl-core-ui | Org repo settings |

## Dependencies on Other Series

### Required from GIT Series
- GIT-001 (GitHub OAuth) - Required for COMP-003, COMP-004

### Enables for Future
- Community marketplace
- Component ratings/reviews
- Usage analytics

## Testing Strategy

### Unit Tests
- Source registration
- Metadata parsing
- Checksum calculation
- Version comparison

### Integration Tests
- Full import flow
- Export to repo flow
- Update detection
- PR creation

### Manual Testing
- Multiple organizations
- Large component libraries
- Offline scenarios
- Permission edge cases

## Cline Usage Notes

### Before Starting Each Task

1. Read task document completely
2. Review existing prefab system:
   - `modulelibrarymodel.ts`
   - `projectimporter.js`
   - `NodePicker/` views
3. Understand export flow:
   - `exportProjectComponents.ts`

### Key Gotchas

1. **Singleton Pattern**: `ModuleLibraryModel.instance` is used everywhere
2. **Async Import**: Import process is callback-based, not Promise
3. **Collision Handling**: Existing collision detection must be preserved
4. **File Paths**: Components use relative paths internally

### Testing Prefabs

```bash
# Run editor tests
npm run test:editor

# Manual: Open NodePicker, try importing prefab
```

## Success Criteria (Series Complete)

1. ✅ Multiple prefab sources supported
2. ✅ Built-in prefabs available offline
3. ✅ Components exportable to GitHub
4. ✅ Organization repos auto-detected
5. ✅ Import source/version tracked
6. ✅ Updates detected and installable
7. ✅ Forks can create PRs upstream

## Future Work (Post-COMP)

The COMP series enables:
- **Marketplace**: Paid/free component marketplace
- **Analytics**: Usage tracking per component
- **Ratings**: Community ratings and reviews
- **Templates**: Project templates from components
- **Subscriptions**: Organization component subscriptions

## Files in This Series

- `COMP-001-prefab-system-refactoring.md`
- `COMP-002-builtin-prefabs.md`
- `COMP-003-component-export.md`
- `COMP-004-organization-components.md`
- `COMP-005-component-import-version-control.md`
- `COMP-006-forking-pr-workflow.md`
- `COMP-OVERVIEW.md` (this file)
