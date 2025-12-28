# COMP-001: Prefab System Refactoring

## Overview

Refactor the existing prefab system to support multiple sources (not just the docs endpoint). This creates the foundation for built-in prefabs, personal repositories, organization repositories, and community contributions.

## Context

The current prefab system is tightly coupled to the docs endpoint:
- `ModuleLibraryModel` fetches from `${docsEndpoint}/library/prefabs/index.json`
- Prefabs are zip files hosted on the docs site
- No support for alternative sources

This task creates an abstraction layer that allows prefabs to come from multiple sources while maintaining the existing user experience.

### Current Architecture

```
User clicks "Clone" in NodePicker
    ↓
ModuleLibraryModel.installPrefab(url)
    ↓
getModuleTemplateRoot(url)  ← Downloads & extracts zip
    ↓
ProjectImporter.listComponentsAndDependencies()
    ↓
ProjectImporter.checkForCollisions()
    ↓
_showImportPopup() if collisions
    ↓
_doImport()
```

### Key Files

- `packages/noodl-editor/src/editor/src/models/modulelibrarymodel.ts`
- `packages/noodl-editor/src/editor/src/utils/projectimporter.js`
- `packages/noodl-editor/src/editor/src/views/NodePicker/`

## Requirements

### Functional Requirements

1. **Source Abstraction**
   - Define `PrefabSource` interface for different sources
   - Support multiple sources simultaneously
   - Each source provides: list, search, fetch, metadata

2. **Source Types**
   - `DocsSource` - Existing docs endpoint (default)
   - `BuiltInSource` - Bundled with editor (COMP-002)
   - `GitHubSource` - GitHub repositories (COMP-003+)
   - `LocalSource` - Local filesystem (for development)

3. **Unified Prefab Model**
   - Consistent metadata across all sources
   - Version information
   - Source tracking (where did this come from?)
   - Dependencies and requirements

4. **Enhanced Metadata**
   - Author information
   - Version number
   - Noodl version compatibility
   - Screenshots/previews
   - Changelog
   - License

5. **Backwards Compatibility**
   - Existing prefabs continue to work
   - No changes to user workflow
   - Migration path for enhanced metadata

### Non-Functional Requirements

- Source fetching is async and non-blocking
- Caching for performance
- Graceful degradation if source unavailable
- Extensible for future sources

## Technical Approach

### 1. Prefab Source Interface

```typescript
// packages/noodl-editor/src/editor/src/models/prefab/PrefabSource.ts

interface PrefabMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  author?: {
    name: string;
    email?: string;
    url?: string;
  };
  noodlVersion?: string;  // Minimum compatible version
  tags: string[];
  icon?: string;
  screenshots?: string[];
  docs?: string;
  license?: string;
  repository?: string;
  dependencies?: string[];  // Other prefabs this depends on
  createdAt?: string;
  updatedAt?: string;
}

interface PrefabSourceConfig {
  id: string;
  name: string;
  priority: number;  // Higher = shown first
  enabled: boolean;
}

interface PrefabSource {
  readonly config: PrefabSourceConfig;
  
  // Lifecycle
  initialize(): Promise<void>;
  dispose(): void;
  
  // Listing
  listPrefabs(): Promise<PrefabMetadata[]>;
  searchPrefabs(query: string): Promise<PrefabMetadata[]>;
  
  // Fetching
  getPrefabDetails(id: string): Promise<PrefabMetadata>;
  downloadPrefab(id: string): Promise<string>;  // Returns local path to extracted content
  
  // State
  isAvailable(): boolean;
  getLastError(): Error | null;
}
```

### 2. Source Implementations

```typescript
// DocsSource - existing functionality wrapped
class DocsPrefabSource implements PrefabSource {
  config = {
    id: 'docs',
    name: 'Community Prefabs',
    priority: 50,
    enabled: true
  };
  
  async listPrefabs(): Promise<PrefabMetadata[]> {
    // Existing fetch logic from ModuleLibraryModel
    const endpoint = getDocsEndpoint();
    const response = await fetch(`${endpoint}/library/prefabs/index.json`);
    const items = await response.json();
    
    // Transform to new metadata format
    return items.map(item => this.transformLegacyItem(item));
  }
  
  private transformLegacyItem(item: IModule): PrefabMetadata {
    return {
      id: `docs:${item.label}`,
      name: item.label,
      description: item.desc,
      version: '1.0.0',  // Legacy items don't have versions
      tags: item.tags || [],
      icon: item.icon,
      docs: item.docs
    };
  }
}

// BuiltInSource - for COMP-002
class BuiltInPrefabSource implements PrefabSource {
  config = {
    id: 'builtin',
    name: 'Built-in Prefabs',
    priority: 100,
    enabled: true
  };
  
  // Implementation in COMP-002
}

// GitHubSource - for COMP-003+
class GitHubPrefabSource implements PrefabSource {
  config = {
    id: 'github',
    name: 'GitHub',
    priority: 75,
    enabled: true
  };
  
  constructor(private repoUrl: string) {}
  
  // Implementation in COMP-003
}
```

### 3. Prefab Registry

```typescript
// packages/noodl-editor/src/editor/src/models/prefab/PrefabRegistry.ts

class PrefabRegistry {
  private static instance: PrefabRegistry;
  private sources: Map<string, PrefabSource> = new Map();
  private cache: Map<string, PrefabMetadata[]> = new Map();
  
  // Source management
  registerSource(source: PrefabSource): void;
  unregisterSource(sourceId: string): void;
  getSource(sourceId: string): PrefabSource | undefined;
  getSources(): PrefabSource[];
  
  // Aggregated operations
  async getAllPrefabs(): Promise<PrefabMetadata[]>;
  async searchAllPrefabs(query: string): Promise<PrefabMetadata[]>;
  
  // Installation
  async installPrefab(prefabId: string, options?: InstallOptions): Promise<void>;
  
  // Cache
  invalidateCache(sourceId?: string): void;
  
  // Events
  onSourcesChanged(callback: () => void): () => void;
  onPrefabsUpdated(callback: () => void): () => void;
}
```

### 4. Updated ModuleLibraryModel

```typescript
// Refactored to use PrefabRegistry

export class ModuleLibraryModel extends Model {
  private registry: PrefabRegistry;
  
  constructor() {
    super();
    
    this.registry = PrefabRegistry.instance;
    
    // Register default sources
    this.registry.registerSource(new DocsPrefabSource());
    this.registry.registerSource(new BuiltInPrefabSource());
    
    // Listen for updates
    this.registry.onPrefabsUpdated(() => {
      this.notifyListeners('libraryUpdated');
    });
  }
  
  // Backwards compatible API
  get prefabs(): IModule[] {
    return this.registry.getAllPrefabsSync()
      .map(p => this.transformToLegacy(p));
  }
  
  async installPrefab(url: string, ...): Promise<void> {
    // Detect source from URL or use legacy path
    const prefabId = this.detectPrefabId(url);
    await this.registry.installPrefab(prefabId);
  }
}
```

## Files to Create

1. `packages/noodl-editor/src/editor/src/models/prefab/PrefabSource.ts` - Interface definitions
2. `packages/noodl-editor/src/editor/src/models/prefab/PrefabRegistry.ts` - Central registry
3. `packages/noodl-editor/src/editor/src/models/prefab/sources/DocsPrefabSource.ts` - Docs implementation
4. `packages/noodl-editor/src/editor/src/models/prefab/sources/BuiltInPrefabSource.ts` - Stub for COMP-002
5. `packages/noodl-editor/src/editor/src/models/prefab/sources/GitHubPrefabSource.ts` - Stub for COMP-003+
6. `packages/noodl-editor/src/editor/src/models/prefab/sources/LocalPrefabSource.ts` - For development
7. `packages/noodl-editor/src/editor/src/models/prefab/index.ts` - Barrel exports

## Files to Modify

1. `packages/noodl-editor/src/editor/src/models/modulelibrarymodel.ts`
   - Refactor to use PrefabRegistry
   - Maintain backwards compatible API
   - Delegate to sources

2. `packages/noodl-editor/src/editor/src/views/NodePicker/tabs/NodePickerSearchView/NodePickerSearchView.tsx`
   - Update to work with new metadata format
   - Add source indicators

3. `packages/noodl-editor/src/editor/src/views/NodePicker/components/ModuleCard/ModuleCard.tsx`
   - Add source badge
   - Add version display
   - Handle enhanced metadata

## Implementation Steps

### Phase 1: Interfaces & Registry
1. Define PrefabSource interface
2. Define PrefabMetadata interface
3. Create PrefabRegistry class
4. Add source registration

### Phase 2: Docs Source Migration
1. Create DocsPrefabSource
2. Migrate existing fetch logic
3. Add metadata transformation
4. Test backwards compatibility

### Phase 3: ModuleLibraryModel Refactor
1. Integrate PrefabRegistry
2. Maintain backwards compatible API
3. Update install methods
4. Add source detection

### Phase 4: UI Updates
1. Add source indicators to cards
2. Show version information
3. Handle multiple sources in search

### Phase 5: Stub Sources
1. Create BuiltInPrefabSource stub
2. Create GitHubPrefabSource stub
3. Create LocalPrefabSource for development

## Metadata Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["id", "name", "version"],
  "properties": {
    "id": { "type": "string" },
    "name": { "type": "string" },
    "description": { "type": "string" },
    "version": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" },
    "author": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "email": { "type": "string" },
        "url": { "type": "string" }
      }
    },
    "noodlVersion": { "type": "string" },
    "tags": { "type": "array", "items": { "type": "string" } },
    "icon": { "type": "string" },
    "screenshots": { "type": "array", "items": { "type": "string" } },
    "docs": { "type": "string" },
    "license": { "type": "string" },
    "repository": { "type": "string" },
    "dependencies": { "type": "array", "items": { "type": "string" } }
  }
}
```

## Testing Checklist

- [ ] PrefabRegistry initializes correctly
- [ ] DocsPrefabSource fetches from docs endpoint
- [ ] Legacy prefabs continue to work
- [ ] Metadata transformation preserves data
- [ ] Multiple sources aggregate correctly
- [ ] Search works across sources
- [ ] Install works from any source
- [ ] Source indicators display correctly
- [ ] Cache invalidation works
- [ ] Error handling for unavailable sources

## Dependencies

- None (foundation task)

## Blocked By

- None

## Blocks

- COMP-002 (Built-in Prefabs)
- COMP-003 (Component Export)
- COMP-004 (Organization Components)

## Estimated Effort

- Interfaces & types: 2-3 hours
- PrefabRegistry: 3-4 hours
- DocsPrefabSource: 2-3 hours
- ModuleLibraryModel refactor: 3-4 hours
- UI updates: 2-3 hours
- Testing: 2-3 hours
- **Total: 14-20 hours**

## Success Criteria

1. New source abstraction in place
2. Existing prefabs continue to work identically
3. Multiple sources can be registered
4. UI shows source indicators
5. Foundation ready for built-in and GitHub sources

## Future Considerations

- Source priority/ordering configuration
- Source enable/disable in settings
- Custom source plugins
- Prefab ratings/popularity
- Usage analytics per source
