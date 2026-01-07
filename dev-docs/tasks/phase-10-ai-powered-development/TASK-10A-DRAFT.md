# Phase 9A: Project Structure Modernization

## From Monolithic JSON to AI-Friendly Component Files

**Status:** CRITICAL PREREQUISITE  
**Priority:** BLOCKS ALL AI FEATURES  
**Duration:** 6-8 weeks  
**Risk Level:** HIGH (touches everything)

---

## The Problem: One Giant JSON To Rule Them All

### Current State

Every Nodegx project stores **everything** in a single `project.json` file:

```
my-project/
├── project.json          # 50,000+ lines, ALL components, ALL connections
├── assets/               # At least these are separate
└── cloud-data/
```

### What's Inside project.json

```json
{
  "name": "My Conference App",
  "version": "2.0",
  "settings": {
    /* project settings */
  },
  "components": {
    "/%rootcomponent": {
      "name": "App",
      "graph": {
        "nodes": [
          /* 500 nodes */
        ],
        "connections": [
          /* 2000 connections */
        ]
      },
      "ports": [
        /* inputs/outputs */
      ],
      "children": [
        /* child components */
      ]
    },
    "/components/header": {
      /* another 200 nodes */
    },
    "/components/footer": {
      /* another 150 nodes */
    },
    "/pages/home": {
      /* another 800 nodes */
    },
    "/pages/profile": {
      /* another 600 nodes */
    },
    "/pages/schedule": {
      /* another 1200 nodes */
    }
    /* ... 50 more components ... */
  },
  "variants": {
    /* responsive variants */
  },
  "styles": {
    /* all styles */
  },
  "cloudservices": {
    /* backend config */
  },
  "metadata": {
    /* timestamps, ids */
  }
}
```

### Why This Is Catastrophic for AI

| Problem              | Impact                                    |
| -------------------- | ----------------------------------------- |
| **Size**             | 50K+ lines can't fit in context window    |
| **No targeting**     | Can't read just one component             |
| **Blast radius**     | Any edit risks corrupting unrelated parts |
| **No diffing**       | Git diffs are meaningless walls of JSON   |
| **No caching**       | Can't cache individual components         |
| **Memory explosion** | Must load entire project to read anything |
| **Merge conflicts**  | Team collaboration is nightmare           |

### The Token Math

Let's say we want AI to modify the UserProfile component:

```
Current approach:
- Load project.json: ~200,000 tokens
- Find UserProfile section: ~5,000 tokens relevant
- Efficiency: 2.5%

Proposed approach:
- Load components/UserProfile/nodes.json: ~3,000 tokens
- Efficiency: 100%
```

**That's a 40x improvement in token efficiency.**

At $3/million input tokens (Claude Sonnet), that's the difference between:

- Current: $0.60 per component read
- Proposed: $0.01 per component read

Over thousands of AI interactions, this adds up to real money and real speed.

---

## The Solution: React-Style Component Files

### Proposed Structure

```
my-project/
├── nodegx.project.json           # Project metadata only (~100 lines)
├── nodegx.routes.json            # Route definitions
├── nodegx.styles.json            # Global styles and themes
├── nodegx.cloudservices.json     # Backend configurations
│
├── components/
│   ├── _registry.json            # Component index/manifest
│   │
│   ├── App/                      # Root component
│   │   ├── component.json        # Metadata, ports, settings
│   │   ├── nodes.json            # Node definitions
│   │   ├── connections.json      # Wiring between nodes
│   │   └── variants.json         # Responsive variants (if any)
│   │
│   ├── Header/
│   │   ├── component.json
│   │   ├── nodes.json
│   │   └── connections.json
│   │
│   ├── pages/
│   │   ├── HomePage/
│   │   │   ├── component.json
│   │   │   ├── nodes.json
│   │   │   └── connections.json
│   │   ├── ProfilePage/
│   │   └── SchedulePage/
│   │
│   └── shared/
│       ├── Button/
│       ├── Card/
│       ├── Avatar/
│       └── LoadingSpinner/
│
├── models/
│   ├── _registry.json
│   ├── User.json
│   ├── Session.json
│   └── Attendee.json
│
└── assets/
    └── ...
```

### File Formats

#### nodegx.project.json (Root)

```json
{
  "$schema": "https://nodegx.dev/schemas/project-v2.json",
  "name": "My Conference App",
  "id": "proj_abc123",
  "version": "2.0",
  "nodegxVersion": "2.5.0",
  "created": "2025-06-15T10:30:00Z",
  "modified": "2026-01-07T14:30:00Z",

  "settings": {
    "rootComponent": "App",
    "defaultRoute": "/home",
    "responsive": {
      "breakpoints": ["mobile", "tablet", "desktop"]
    }
  },

  "structure": {
    "componentsDir": "components",
    "modelsDir": "models",
    "assetsDir": "assets"
  }
}
```

#### components/\_registry.json

```json
{
  "$schema": "https://nodegx.dev/schemas/registry-v2.json",
  "version": 1,
  "lastUpdated": "2026-01-07T14:30:00Z",

  "components": {
    "App": {
      "path": "App",
      "type": "root",
      "created": "2025-06-15T10:30:00Z",
      "modified": "2026-01-07T14:30:00Z",
      "nodeCount": 45,
      "connectionCount": 120
    },
    "Header": {
      "path": "Header",
      "type": "visual",
      "created": "2025-06-20T09:00:00Z",
      "modified": "2026-01-05T11:00:00Z",
      "nodeCount": 28,
      "connectionCount": 65
    },
    "pages/HomePage": {
      "path": "pages/HomePage",
      "type": "page",
      "route": "/home",
      "created": "2025-06-15T10:30:00Z",
      "modified": "2026-01-06T16:00:00Z",
      "nodeCount": 156,
      "connectionCount": 340
    }
    // ... all components listed
  },

  "stats": {
    "totalComponents": 54,
    "totalNodes": 3420,
    "totalConnections": 8950
  }
}
```

#### components/Header/component.json

```json
{
  "$schema": "https://nodegx.dev/schemas/component-v2.json",
  "id": "comp_header_xyz789",
  "name": "Header",
  "displayName": "Site Header",
  "description": "Main navigation header with logo and menu",
  "type": "visual",

  "created": "2025-06-20T09:00:00Z",
  "modified": "2026-01-05T11:00:00Z",
  "modifiedBy": "user_abc",

  "category": "layout",
  "tags": ["navigation", "header", "menu"],

  "thumbnail": "thumbnail.png",

  "ports": {
    "inputs": [
      {
        "name": "userName",
        "type": "string",
        "displayName": "User Name",
        "description": "Logged in user's name",
        "default": ""
      },
      {
        "name": "avatarUrl",
        "type": "string",
        "displayName": "Avatar URL"
      },
      {
        "name": "isLoggedIn",
        "type": "boolean",
        "default": false
      }
    ],
    "outputs": [
      {
        "name": "onMenuClick",
        "type": "signal",
        "displayName": "Menu Clicked"
      },
      {
        "name": "onLogout",
        "type": "signal",
        "displayName": "Logout Clicked"
      }
    ]
  },

  "dependencies": ["shared/Avatar", "shared/Button", "shared/Logo"],

  "settings": {
    "canHaveChildren": false,
    "allowedInRoutes": true,
    "defaultDimensions": {
      "width": "100%",
      "height": "64px"
    }
  }
}
```

#### components/Header/nodes.json

```json
{
  "$schema": "https://nodegx.dev/schemas/nodes-v2.json",
  "componentId": "comp_header_xyz789",
  "version": 1,

  "nodes": [
    {
      "id": "root",
      "type": "Group",
      "label": "Header Container",
      "position": { "x": 0, "y": 0 },
      "properties": {
        "layout": "row",
        "justifyContent": "space-between",
        "alignItems": "center",
        "backgroundColor": "#ffffff",
        "paddingX": "24px",
        "paddingY": "12px",
        "boxShadow": "0 2px 4px rgba(0,0,0,0.1)"
      },
      "children": ["logo-group", "nav-group", "user-group"]
    },
    {
      "id": "logo-group",
      "type": "Group",
      "label": "Logo Section",
      "parent": "root",
      "position": { "x": 50, "y": 100 },
      "properties": {
        "layout": "row",
        "alignItems": "center",
        "gap": "12px"
      },
      "children": ["logo", "app-name"]
    },
    {
      "id": "logo",
      "type": "component:shared/Logo",
      "label": "Logo",
      "parent": "logo-group",
      "position": { "x": 100, "y": 150 },
      "properties": {
        "size": "medium"
      }
    },
    {
      "id": "app-name",
      "type": "Text",
      "label": "App Name",
      "parent": "logo-group",
      "position": { "x": 200, "y": 150 },
      "properties": {
        "text": "Conference Hub",
        "variant": "heading",
        "fontSize": "20px",
        "fontWeight": "600"
      }
    },
    {
      "id": "nav-group",
      "type": "Group",
      "label": "Navigation",
      "parent": "root",
      "position": { "x": 400, "y": 100 },
      "properties": {
        "layout": "row",
        "gap": "24px"
      },
      "children": ["nav-home", "nav-schedule", "nav-speakers"]
    },
    {
      "id": "nav-home",
      "type": "Text",
      "label": "Home Link",
      "parent": "nav-group",
      "position": { "x": 450, "y": 150 },
      "properties": {
        "text": "Home",
        "cursor": "pointer"
      },
      "states": {
        "hover": {
          "color": "#3B82F6"
        }
      }
    },
    {
      "id": "user-group",
      "type": "Group",
      "label": "User Section",
      "parent": "root",
      "position": { "x": 800, "y": 100 },
      "properties": {
        "layout": "row",
        "alignItems": "center",
        "gap": "12px"
      },
      "children": ["user-avatar", "user-name", "logout-btn"]
    },
    {
      "id": "user-avatar",
      "type": "component:shared/Avatar",
      "label": "User Avatar",
      "parent": "user-group",
      "position": { "x": 850, "y": 150 },
      "properties": {
        "size": "small"
      }
    },
    {
      "id": "user-name",
      "type": "Text",
      "label": "User Name Display",
      "parent": "user-group",
      "position": { "x": 950, "y": 150 },
      "properties": {
        "text": ""
      }
    },
    {
      "id": "logout-btn",
      "type": "component:shared/Button",
      "label": "Logout Button",
      "parent": "user-group",
      "position": { "x": 1050, "y": 150 },
      "properties": {
        "text": "Logout",
        "variant": "ghost",
        "size": "small"
      }
    },
    {
      "id": "condition-logged-in",
      "type": "Condition",
      "label": "Check Logged In",
      "position": { "x": 600, "y": 300 },
      "properties": {}
    }
  ]
}
```

#### components/Header/connections.json

```json
{
  "$schema": "https://nodegx.dev/schemas/connections-v2.json",
  "componentId": "comp_header_xyz789",
  "version": 1,

  "connections": [
    {
      "id": "conn_1",
      "from": {
        "node": "input:userName",
        "port": "value"
      },
      "to": {
        "node": "user-name",
        "port": "text"
      }
    },
    {
      "id": "conn_2",
      "from": {
        "node": "input:avatarUrl",
        "port": "value"
      },
      "to": {
        "node": "user-avatar",
        "port": "src"
      }
    },
    {
      "id": "conn_3",
      "from": {
        "node": "input:isLoggedIn",
        "port": "value"
      },
      "to": {
        "node": "condition-logged-in",
        "port": "condition"
      }
    },
    {
      "id": "conn_4",
      "from": {
        "node": "condition-logged-in",
        "port": "true"
      },
      "to": {
        "node": "user-group",
        "port": "visible"
      }
    },
    {
      "id": "conn_5",
      "from": {
        "node": "logout-btn",
        "port": "onClick"
      },
      "to": {
        "node": "output:onLogout",
        "port": "trigger"
      }
    },
    {
      "id": "conn_6",
      "from": {
        "node": "nav-home",
        "port": "onClick"
      },
      "to": {
        "node": "navigate-home",
        "port": "trigger"
      }
    }
  ]
}
```

---

## AI Interaction Patterns

### Pattern 1: Listing Components

```
User: "What components do I have?"

AI Action:
1. Read components/_registry.json (small file, ~2KB)
2. Return formatted list

AI: "You have 54 components:
     - App (root)
     - Header (28 nodes)
     - pages/HomePage (156 nodes)
     - pages/ProfilePage (89 nodes)
     - shared/Button (12 nodes)
     ..."
```

### Pattern 2: Understanding a Component

```
User: "How does the Header component work?"

AI Actions:
1. Read components/Header/component.json (~1KB)
2. Read components/Header/nodes.json (~3KB)
3. Read components/Header/connections.json (~1KB)
Total: ~5KB instead of entire project

AI: "The Header component:
     - Takes 3 inputs: userName, avatarUrl, isLoggedIn
     - Emits 2 signals: onMenuClick, onLogout
     - Contains a logo, navigation links, and user section
     - Shows/hides user section based on login state
     - Uses shared/Avatar and shared/Button components"
```

### Pattern 3: Modifying a Component

```
User: "Add a notification bell icon next to the user avatar"

AI Actions:
1. Read components/Header/nodes.json
2. Read components/Header/connections.json
3. Identify insertion point (user-group)
4. Generate new node definition
5. Write ONLY the modified files

Changes:
- nodes.json: Add bell-icon node
- connections.json: Add connection from notification count

AI: "Added notification bell to Header:
     - New node: bell-icon (Icon component)
     - Position: Between avatar and username
     - Connected to new input: notificationCount

     [Modified: components/Header/nodes.json]
     [Modified: components/Header/connections.json]
     [Modified: components/Header/component.json - added input]"
```

### Pattern 4: Creating a New Component

```
User: "Create a SessionCard component that shows session title,
       speaker, time, and a bookmark button"

AI Actions:
1. Create components/shared/SessionCard/ directory
2. Generate component.json with inputs/outputs
3. Generate nodes.json with visual structure
4. Generate connections.json with wiring
5. Update _registry.json

Files Created:
- components/shared/SessionCard/component.json
- components/shared/SessionCard/nodes.json
- components/shared/SessionCard/connections.json
- Updated: components/_registry.json
```

### Pattern 5: Finding Related Components

```
User: "What components use the User model?"

AI Actions:
1. Read models/User.json to understand structure
2. Search component.json files for dependencies
3. Search nodes.json files for model references

AI: "Found 8 components using User model:
     - Header (displays user name, avatar)
     - pages/ProfilePage (full user details)
     - pages/SettingsPage (user preferences)
     - shared/UserCard (user summary)
     ..."
```

---

## Migration Strategy

### Phase 1: Analysis & Design (Week 1-2)

**Tasks:**

1. Audit current project.json structure deeply
2. Identify all node types and their serialization
3. Document edge cases (cycles, references, etc.)
4. Design JSON schemas for new format
5. Create migration test cases

**Deliverables:**

- Detailed mapping document
- JSON Schema files
- Test project set

### Phase 2: Export Implementation (Week 2-3)

**Tasks:**

1. Build project.json → new format converter
2. Handle all component types
3. Handle all connection types
4. Preserve all metadata
5. Generate registry files

**Code Structure:**

```typescript
// src/migration/exporter.ts

export class ProjectExporter {
  async export(project: LegacyProject, outputDir: string): Promise<void> {
    // 1. Extract project metadata
    await this.writeProjectFile(project, outputDir);

    // 2. Extract and write each component
    const registry: ComponentRegistry = { components: {} };

    for (const [path, component] of Object.entries(project.components)) {
      const componentDir = this.getComponentDir(path, outputDir);
      await this.exportComponent(component, componentDir);

      registry.components[this.normalizePath(path)] = {
        path: this.getRelativePath(path),
        type: this.inferComponentType(component),
        nodeCount: component.graph?.nodes?.length || 0,
        connectionCount: component.graph?.connections?.length || 0
      };
    }

    // 3. Write registry
    await this.writeRegistry(registry, outputDir);

    // 4. Export models
    await this.exportModels(project, outputDir);

    // 5. Export styles
    await this.exportStyles(project, outputDir);
  }

  private async exportComponent(component: LegacyComponent, outputDir: string): Promise<void> {
    await fs.mkdir(outputDir, { recursive: true });

    // component.json
    await fs.writeFile(
      path.join(outputDir, 'component.json'),
      JSON.stringify(this.extractComponentMeta(component), null, 2)
    );

    // nodes.json
    await fs.writeFile(path.join(outputDir, 'nodes.json'), JSON.stringify(this.extractNodes(component), null, 2));

    // connections.json
    await fs.writeFile(
      path.join(outputDir, 'connections.json'),
      JSON.stringify(this.extractConnections(component), null, 2)
    );

    // variants.json (if exists)
    if (component.variants) {
      await fs.writeFile(path.join(outputDir, 'variants.json'), JSON.stringify(component.variants, null, 2));
    }
  }
}
```

### Phase 3: Import Implementation (Week 3-4)

**Tasks:**

1. Build new format → project.json converter
2. Validate round-trip integrity
3. Handle incremental imports (single component)
4. Performance optimization

```typescript
// src/migration/importer.ts

export class ProjectImporter {
  async import(projectDir: string): Promise<LegacyProject> {
    // 1. Read project metadata
    const projectMeta = await this.readProjectFile(projectDir);

    // 2. Read registry
    const registry = await this.readRegistry(projectDir);

    // 3. Import all components
    const components: Record<string, LegacyComponent> = {};

    for (const [name, info] of Object.entries(registry.components)) {
      const componentDir = path.join(projectDir, 'components', info.path);
      components[this.toLegacyPath(name)] = await this.importComponent(componentDir);
    }

    // 4. Reconstruct full project
    return {
      name: projectMeta.name,
      version: projectMeta.version,
      components
      // ... other fields
    };
  }

  async importComponent(componentDir: string): Promise<LegacyComponent> {
    const meta = JSON.parse(await fs.readFile(path.join(componentDir, 'component.json'), 'utf-8'));
    const nodes = JSON.parse(await fs.readFile(path.join(componentDir, 'nodes.json'), 'utf-8'));
    const connections = JSON.parse(await fs.readFile(path.join(componentDir, 'connections.json'), 'utf-8'));

    return this.reconstructComponent(meta, nodes, connections);
  }
}
```

### Phase 4: Editor Integration (Week 4-6)

**Tasks:**

1. Add format detection on project open
2. Implement lazy loading of components
3. Update save logic for new format
4. Add migration wizard UI
5. Update project browser

**Key Changes:**

```typescript
// ProjectModel changes

class ProjectModel {
  private format: 'legacy' | 'v2' = 'legacy';
  private componentCache: Map<string, Component> = new Map();

  async loadProject(projectPath: string): Promise<void> {
    this.format = await this.detectFormat(projectPath);

    if (this.format === 'v2') {
      // Only load metadata and registry
      this.metadata = await this.loadProjectMeta(projectPath);
      this.registry = await this.loadRegistry(projectPath);
      // Components loaded on demand
    } else {
      // Legacy: load everything
      await this.loadLegacyProject(projectPath);
    }
  }

  async getComponent(path: string): Promise<Component> {
    if (this.componentCache.has(path)) {
      return this.componentCache.get(path)!;
    }

    if (this.format === 'v2') {
      // Lazy load from files
      const component = await this.loadComponentFromFiles(path);
      this.componentCache.set(path, component);
      return component;
    } else {
      return this.components[path];
    }
  }

  async saveComponent(path: string, component: Component): Promise<void> {
    if (this.format === 'v2') {
      // Save only this component's files
      await this.saveComponentFiles(path, component);
      await this.updateRegistry(path, component);
    } else {
      // Legacy: save entire project
      this.components[path] = component;
      await this.saveProject();
    }
  }
}
```

### Phase 5: Migration Wizard (Week 6-7)

**UI Flow:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Project Format Migration                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Your project uses the legacy format. Migrating to the new format          │
│  enables:                                                                   │
│                                                                             │
│  ✓ AI-powered editing assistance                                           │
│  ✓ Better Git collaboration (meaningful diffs)                             │
│  ✓ Faster project loading                                                  │
│  ✓ Component-level version history                                         │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Project: My Conference App                                          │   │
│  │ Components: 54                                                       │   │
│  │ Estimated time: ~30 seconds                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ⚠️  A backup will be created before migration                              │
│                                                                             │
│                                                                             │
│                              [Cancel]  [Migrate Project]                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Phase 6: Validation & Rollout (Week 7-8)

**Tasks:**

1. Extensive testing with real projects
2. Performance benchmarking
3. Documentation
4. Gradual rollout (opt-in first)
5. Feedback collection

---

## Implementation Tasks

### STRUCT-001: JSON Schema Definition

**Effort:** 3 days

- Define schema for nodegx.project.json
- Define schema for component.json
- Define schema for nodes.json
- Define schema for connections.json
- Define schema for \_registry.json
- Validation utilities

### STRUCT-002: Export Engine

**Effort:** 5 days

- Core exporter class
- Component extraction logic
- Connection extraction logic
- Metadata preservation
- Registry generation
- Test coverage

### STRUCT-003: Import Engine

**Effort:** 5 days

- Core importer class
- Component reconstruction
- Connection reconstruction
- Round-trip validation
- Incremental import support
- Test coverage

### STRUCT-004: Editor Format Detection

**Effort:** 2 days

- Format detection utility
- Project open flow update
- Error handling for mixed formats

### STRUCT-005: Lazy Loading

**Effort:** 4 days

- Component cache implementation
- On-demand loading
- Memory management
- Performance optimization

### STRUCT-006: Save Logic

**Effort:** 4 days

- Component-level save
- Registry updates
- Atomic writes (prevent corruption)
- Auto-save integration

### STRUCT-007: Migration Wizard UI

**Effort:** 3 days

- Wizard component
- Progress indicators
- Backup creation
- Rollback support

### STRUCT-008: Testing & Validation

**Effort:** 5 days

- Unit tests for all modules
- Integration tests
- Real project migration tests
- Performance benchmarks

### STRUCT-009: Documentation

**Effort:** 2 days

- Format specification docs
- Migration guide
- Troubleshooting guide

---

## File System Considerations

### Atomic Writes

Prevent corruption with atomic saves:

```typescript
async function atomicWrite(filePath: string, content: string): Promise<void> {
  const tempPath = `${filePath}.tmp`;
  const backupPath = `${filePath}.backup`;

  try {
    // Write to temp file
    await fs.writeFile(tempPath, content);

    // Verify write
    const verify = await fs.readFile(tempPath, 'utf-8');
    if (verify !== content) {
      throw new Error('Write verification failed');
    }

    // Backup existing file
    if (await fileExists(filePath)) {
      await fs.rename(filePath, backupPath);
    }

    // Atomic rename
    await fs.rename(tempPath, filePath);

    // Remove backup on success
    if (await fileExists(backupPath)) {
      await fs.unlink(backupPath);
    }
  } catch (error) {
    // Restore from backup if exists
    if (await fileExists(backupPath)) {
      await fs.rename(backupPath, filePath);
    }
    throw error;
  }
}
```

### File Watching

For collaborative editing:

```typescript
class ComponentWatcher {
  private watcher: FSWatcher;

  watch(componentPath: string, onChange: () => void): void {
    const files = ['component.json', 'nodes.json', 'connections.json'].map((f) => path.join(componentPath, f));

    this.watcher = chokidar.watch(files, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 500
      }
    });

    this.watcher.on('change', (filePath) => {
      // Debounce and notify
      onChange();
    });
  }
}
```

### Git Integration

The new structure enables meaningful diffs:

```diff
# Before (legacy): Impossible to review
-"nodes": [{"id":"abc",...500 more lines...}]
+"nodes": [{"id":"abc",...slightly different 500 lines...}]

# After (new format): Clear, reviewable changes
diff --git a/components/Header/nodes.json b/components/Header/nodes.json
--- a/components/Header/nodes.json
+++ b/components/Header/nodes.json
@@ -45,6 +45,15 @@
+    {
+      "id": "bell-icon",
+      "type": "Icon",
+      "label": "Notification Bell",
+      "parent": "user-group",
+      "properties": {
+        "icon": "bell",
+        "size": 20
+      }
+    },
```

---

## Edge Cases & Challenges

### Circular References

Components can reference each other:

```
ComponentA uses ComponentB
ComponentB uses ComponentA
```

**Solution:** Dependencies are stored as paths, resolved at runtime.

### Large Components

Some components might have 1000+ nodes.

**Solution:**

- nodes.json can be split: nodes-visual.json, nodes-logic.json
- Or paginated loading for canvas display

### External References

Components reference models, styles, assets.

**Solution:**

- All references stored as paths
- Validation on load to check references exist
- Warning system for broken references

### Concurrent Editing

Multiple users editing same component.

**Solution:**

- File-level locking for now
- Future: Operational transform or CRDT for real-time collab

### Backward Compatibility

Users with old Nodegx versions.

**Solution:**

- Export to legacy format option
- Clear version requirements in project file
- Warning when opening in old version

---

## Performance Benchmarks

### Expected Improvements

| Operation       | Legacy      | New Format     | Improvement |
| --------------- | ----------- | -------------- | ----------- |
| Project Open    | 3.2s        | 0.4s           | 8x faster   |
| Component Load  | 3.2s (full) | 0.05s (single) | 64x faster  |
| Save Component  | 1.5s (full) | 0.03s (single) | 50x faster  |
| Memory Usage    | 150MB       | 20MB           | 7.5x less   |
| Git Clone       | 45s         | 8s             | 5.6x faster |
| AI Context Load | 200K tokens | 5K tokens      | 40x smaller |

### Benchmark Test Plan

```typescript
// benchmark.ts

async function runBenchmarks() {
  const projects = [
    'small-project', // 10 components
    'medium-project', // 50 components
    'large-project', // 200 components
    'massive-project' // 500 components
  ];

  for (const project of projects) {
    console.log(`\nBenchmarking: ${project}`);

    // Project open time
    const openStart = performance.now();
    await projectModel.loadProject(project);
    console.log(`  Open: ${performance.now() - openStart}ms`);

    // Component load time
    const loadStart = performance.now();
    await projectModel.getComponent('Header');
    console.log(`  Load component: ${performance.now() - loadStart}ms`);

    // Save time
    const saveStart = performance.now();
    await projectModel.saveComponent('Header', modifiedComponent);
    console.log(`  Save component: ${performance.now() - saveStart}ms`);

    // Memory usage
    console.log(`  Memory: ${process.memoryUsage().heapUsed / 1024 / 1024}MB`);
  }
}
```

---

## Success Criteria

### Must Have

- [ ] Export produces valid new format
- [ ] Import recreates identical project
- [ ] Round-trip preserves all data
- [ ] Editor works with both formats
- [ ] Migration wizard functional
- [ ] No data loss in migration

### Should Have

- [ ] 10x faster component operations
- [ ] 5x smaller memory footprint
- [ ] Meaningful git diffs
- [ ] AI can read single components

### Nice to Have

- [ ] Partial project loading
- [ ] Component-level undo history
- [ ] File watching for external changes

---

## Risks & Mitigations

| Risk                       | Severity | Mitigation                                   |
| -------------------------- | -------- | -------------------------------------------- |
| Data loss in migration     | CRITICAL | Multiple backup points, validation, rollback |
| Performance regression     | HIGH     | Extensive benchmarking, lazy loading         |
| Breaking existing projects | HIGH     | Format detection, dual support period        |
| Complex edge cases missed  | MEDIUM   | Comprehensive test suite, beta testing       |
| User confusion             | MEDIUM   | Clear docs, migration wizard, messaging      |

---

## Dependencies

### Blocks

- **AI Frontend Assistant** - Can't target components without this
- **AI Backend Creator** - Less critical but benefits from pattern
- **Collaborative Editing** - Much easier with file-per-component

### Blocked By

- None - can start immediately

---

## Summary

The project structure modernization is **the critical enabler** for AI assistance in Nodegx. Without it:

- AI can't efficiently read components (token budget explosion)
- AI can't safely write components (blast radius too large)
- AI can't navigate projects (no manifest to read)
- Git collaboration remains painful
- Performance remains suboptimal

With it:

- AI reads single components in milliseconds
- AI modifies components surgically
- Git shows meaningful diffs
- Projects load 10x faster
- Memory usage drops 7x
- The entire AI vision becomes possible

**This is Phase 9A because nothing else in Phase 9 works without it.**

---

## Next Steps

1. **Approve this design** - Get buy-in on file structure
2. **Create JSON schemas** - Formal spec for new format
3. **Build export POC** - Prove round-trip works
4. **Plan editor integration** - Minimal changes needed
5. **Start STRUCT-001** - Begin implementation

_"Before you can teach the AI to edit components, you need components the AI can edit."_
