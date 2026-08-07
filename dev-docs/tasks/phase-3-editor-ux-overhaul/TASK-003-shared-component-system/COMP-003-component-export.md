# COMP-003: Component Export to Repository

## Overview

Enable users to export components from their project to a GitHub repository, creating a personal component library. This allows sharing components across projects and with team members.

## Context

Currently, component sharing is manual:
1. Export components as zip (Cmd+Shift+E)
2. Manually upload to GitHub or share file
3. Others download and import

This task streamlines the process:
1. Right-click component → "Export to Repository"
2. Select target repository
3. Component is committed with metadata
4. Available in NodePicker for other projects

### Existing Export Flow

From `exportProjectComponents.ts`:
```typescript
export function exportProjectComponents() {
  ProjectImporter.instance.listComponentsAndDependencies(
    ProjectModel.instance._retainedProjectDirectory,
    (components) => {
      // Shows export popup
      // User selects components
      // Creates zip file
    }
  );
}
```

## Requirements

### Functional Requirements

1. **Export Entry Points**
   - Right-click component → "Export to Repository"
   - Component sheet context menu → "Export Sheet to Repository"
   - File menu → "Export Components to Repository"

2. **Repository Selection**
   - List user's GitHub repositories
   - "Create new repository" option
   - Remember last used repository
   - Suggest `noodl-components` naming convention

3. **Component Selection**
   - Select individual components
   - Select entire sheets
   - Auto-select dependencies
   - Preview what will be exported

4. **Metadata Entry**
   - Component name (prefilled)
   - Description
   - Tags
   - Version (auto-increment option)
   - Category selection

5. **Export Process**
   - Create component directory structure
   - Generate prefab.json manifest
   - Commit to repository
   - Optional: Push immediately or stage

6. **Repository Structure**
   - Standard directory layout
   - index.json manifest for discovery
   - README generation
   - License file option

### Non-Functional Requirements

- Export completes in < 30 seconds
- Works with existing repositories
- Handles large components (100+ nodes)
- Conflict detection with existing exports

## Technical Approach

### 1. Repository Structure Convention

```
my-noodl-components/
├── index.json                    # Repository manifest
├── README.md                     # Auto-generated docs
├── LICENSE                       # Optional license
└── components/
    ├── my-button/
    │   ├── prefab.json          # Component metadata
    │   ├── component.ndjson     # Noodl component data
    │   ├── dependencies/        # Style/variant dependencies
    │   └── assets/              # Images, fonts
    ├── my-card/
    │   └── ...
    └── my-form/
        └── ...
```

### 2. Repository Manifest (index.json)

```json
{
  "$schema": "https://opennoodl.net/schemas/component-repo-v1.json",
  "name": "My Noodl Components",
  "description": "Personal component library",
  "author": {
    "name": "John Doe",
    "github": "johndoe"
  },
  "version": "1.0.0",
  "noodlVersion": ">=2.10.0",
  "components": [
    {
      "id": "my-button",
      "name": "My Button",
      "description": "Custom styled button",
      "version": "1.2.0",
      "path": "components/my-button",
      "tags": ["form", "button"],
      "category": "Forms"
    }
  ],
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### 3. Component Export Service

```typescript
// packages/noodl-editor/src/editor/src/services/ComponentExportService.ts

interface ExportOptions {
  components: ComponentModel[];
  repository: GitHubRepo;
  metadata: {
    description: string;
    tags: string[];
    category: string;
    version?: string;
  };
  commitMessage?: string;
  pushImmediately?: boolean;
}

interface ExportResult {
  success: boolean;
  exportedComponents: string[];
  commitSha?: string;
  error?: string;
}

class ComponentExportService {
  private static instance: ComponentExportService;
  
  // Export flow
  async exportToRepository(options: ExportOptions): Promise<ExportResult>;
  
  // Repository management
  async listUserRepositories(): Promise<GitHubRepo[]>;
  async createComponentRepository(name: string): Promise<GitHubRepo>;
  async validateRepository(repo: GitHubRepo): Promise<boolean>;
  
  // Component preparation
  async prepareExport(components: ComponentModel[]): Promise<ExportPackage>;
  async resolveExportDependencies(components: ComponentModel[]): Promise<ComponentModel[]>;
  
  // File generation
  generatePrefabManifest(component: ComponentModel, metadata: ExportMetadata): PrefabManifest;
  generateRepoManifest(repo: GitHubRepo, components: PrefabManifest[]): RepoManifest;
  generateReadme(repo: GitHubRepo, components: PrefabManifest[]): string;
}
```

### 4. Export Modal Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ Export to Repository                                          [×]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ COMPONENTS TO EXPORT                                                │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ ☑ MyButton                                     + 2 dependencies │ │
│ │   └─ ☑ ButtonStyles (variant)                                   │ │
│ │   └─ ☑ PrimaryColor (color style)                               │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ TARGET REPOSITORY                                                   │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ johndoe/noodl-components                                    [▾] │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ [+ Create new repository]                                          │
│                                                                     │
│ METADATA                                                            │
│ Name:        [My Button                                          ] │
│ Description: [Custom styled button with loading state            ] │
│ Tags:        [form] [button] [+]                                   │
│ Category:    [Forms ▾]                                             │
│ Version:     [1.0.0    ] ☑ Auto-increment                         │
│                                                                     │
│ COMMIT                                                              │
│ Message:     [Add MyButton component                             ] │
│              ☑ Push to GitHub immediately                          │
│                                                                     │
│                                              [Cancel]  [Export]    │
└─────────────────────────────────────────────────────────────────────┘
```

### 5. Export Process Flow

```typescript
async exportToRepository(options: ExportOptions): Promise<ExportResult> {
  const { components, repository, metadata } = options;
  
  // 1. Clone or open repository locally
  const localRepo = await this.getLocalRepository(repository);
  
  // 2. Resolve all dependencies
  const allComponents = await this.resolveExportDependencies(components);
  
  // 3. Generate component files
  for (const component of allComponents) {
    const componentDir = path.join(localRepo.path, 'components', component.id);
    
    // Export component data
    await this.exportComponentData(component, componentDir);
    
    // Generate prefab manifest
    const manifest = this.generatePrefabManifest(component, metadata);
    await fs.writeJson(path.join(componentDir, 'prefab.json'), manifest);
  }
  
  // 4. Update repository manifest
  const repoManifest = await this.updateRepoManifest(localRepo, allComponents);
  
  // 5. Update README
  await this.updateReadme(localRepo, repoManifest);
  
  // 6. Commit changes
  const git = new Git(mergeProject);
  await git.openRepository(localRepo.path);
  await git.commit(options.commitMessage || `Add ${components[0].name}`);
  
  // 7. Push if requested
  if (options.pushImmediately) {
    await git.push({});
  }
  
  return {
    success: true,
    exportedComponents: allComponents.map(c => c.name),
    commitSha: await git.getHeadCommitId()
  };
}
```

## Files to Create

1. `packages/noodl-editor/src/editor/src/services/ComponentExportService.ts`
2. `packages/noodl-core-ui/src/components/modals/ExportToRepoModal/ExportToRepoModal.tsx`
3. `packages/noodl-core-ui/src/components/modals/ExportToRepoModal/ComponentSelector.tsx`
4. `packages/noodl-core-ui/src/components/modals/ExportToRepoModal/RepoSelector.tsx`
5. `packages/noodl-core-ui/src/components/modals/ExportToRepoModal/MetadataForm.tsx`
6. `packages/noodl-core-ui/src/components/modals/CreateRepoModal/CreateRepoModal.tsx`
7. `packages/noodl-editor/src/editor/src/utils/componentExporter.ts` - Low-level export utilities

## Files to Modify

1. `packages/noodl-editor/src/editor/src/views/nodegrapheditor.js`
   - Add right-click context menu option

2. `packages/noodl-editor/src/editor/src/views/panels/componentspanel.tsx`
   - Add export option to component context menu

3. `packages/noodl-editor/src/editor/src/utils/exportProjectComponents.ts`
   - Refactor to share code with repository export

4. `packages/noodl-editor/src/editor/src/models/prefab/sources/GitHubPrefabSource.ts`
   - Implement full source for reading from component repos

## Implementation Steps

### Phase 1: Export Service Foundation
1. Create ComponentExportService
2. Implement dependency resolution
3. Create file generation utilities
4. Define repository structure

### Phase 2: Repository Management
1. List user repositories (via GitHub API)
2. Create new repository flow
3. Local repository management
4. Clone/pull existing repos

### Phase 3: Export Modal
1. Create ExportToRepoModal
2. Create ComponentSelector
3. Create RepoSelector
4. Create MetadataForm

### Phase 4: Git Integration
1. Stage exported files
2. Commit with message
3. Push to remote
4. Handle conflicts

### Phase 5: Context Menu Integration
1. Add to component right-click menu
2. Add to sheet context menu
3. Add to File menu

### Phase 6: Testing & Polish
1. Test with various component types
2. Test dependency resolution
3. Error handling
4. Progress indication

## Testing Checklist

- [ ] Export single component works
- [ ] Export multiple components works
- [ ] Dependencies auto-selected
- [ ] Repository selection lists repos
- [ ] Create new repository works
- [ ] Metadata saved correctly
- [ ] Files committed to repo
- [ ] Push to GitHub works
- [ ] Repository manifest updated
- [ ] README generated/updated
- [ ] Handles existing components (update)
- [ ] Version auto-increment works
- [ ] Error messages helpful

## Dependencies

- COMP-001 (Prefab System Refactoring)
- GIT-001 (GitHub OAuth) - for repository access

## Blocked By

- COMP-001
- GIT-001

## Blocks

- COMP-004 (Organization Components)
- COMP-005 (Component Import with Version Control)

## Estimated Effort

- Export service: 4-5 hours
- Repository management: 3-4 hours
- Export modal: 4-5 hours
- Git integration: 3-4 hours
- Context menu: 2-3 hours
- Testing & polish: 3-4 hours
- **Total: 19-25 hours**

## Success Criteria

1. Components can be exported via right-click
2. Dependencies are automatically included
3. Repository structure is consistent
4. Manifests are generated correctly
5. Git operations work smoothly
6. Components are importable via COMP-004+

## Future Enhancements

- Export to npm package
- Export to Noodl marketplace
- Batch export multiple components
- Export templates/starters
- Preview component before export
- Export history/versioning
