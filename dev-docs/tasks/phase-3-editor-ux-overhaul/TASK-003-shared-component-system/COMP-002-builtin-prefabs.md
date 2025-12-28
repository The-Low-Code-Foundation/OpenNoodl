# COMP-002: Built-in Prefabs

## Overview

Bundle essential prefabs directly with the OpenNoodl editor, so they're available immediately without network access. This improves the onboarding experience and ensures core functionality is always available.

## Context

Currently, all prefabs are fetched from the docs endpoint at runtime:
- Requires network connectivity
- Adds latency on first load
- No prefabs available offline
- New users see empty prefab library initially

By bundling prefabs with the editor:
- Instant availability
- Works offline
- Consistent experience for all users
- Core prefabs versioned with editor releases

### Existing Export/Import

From `exportProjectComponents.ts` and `projectimporter.js`:
- Components exported as zip files
- Import handles collision detection
- Styles, variants, resources included
- Dependency tracking exists

## Requirements

### Functional Requirements

1. **Built-in Prefab Bundle**
   - Essential prefabs bundled in editor distribution
   - Loaded from local filesystem, not network
   - Versioned with editor releases

2. **Prefab Selection**
   - Form components (Input, Button, Checkbox, etc.)
   - Layout helpers (Card, Modal, Drawer)
   - Data utilities (REST caller, LocalStorage, etc.)
   - Authentication flows (basic patterns)
   - Navigation patterns

3. **UI Distinction**
   - "Built-in" badge on bundled prefabs
   - Shown first in prefab list
   - Separate section or filter option

4. **Update Mechanism**
   - Built-in prefabs update with editor
   - No manual update needed
   - Changelog visible for what's new

5. **Offline First**
   - Available immediately on fresh install
   - No network request needed
   - Graceful handling when docs unavailable

### Non-Functional Requirements

- Bundle size impact < 5MB
- Load time < 500ms
- No runtime network dependency
- Works in air-gapped environments

## Technical Approach

### 1. Bundle Structure

```
packages/noodl-editor/
├── static/
│   └── builtin-prefabs/
│       ├── index.json           # Manifest of built-in prefabs
│       └── prefabs/
│           ├── form-input/
│           │   ├── prefab.json  # Metadata
│           │   └── components/  # Component files
│           ├── form-button/
│           ├── card-layout/
│           ├── modal-dialog/
│           ├── rest-client/
│           └── ...
```

### 2. Manifest Format

```json
{
  "version": "1.0.0",
  "noodlVersion": "2.10.0",
  "prefabs": [
    {
      "id": "builtin:form-input",
      "name": "Form Input",
      "description": "Styled text input with label, validation, and error states",
      "version": "1.0.0",
      "category": "Forms",
      "tags": ["form", "input", "text", "validation"],
      "icon": "input-icon.svg",
      "path": "prefabs/form-input"
    }
  ]
}
```

### 3. BuiltInPrefabSource Implementation

```typescript
// packages/noodl-editor/src/editor/src/models/prefab/sources/BuiltInPrefabSource.ts

import { platform } from '@noodl/platform';

class BuiltInPrefabSource implements PrefabSource {
  config = {
    id: 'builtin',
    name: 'Built-in',
    priority: 100,  // Highest priority - show first
    enabled: true
  };
  
  private manifest: BuiltInManifest | null = null;
  private basePath: string;
  
  async initialize(): Promise<void> {
    // Get path to bundled prefabs
    this.basePath = platform.getBuiltInPrefabsPath();
    
    // Load manifest
    const manifestPath = path.join(this.basePath, 'index.json');
    const content = await fs.readFile(manifestPath, 'utf-8');
    this.manifest = JSON.parse(content);
  }
  
  async listPrefabs(): Promise<PrefabMetadata[]> {
    if (!this.manifest) await this.initialize();
    
    return this.manifest.prefabs.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      version: p.version,
      tags: p.tags,
      icon: this.resolveIcon(p.icon),
      source: 'builtin',
      category: p.category
    }));
  }
  
  async downloadPrefab(id: string): Promise<string> {
    // No download needed - return local path
    const prefab = this.manifest.prefabs.find(p => p.id === id);
    return path.join(this.basePath, prefab.path);
  }
  
  private resolveIcon(iconPath: string): string {
    return `file://${path.join(this.basePath, 'icons', iconPath)}`;
  }
}
```

### 4. Build-time Prefab Bundling

```typescript
// scripts/bundle-prefabs.ts

/**
 * Run during build to prepare built-in prefabs
 * 1. Reads prefab source projects
 * 2. Exports components
 * 3. Generates manifest
 * 4. Copies to static directory
 */

async function bundlePrefabs() {
  const prefabSources = await glob('prefab-sources/*');
  const manifest: BuiltInManifest = {
    version: packageJson.version,
    noodlVersion: packageJson.version,
    prefabs: []
  };
  
  for (const source of prefabSources) {
    const metadata = await readPrefabMetadata(source);
    const outputPath = path.join(OUTPUT_DIR, metadata.id);
    
    await exportPrefabComponents(source, outputPath);
    
    manifest.prefabs.push({
      id: `builtin:${metadata.id}`,
      name: metadata.name,
      description: metadata.description,
      version: metadata.version,
      category: metadata.category,
      tags: metadata.tags,
      icon: metadata.icon,
      path: metadata.id
    });
  }
  
  await writeManifest(manifest);
}
```

### 5. Prefab Categories

```typescript
enum PrefabCategory {
  Forms = 'Forms',
  Layout = 'Layout',
  Navigation = 'Navigation',
  Data = 'Data',
  Authentication = 'Authentication',
  Feedback = 'Feedback',
  Media = 'Media'
}

const BUILT_IN_PREFABS: BuiltInPrefabConfig[] = [
  // Forms
  { id: 'form-input', category: PrefabCategory.Forms },
  { id: 'form-textarea', category: PrefabCategory.Forms },
  { id: 'form-checkbox', category: PrefabCategory.Forms },
  { id: 'form-radio', category: PrefabCategory.Forms },
  { id: 'form-select', category: PrefabCategory.Forms },
  { id: 'form-button', category: PrefabCategory.Forms },
  
  // Layout
  { id: 'card', category: PrefabCategory.Layout },
  { id: 'modal', category: PrefabCategory.Layout },
  { id: 'drawer', category: PrefabCategory.Layout },
  { id: 'accordion', category: PrefabCategory.Layout },
  { id: 'tabs', category: PrefabCategory.Layout },
  
  // Navigation
  { id: 'navbar', category: PrefabCategory.Navigation },
  { id: 'sidebar', category: PrefabCategory.Navigation },
  { id: 'breadcrumb', category: PrefabCategory.Navigation },
  { id: 'pagination', category: PrefabCategory.Navigation },
  
  // Data
  { id: 'rest-client', category: PrefabCategory.Data },
  { id: 'local-storage', category: PrefabCategory.Data },
  { id: 'data-table', category: PrefabCategory.Data },
  
  // Feedback
  { id: 'toast', category: PrefabCategory.Feedback },
  { id: 'loading-spinner', category: PrefabCategory.Feedback },
  { id: 'progress-bar', category: PrefabCategory.Feedback },
];
```

## Files to Create

1. `packages/noodl-editor/static/builtin-prefabs/index.json` - Manifest
2. `packages/noodl-editor/static/builtin-prefabs/prefabs/` - Prefab directories
3. `packages/noodl-editor/src/editor/src/models/prefab/sources/BuiltInPrefabSource.ts` - Source implementation
4. `scripts/bundle-prefabs.ts` - Build script
5. `prefab-sources/` - Source projects for built-in prefabs

## Files to Modify

1. `packages/noodl-editor/src/editor/src/models/prefab/PrefabRegistry.ts`
   - Register BuiltInPrefabSource
   - Add category support

2. `packages/noodl-editor/src/editor/src/views/NodePicker/tabs/NodePickerSearchView/NodePickerSearchView.tsx`
   - Add category filtering
   - Show "Built-in" badge

3. `packages/noodl-editor/src/editor/src/views/NodePicker/components/ModuleCard/ModuleCard.tsx`
   - Add "Built-in" badge styling
   - Show category

4. `package.json`
   - Add bundle-prefabs script

5. `webpack.config.js` or equivalent
   - Include static/builtin-prefabs in build

## Implementation Steps

### Phase 1: Infrastructure
1. Create bundle directory structure
2. Implement BuiltInPrefabSource
3. Create manifest format
4. Register source in PrefabRegistry

### Phase 2: Build Pipeline
1. Create bundle-prefabs script
2. Add to build process
3. Test bundling works

### Phase 3: Initial Prefabs
1. Create Form Input prefab
2. Create Form Button prefab
3. Create Card layout prefab
4. Test import/collision handling

### Phase 4: UI Updates
1. Add "Built-in" badge
2. Add category filter
3. Show built-in prefabs first

### Phase 5: Full Prefab Set
1. Create remaining form prefabs
2. Create layout prefabs
3. Create data prefabs
4. Create navigation prefabs

### Phase 6: Documentation
1. Document built-in prefabs
2. Add usage examples
3. Create component docs

## Initial Built-in Prefabs

### Priority 1 (MVP)
| Prefab | Category | Components |
|--------|----------|------------|
| Form Input | Forms | TextInput, Label, ErrorMessage |
| Form Button | Forms | Button, LoadingState |
| Card | Layout | Card, CardHeader, CardBody |
| Modal | Layout | Modal, ModalTrigger, ModalContent |
| REST Client | Data | RESTRequest, ResponseHandler |

### Priority 2
| Prefab | Category | Components |
|--------|----------|------------|
| Form Textarea | Forms | Textarea, CharCount |
| Form Checkbox | Forms | Checkbox, CheckboxGroup |
| Form Select | Forms | Select, Option |
| Drawer | Layout | Drawer, DrawerTrigger |
| Toast | Feedback | Toast, ToastContainer |

### Priority 3
| Prefab | Category | Components |
|--------|----------|------------|
| Tabs | Layout | TabBar, TabPanel |
| Accordion | Layout | Accordion, AccordionItem |
| Navbar | Navigation | Navbar, NavItem |
| Data Table | Data | Table, Column, Row, Cell |

## Testing Checklist

- [ ] Built-in prefabs load without network
- [ ] Prefabs appear first in list
- [ ] "Built-in" badge displays correctly
- [ ] Category filter works
- [ ] Import works for each prefab
- [ ] Collision detection works
- [ ] Styles import correctly
- [ ] Works in air-gapped environment
- [ ] Bundle size is acceptable
- [ ] Load time is acceptable

## Dependencies

- COMP-001 (Prefab System Refactoring)

## Blocked By

- COMP-001

## Blocks

- None (can proceed in parallel with COMP-003+)

## Estimated Effort

- Infrastructure: 3-4 hours
- Build pipeline: 2-3 hours
- BuiltInPrefabSource: 2-3 hours
- MVP prefabs (5): 8-10 hours
- UI updates: 2-3 hours
- Testing: 2-3 hours
- **Total: 19-26 hours**

## Success Criteria

1. Built-in prefabs available immediately
2. Work offline without network
3. Clear "Built-in" distinction in UI
4. Categories organize prefabs logically
5. Import flow works smoothly
6. Bundle size < 5MB

## Future Enhancements

- User can hide built-in prefabs
- Community voting for built-in inclusion
- Per-category enable/disable
- Built-in prefab updates notification
- Prefab source code viewing
