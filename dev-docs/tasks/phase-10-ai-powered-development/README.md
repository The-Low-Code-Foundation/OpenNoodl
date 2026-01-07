# PHASE 10: AI-Powered Development Platform

## Complete Task Documentation

**Status:** BLUE SKY → CONCRETE TASKS  
**Total Duration:** 24-32 weeks  
**Total Effort:** 400-550 hours  
**Dependencies:** Phase 6 (UBA) recommended but not blocking for 10A

---

## Phase Overview

| Phase   | Name                            | Duration   | Tasks    | Effort        |
| ------- | ------------------------------- | ---------- | -------- | ------------- |
| **10A** | Project Structure Modernization | 6-8 weeks  | 9 tasks  | 80-110 hours  |
| **10B** | Frontend AI Assistant           | 6-8 weeks  | 8 tasks  | 100-130 hours |
| **10C** | Backend Creation AI             | 8-10 weeks | 10 tasks | 140-180 hours |

     9A: Project Structure ──────────────────────────────┐
           │                                              │
           ├──────────────────┐                           │
           ↓                  ↓                           ↓
     9B: Frontend AI    9F: Migration System        9E: DEPLOY Updates
           │                  │                           │
           └─────────┬────────┘                           │
                     ↓                                    │
              9C: Backend AI                              │
                     │                                    │
                     └─────────────────┬──────────────────┘
                                       ↓
                              9D: Unified Experience

```

---

# PHASE 10A: PROJECT STRUCTURE MODERNIZATION
| **10D** | Unified AI Experience           | 4-6 weeks  | 6 tasks  | 60-80 hours   |
| **10E** | DEPLOY System Updates           | 1-2 weeks  | 4 tasks  | 20-30 hours   |
| **10F** | Legacy Migration System         | 2-3 weeks  | 5 tasks  | 40-50 hours   |

```

PHASE 10 DEPENDENCY GRAPH

     10A: Project Structure ─────────────────────────────┐
           │                                              │
           ├──────────────────┐                           │
           ↓                  ↓                           ↓
     10B: Frontend AI   10F: Migration System       10E: DEPLOY Updates
           │                  │                           │
           └─────────┬────────┘                           │
                     ↓                                    │
              10C: Backend AI                             │
                     │                                    │
                     └─────────────────┬──────────────────┘
                                       ↓
                              10D: Unified Experience

```

---

# PHASE 10A: PROJECT STRUCTURE MODERNIZATION
========================

     9A: Project Structure ──────────────────────────────┐
           │                                              │
           ├──────────────────┐                           │
           ↓                  ↓                           ↓
     9B: Frontend AI    9F: Migration System        9E: DEPLOY Updates
           │                  │                           │
           └─────────┬────────┘                           │
                     ↓                                    │
              9C: Backend AI                              │
                     │                                    │
                     └─────────────────┬──────────────────┘
                                       ↓
                              9D: Unified Experience
```

---

# PHASE 10A: PROJECT STRUCTURE MODERNIZATION

## Overview

Transform the monolithic `project.json` into a React-style component file structure to enable AI assistance, improve Git collaboration, and enhance performance.

**Duration:** 6-8 weeks  
**Total Effort:** 80-110 hours  
**Priority:** CRITICAL - Blocks all AI features  
**Depends on:** Phase 6 (UBA) recommended but not blocking

### The Problem

```
Current: Single project.json with 50,000+ lines
         - Can't fit in AI context window
         - 200,000 tokens to read entire project
         - Any edit risks corrupting unrelated components
         - Git diffs are meaningless

Target:  Component-based file structure
         - 3,000 tokens to read one component
         - Surgical AI modifications
         - Meaningful Git diffs
         - 10x faster operations
```

### Target Structure

```
project/
├── nodegx.project.json           # Project metadata (~100 lines)
├── nodegx.routes.json            # Route definitions
├── nodegx.styles.json            # Global styles
├── components/
│   ├── _registry.json            # Component index
│   ├── App/
│   │   ├── component.json        # Metadata, ports
│   │   ├── nodes.json            # Node graph
│   │   └── connections.json      # Wiring
│   ├── pages/
│   │   ├── HomePage/
│   │   └── ProfilePage/
│   └── shared/
│       ├── Button/
│       └── Avatar/
└── models/
    ├── _registry.json
    └── User.json
```

---

## STRUCT-001: JSON Schema Definition

**Effort:** 12-16 hours (3 days)  
**Priority:** Critical  
**Blocks:** All other STRUCT tasks

### Description

Define formal JSON schemas for all new file formats. These schemas enable validation, IDE support, and serve as documentation.

### Deliverables

```
schemas/
├── project-v2.schema.json        # Root project file
├── component.schema.json         # Component metadata
├── nodes.schema.json             # Node definitions
├── connections.schema.json       # Connection definitions
├── registry.schema.json          # Component registry
├── routes.schema.json            # Route definitions
├── styles.schema.json            # Global styles
└── model.schema.json             # Model definitions
```

### Schema: component.json

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://nodegx.dev/schemas/component-v2.json",
  "title": "Nodegx Component",
  "type": "object",
  "required": ["id", "name", "type"],
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^comp_[a-z0-9_]+$",
      "description": "Unique component identifier"
    },
    "name": {
      "type": "string",
      "description": "Component name (folder name)"
    },
    "displayName": {
      "type": "string",
      "description": "Human-readable display name"
    },
    "path": {
      "type": "string",
      "description": "Original Noodl path for backward compatibility"
    },
    "type": {
      "type": "string",
      "enum": ["root", "page", "visual", "logic", "cloud"],
      "description": "Component type"
    },
    "description": {
      "type": "string"
    },
    "category": {
      "type": "string"
    },
    "tags": {
      "type": "array",
      "items": { "type": "string" }
    },
    "ports": {
      "type": "object",
      "properties": {
        "inputs": {
          "type": "array",
          "items": { "$ref": "#/definitions/port" }
        },
        "outputs": {
          "type": "array",
          "items": { "$ref": "#/definitions/port" }
        }
      }
    },
    "dependencies": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Paths to components this component uses"
    },
    "created": {
      "type": "string",
      "format": "date-time"
    },
    "modified": {
      "type": "string",
      "format": "date-time"
    }
  },
  "definitions": {
    "port": {
      "type": "object",
      "required": ["name", "type"],
      "properties": {
        "name": { "type": "string" },
        "type": { "type": "string" },
        "displayName": { "type": "string" },
        "description": { "type": "string" },
        "default": {},
        "required": { "type": "boolean" }
      }
    }
  }
}
```

### Schema: nodes.json

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://nodegx.dev/schemas/nodes-v2.json",
  "title": "Nodegx Component Nodes",
  "type": "object",
  "required": ["componentId", "nodes"],
  "properties": {
    "componentId": {
      "type": "string",
      "description": "Reference to parent component"
    },
    "version": {
      "type": "integer",
      "description": "Schema version for migrations"
    },
    "nodes": {
      "type": "array",
      "items": { "$ref": "#/definitions/node" }
    }
  },
  "definitions": {
    "node": {
      "type": "object",
      "required": ["id", "type"],
      "properties": {
        "id": { "type": "string" },
        "type": { "type": "string" },
        "label": { "type": "string" },
        "position": {
          "type": "object",
          "properties": {
            "x": { "type": "number" },
            "y": { "type": "number" }
          }
        },
        "parent": { "type": "string" },
        "children": {
          "type": "array",
          "items": { "type": "string" }
        },
        "properties": { "type": "object" },
        "ports": { "type": "array" },
        "dynamicports": { "type": "array" },
        "states": { "type": "object" },
        "metadata": { "type": "object" }
      }
    }
  }
}
```

### Schema: connections.json

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://nodegx.dev/schemas/connections-v2.json",
  "title": "Nodegx Component Connections",
  "type": "object",
  "required": ["componentId", "connections"],
  "properties": {
    "componentId": { "type": "string" },
    "version": { "type": "integer" },
    "connections": {
      "type": "array",
      "items": { "$ref": "#/definitions/connection" }
    }
  },
  "definitions": {
    "connection": {
      "type": "object",
      "required": ["id", "from", "to"],
      "properties": {
        "id": { "type": "string" },
        "from": {
          "type": "object",
          "required": ["node", "port"],
          "properties": {
            "node": { "type": "string" },
            "port": { "type": "string" }
          }
        },
        "to": {
          "type": "object",
          "required": ["node", "port"],
          "properties": {
            "node": { "type": "string" },
            "port": { "type": "string" }
          }
        }
      }
    }
  }
}
```

### Implementation Steps

1. Study existing project.json structure exhaustively
2. Map all node types and their serialization
3. Design schemas with backward compatibility
4. Create JSON Schema files
5. Build validation utilities using Ajv
6. Test against 10+ real projects

### Acceptance Criteria

- [ ] All 8 schema files defined
- [ ] Schemas published to `/schemas` endpoint
- [ ] Validation utility created and tested
- [ ] IDE autocomplete works with schemas
- [ ] 100% coverage of existing node types
- [ ] Edge cases documented

### Files to Create

```
packages/noodl-editor/src/schemas/
├── index.ts                      # Schema exports
├── project-v2.schema.json
├── component.schema.json
├── nodes.schema.json
├── connections.schema.json
├── registry.schema.json
├── routes.schema.json
├── styles.schema.json
├── model.schema.json
└── validator.ts                  # Ajv validation wrapper
```

---

## STRUCT-002: Export Engine Core

**Effort:** 16-20 hours (4 days)  
**Priority:** Critical  
**Depends on:** STRUCT-001  
**Blocks:** STRUCT-003, STRUCT-006

### Description

Build the engine that converts legacy `project.json` to the new multi-file format.

### Core Class

```typescript
// packages/noodl-editor/src/editor/src/services/ProjectStructure/Exporter.ts

import * as path from 'path';
import { validateSchema } from '@nodegx/schemas';
import * as fs from 'fs-extra';

import { LegacyProject, LegacyComponent } from './types/legacy';
import { ModernProject, ComponentFiles } from './types/modern';

export interface ExportOptions {
  outputDir: string;
  preserveOriginalPaths: boolean;
  validateOutput: boolean;
  onProgress?: (percent: number, message: string) => void;
}

export interface ExportResult {
  success: boolean;
  componentsExported: number;
  modelsExported: number;
  warnings: string[];
  errors: string[];
  outputPath: string;
}

export class ProjectExporter {
  private options: ExportOptions;

  constructor(options: ExportOptions) {
    this.options = options;
  }

  async export(project: LegacyProject): Promise<ExportResult> {
    const result: ExportResult = {
      success: false,
      componentsExported: 0,
      modelsExported: 0,
      warnings: [],
      errors: [],
      outputPath: this.options.outputDir
    };

    try {
      this.report(0, 'Starting export...');

      // 1. Create output directory structure
      await this.createDirectoryStructure();
      this.report(5, 'Directory structure created');

      // 2. Export project metadata
      await this.exportProjectMetadata(project);
      this.report(10, 'Project metadata exported');

      // 3. Export components
      const componentCount = Object.keys(project.components || {}).length;
      let processed = 0;

      const registry: ComponentRegistry = {
        version: 1,
        lastUpdated: new Date().toISOString(),
        components: {},
        stats: { totalComponents: 0, totalNodes: 0, totalConnections: 0 }
      };

      for (const [legacyPath, component] of Object.entries(project.components || {})) {
        try {
          const componentResult = await this.exportComponent(legacyPath, component);
          registry.components[componentResult.name] = componentResult.registryEntry;
          registry.stats.totalComponents++;
          registry.stats.totalNodes += componentResult.nodeCount;
          registry.stats.totalConnections += componentResult.connectionCount;
          result.componentsExported++;
        } catch (error) {
          result.warnings.push(`Failed to export component ${legacyPath}: ${error.message}`);
        }

        processed++;
        this.report(10 + (processed / componentCount) * 70, `Exported ${processed}/${componentCount} components`);
      }

      // 4. Write registry
      await this.writeRegistry(registry);
      this.report(85, 'Registry written');

      // 5. Export models
      await this.exportModels(project);
      this.report(90, 'Models exported');

      // 6. Export styles
      await this.exportStyles(project);
      this.report(95, 'Styles exported');

      // 7. Validate if requested
      if (this.options.validateOutput) {
        const validation = await this.validateExport();
        result.warnings.push(...validation.warnings);
        if (validation.errors.length > 0) {
          result.errors.push(...validation.errors);
          result.success = false;
          return result;
        }
      }

      this.report(100, 'Export complete');
      result.success = true;
    } catch (error) {
      result.errors.push(`Export failed: ${error.message}`);
      result.success = false;
    }

    return result;
  }

  private async exportComponent(legacyPath: string, component: LegacyComponent): Promise<ComponentExportResult> {
    // Convert path: "/#__cloud__/SendGrid/Send Email" → "cloud/SendGrid/SendEmail"
    const folderPath = this.normalizePath(legacyPath);
    const outputDir = path.join(this.options.outputDir, 'components', folderPath);

    await fs.mkdir(outputDir, { recursive: true });

    // Extract and write component.json
    const componentMeta = this.extractComponentMeta(legacyPath, component);
    await this.atomicWrite(path.join(outputDir, 'component.json'), JSON.stringify(componentMeta, null, 2));

    // Extract and write nodes.json
    const nodes = this.extractNodes(component);
    await this.atomicWrite(path.join(outputDir, 'nodes.json'), JSON.stringify(nodes, null, 2));

    // Extract and write connections.json
    const connections = this.extractConnections(component);
    await this.atomicWrite(path.join(outputDir, 'connections.json'), JSON.stringify(connections, null, 2));

    // Write variants if exist
    if (component.variants && Object.keys(component.variants).length > 0) {
      await this.atomicWrite(path.join(outputDir, 'variants.json'), JSON.stringify(component.variants, null, 2));
    }

    return {
      name: this.getComponentName(legacyPath),
      path: folderPath,
      nodeCount: nodes.nodes.length,
      connectionCount: connections.connections.length,
      registryEntry: {
        path: folderPath,
        type: this.inferComponentType(legacyPath, component),
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        nodeCount: nodes.nodes.length,
        connectionCount: connections.connections.length
      }
    };
  }

  private extractComponentMeta(legacyPath: string, component: LegacyComponent): ComponentMeta {
    return {
      id: component.id || this.generateId(),
      name: this.getComponentName(legacyPath),
      displayName: component.name || this.getDisplayName(legacyPath),
      path: legacyPath, // PRESERVE original path for cross-component references!
      type: this.inferComponentType(legacyPath, component),
      ports: {
        inputs: this.extractPorts(component, 'input'),
        outputs: this.extractPorts(component, 'output')
      },
      dependencies: this.extractDependencies(component),
      created: new Date().toISOString(),
      modified: new Date().toISOString()
    };
  }

  private extractNodes(component: LegacyComponent): NodesFile {
    const nodes = (component.graph?.roots || []).map((node) => ({
      id: node.id,
      type: node.type, // Keep EXACTLY as-is for component references
      label: node.label,
      position: { x: node.x, y: node.y },
      parent: node.parent,
      children: node.children || [],
      properties: node.parameters || {},
      ports: node.ports || [],
      dynamicports: node.dynamicports || [],
      states: node.states,
      metadata: node.metadata
    }));

    return {
      componentId: component.id,
      version: 1,
      nodes
    };
  }

  private extractConnections(component: LegacyComponent): ConnectionsFile {
    const connections = (component.graph?.connections || []).map((conn, index) => ({
      id: conn.id || `conn_${index}`,
      from: {
        node: conn.fromId,
        port: conn.fromProperty
      },
      to: {
        node: conn.toId,
        port: conn.toProperty
      }
    }));

    return {
      componentId: component.id,
      version: 1,
      connections
    };
  }

  private normalizePath(legacyPath: string): string {
    // "/#__cloud__/SendGrid/Send Email" → "cloud/SendGrid/SendEmail"
    return legacyPath
      .replace(/^\/#?/, '') // Remove leading /# or /
      .replace(/__cloud__/g, 'cloud') // Normalize cloud prefix
      .replace(/\s+/g, '') // Remove spaces
      .replace(/[^a-zA-Z0-9/]/g, '_'); // Replace special chars
  }

  private async atomicWrite(filePath: string, content: string): Promise<void> {
    const tempPath = `${filePath}.tmp`;
    const backupPath = `${filePath}.backup`;

    try {
      await fs.writeFile(tempPath, content);

      // Verify write
      const verify = await fs.readFile(tempPath, 'utf-8');
      if (verify !== content) {
        throw new Error('Write verification failed');
      }

      // Backup existing
      if (await fs.pathExists(filePath)) {
        await fs.rename(filePath, backupPath);
      }

      // Atomic rename
      await fs.rename(tempPath, filePath);

      // Remove backup on success
      if (await fs.pathExists(backupPath)) {
        await fs.unlink(backupPath);
      }
    } catch (error) {
      // Restore from backup
      if (await fs.pathExists(backupPath)) {
        await fs.rename(backupPath, filePath);
      }
      throw error;
    }
  }

  private report(percent: number, message: string): void {
    this.options.onProgress?.(percent, message);
  }
}
```

### Implementation Steps

1. Create type definitions for legacy and modern formats
2. Implement core Exporter class
3. Implement path normalization (handle special chars)
4. Implement atomic file writes
5. Implement metadata extraction
6. Implement node extraction (preserve all fields)
7. Implement connection extraction
8. Implement registry generation
9. Add progress reporting
10. Test with 10+ real projects

### Acceptance Criteria

- [ ] Exports all component types correctly
- [ ] Preserves all node properties and metadata
- [ ] Preserves all connections
- [ ] Handles special characters in paths
- [ ] Handles deeply nested components
- [ ] Atomic writes prevent corruption
- [ ] Progress reporting works
- [ ] Performance: <30 seconds for 200 components

### Test Cases

```typescript
describe('ProjectExporter', () => {
  it('should export simple project', async () => {
    const result = await exporter.export(simpleProject);
    expect(result.success).toBe(true);
    expect(result.componentsExported).toBe(5);
  });

  it('should handle cloud components', async () => {
    const result = await exporter.export(cloudProject);
    expect(result.success).toBe(true);
    // Check cloud/ directory created
  });

  it('should preserve original paths for references', async () => {
    const result = await exporter.export(projectWithRefs);
    const componentMeta = await readJSON('components/Header/component.json');
    expect(componentMeta.path).toBe('/#Header'); // Original preserved
  });

  it('should handle special characters in names', async () => {
    const result = await exporter.export(projectWithSpecialChars);
    // Verify folders created without errors
  });

  it('should preserve AI metadata', async () => {
    const result = await exporter.export(projectWithAIHistory);
    const nodes = await readJSON('components/Function/nodes.json');
    expect(nodes.nodes[0].metadata.prompt.history).toBeDefined();
  });
});
```

---

## STRUCT-003: Import Engine Core

**Effort:** 16-20 hours (4 days)  
**Priority:** Critical  
**Depends on:** STRUCT-001, STRUCT-002  
**Blocks:** STRUCT-004

### Description

Build the engine that converts the new multi-file format back to legacy `project.json` for runtime compatibility.

### Core Class

```typescript
// packages/noodl-editor/src/editor/src/services/ProjectStructure/Importer.ts

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
      const legacyPath = await this.getLegacyPath(componentDir);
      components[legacyPath] = await this.importComponent(componentDir);
    }

    // 4. Import models
    const models = await this.importModels(projectDir);

    // 5. Import styles
    const styles = await this.importStyles(projectDir);

    // 6. Reconstruct full project
    return {
      name: projectMeta.name,
      version: projectMeta.version,
      components,
      variants: await this.importVariants(projectDir),
      styles,
      cloudservices: projectMeta.cloudservices,
      metadata: projectMeta.metadata
    };
  }

  async importComponent(componentDir: string): Promise<LegacyComponent> {
    const meta = await this.readJSON(path.join(componentDir, 'component.json'));
    const nodes = await this.readJSON(path.join(componentDir, 'nodes.json'));
    const connections = await this.readJSON(path.join(componentDir, 'connections.json'));

    // Reconstruct legacy format
    return {
      id: meta.id,
      name: meta.displayName,
      graph: {
        roots: nodes.nodes.map((node) => ({
          id: node.id,
          type: node.type,
          label: node.label,
          x: node.position?.x || 0,
          y: node.position?.y || 0,
          parameters: node.properties,
          ports: node.ports,
          dynamicports: node.dynamicports,
          children: node.children,
          metadata: node.metadata,
          states: node.states
        })),
        connections: connections.connections.map((conn) => ({
          fromId: conn.from.node,
          fromProperty: conn.from.port,
          toId: conn.to.node,
          toProperty: conn.to.port
        }))
      }
      // ... other legacy fields
    };
  }

  async importSingleComponent(componentPath: string): Promise<LegacyComponent> {
    // For incremental imports - load just one component
    return this.importComponent(componentPath);
  }
}
```

### Round-Trip Validation

```typescript
// packages/noodl-editor/src/editor/src/services/ProjectStructure/Validator.ts

export class RoundTripValidator {
  async validate(original: LegacyProject, imported: LegacyProject): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Component count
    const origCount = Object.keys(original.components || {}).length;
    const impCount = Object.keys(imported.components || {}).length;
    if (origCount !== impCount) {
      errors.push(`Component count mismatch: ${origCount} → ${impCount}`);
    }

    // 2. Deep compare each component
    for (const [path, origComp] of Object.entries(original.components || {})) {
      const impComp = imported.components[path];

      if (!impComp) {
        errors.push(`Missing component: ${path}`);
        continue;
      }

      // Node count
      const origNodes = origComp.graph?.roots?.length || 0;
      const impNodes = impComp.graph?.roots?.length || 0;
      if (origNodes !== impNodes) {
        errors.push(`Node count mismatch in ${path}: ${origNodes} → ${impNodes}`);
      }

      // Connection count
      const origConns = origComp.graph?.connections?.length || 0;
      const impConns = impComp.graph?.connections?.length || 0;
      if (origConns !== impConns) {
        errors.push(`Connection count mismatch in ${path}: ${origConns} → ${impConns}`);
      }

      // Deep compare nodes
      for (const origNode of origComp.graph?.roots || []) {
        const impNode = impComp.graph?.roots?.find((n) => n.id === origNode.id);
        if (!impNode) {
          errors.push(`Missing node ${origNode.id} in ${path}`);
          continue;
        }

        // Type must match exactly
        if (origNode.type !== impNode.type) {
          errors.push(`Node type mismatch: ${origNode.type} → ${impNode.type}`);
        }

        // Metadata must be preserved
        if (!deepEqual(origNode.metadata, impNode.metadata)) {
          warnings.push(`Metadata changed for node ${origNode.id} in ${path}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}
```

### Acceptance Criteria

- [ ] Imports all components correctly
- [ ] Reconstructs legacy format exactly
- [ ] Round-trip validation passes for all test projects
- [ ] Single component import works
- [ ] Performance: <5 seconds for 200 components
- [ ] Handles missing files gracefully

---

## STRUCT-004: Editor Format Detection

**Effort:** 6-8 hours (1.5 days)  
**Priority:** High  
**Depends on:** STRUCT-003

### Description

Add automatic detection of project format (legacy vs v2) when opening projects.

### Implementation

```typescript
// packages/noodl-editor/src/editor/src/services/ProjectStructure/FormatDetector.ts

export enum ProjectFormat {
  LEGACY = 'legacy',
  V2 = 'v2',
  UNKNOWN = 'unknown'
}

export interface FormatDetectionResult {
  format: ProjectFormat;
  confidence: 'high' | 'medium' | 'low';
  details: {
    hasProjectJson: boolean;
    hasNodgexProject: boolean;
    hasComponentsDir: boolean;
    hasRegistry: boolean;
  };
}

export class FormatDetector {
  async detect(projectPath: string): Promise<FormatDetectionResult> {
    const details = {
      hasProjectJson: await fs.pathExists(path.join(projectPath, 'project.json')),
      hasNodgexProject: await fs.pathExists(path.join(projectPath, 'nodegx.project.json')),
      hasComponentsDir: await fs.pathExists(path.join(projectPath, 'components')),
      hasRegistry: await fs.pathExists(path.join(projectPath, 'components', '_registry.json'))
    };

    // V2 format: has nodegx.project.json + components directory
    if (details.hasNodgexProject && details.hasComponentsDir && details.hasRegistry) {
      return { format: ProjectFormat.V2, confidence: 'high', details };
    }

    // Legacy format: has project.json only
    if (details.hasProjectJson && !details.hasNodgexProject) {
      return { format: ProjectFormat.LEGACY, confidence: 'high', details };
    }

    // Mixed or unknown
    if (details.hasProjectJson && details.hasNodgexProject) {
      // Both exist - prefer V2 but warn
      return { format: ProjectFormat.V2, confidence: 'medium', details };
    }

    return { format: ProjectFormat.UNKNOWN, confidence: 'low', details };
  }
}
```

### Integration with Project Loading

```typescript
// packages/noodl-editor/src/editor/src/models/projectmodel.ts

class ProjectModel {
  private format: ProjectFormat = ProjectFormat.LEGACY;
  private formatDetector = new FormatDetector();

  async loadProject(projectPath: string): Promise<void> {
    const detection = await this.formatDetector.detect(projectPath);
    this.format = detection.format;

    if (detection.confidence !== 'high') {
      console.warn(`Project format detection confidence: ${detection.confidence}`);
    }

    if (this.format === ProjectFormat.V2) {
      await this.loadV2Project(projectPath);
    } else if (this.format === ProjectFormat.LEGACY) {
      await this.loadLegacyProject(projectPath);
    } else {
      throw new Error('Unknown project format');
    }
  }

  private async loadV2Project(projectPath: string): Promise<void> {
    // Only load metadata and registry - components on demand
    this.metadata = await this.loadProjectMeta(projectPath);
    this.registry = await this.loadRegistry(projectPath);
    // Components loaded lazily via getComponent()
  }
}
```

### Acceptance Criteria

- [ ] Correctly identifies legacy format
- [ ] Correctly identifies V2 format
- [ ] Handles mixed/corrupted states
- [ ] Reports confidence level
- [ ] Integrates with project loading

---

## STRUCT-005: Lazy Component Loading

**Effort:** 12-16 hours (3 days)  
**Priority:** High  
**Depends on:** STRUCT-004

### Description

Implement on-demand component loading for V2 format projects to reduce memory usage and improve startup time.

### Implementation

```typescript
// packages/noodl-editor/src/editor/src/services/ProjectStructure/ComponentLoader.ts

export class ComponentLoader {
  private cache: Map<string, { component: Component; loadedAt: number }> = new Map();
  private maxCacheAge = 5 * 60 * 1000; // 5 minutes
  private maxCacheSize = 50; // components

  async loadComponent(projectPath: string, componentPath: string): Promise<Component> {
    const cacheKey = `${projectPath}:${componentPath}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.loadedAt < this.maxCacheAge) {
      return cached.component;
    }

    // Load from files
    const componentDir = path.join(projectPath, 'components', componentPath);

    const [meta, nodes, connections] = await Promise.all([
      this.readJSON(path.join(componentDir, 'component.json')),
      this.readJSON(path.join(componentDir, 'nodes.json')),
      this.readJSON(path.join(componentDir, 'connections.json'))
    ]);

    const component = this.reconstructComponent(meta, nodes, connections);

    // Update cache
    this.cache.set(cacheKey, { component, loadedAt: Date.now() });
    this.pruneCache();

    return component;
  }

  async preloadComponents(projectPath: string, componentPaths: string[]): Promise<void> {
    // Parallel loading for known needed components
    await Promise.all(componentPaths.map((p) => this.loadComponent(projectPath, p)));
  }

  invalidate(componentPath?: string): void {
    if (componentPath) {
      // Invalidate specific component
      for (const key of this.cache.keys()) {
        if (key.includes(componentPath)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Invalidate all
      this.cache.clear();
    }
  }

  private pruneCache(): void {
    if (this.cache.size > this.maxCacheSize) {
      // Remove oldest entries
      const entries = Array.from(this.cache.entries()).sort((a, b) => a[1].loadedAt - b[1].loadedAt);

      const toRemove = entries.slice(0, this.cache.size - this.maxCacheSize);
      toRemove.forEach(([key]) => this.cache.delete(key));
    }
  }
}
```

### Acceptance Criteria

- [ ] Components load on demand
- [ ] Cache improves repeated access
- [ ] Cache eviction works correctly
- [ ] Memory usage stays bounded
- [ ] Parallel preloading works
- [ ] Cache invalidation works

---

## STRUCT-006: Component-Level Save

**Effort:** 12-16 hours (3 days)  
**Priority:** High  
**Depends on:** STRUCT-002, STRUCT-005

### Description

Implement saving changes to individual component files instead of rewriting the entire project.

### Implementation

```typescript
// packages/noodl-editor/src/editor/src/services/ProjectStructure/ComponentSaver.ts

export class ComponentSaver {
  private pendingWrites: Map<string, { content: string; timestamp: number }> = new Map();
  private writeDebounce = 500; // ms

  async saveComponent(projectPath: string, componentPath: string, component: Component): Promise<void> {
    const componentDir = path.join(projectPath, 'components', componentPath);

    // Ensure directory exists
    await fs.mkdir(componentDir, { recursive: true });

    // Prepare files
    const meta = this.extractMeta(component);
    const nodes = this.extractNodes(component);
    const connections = this.extractConnections(component);

    // Atomic writes
    await Promise.all([
      this.atomicWrite(path.join(componentDir, 'component.json'), JSON.stringify(meta, null, 2)),
      this.atomicWrite(path.join(componentDir, 'nodes.json'), JSON.stringify(nodes, null, 2)),
      this.atomicWrite(path.join(componentDir, 'connections.json'), JSON.stringify(connections, null, 2))
    ]);

    // Update registry
    await this.updateRegistry(projectPath, componentPath, component);
  }

  async saveComponentDebounced(projectPath: string, componentPath: string, component: Component): Promise<void> {
    const key = `${projectPath}:${componentPath}`;

    this.pendingWrites.set(key, {
      content: JSON.stringify(component),
      timestamp: Date.now()
    });

    // Debounced write
    setTimeout(async () => {
      const pending = this.pendingWrites.get(key);
      if (pending && Date.now() - pending.timestamp >= this.writeDebounce) {
        this.pendingWrites.delete(key);
        await this.saveComponent(projectPath, componentPath, JSON.parse(pending.content));
      }
    }, this.writeDebounce);
  }

  private async updateRegistry(projectPath: string, componentPath: string, component: Component): Promise<void> {
    const registryPath = path.join(projectPath, 'components', '_registry.json');
    const registry = await this.readJSON(registryPath);

    registry.components[componentPath] = {
      ...registry.components[componentPath],
      modified: new Date().toISOString(),
      nodeCount: component.graph?.roots?.length || 0,
      connectionCount: component.graph?.connections?.length || 0
    };

    registry.lastUpdated = new Date().toISOString();

    await this.atomicWrite(registryPath, JSON.stringify(registry, null, 2));
  }
}
```

### Acceptance Criteria

- [ ] Single component saves work
- [ ] Atomic writes prevent corruption
- [ ] Registry updates correctly
- [ ] Debouncing prevents excessive writes
- [ ] Auto-save integration works
- [ ] Performance: <100ms per component

---

## STRUCT-007: Migration Wizard UI

**Effort:** 10-14 hours (2.5 days)  
**Priority:** Medium  
**Depends on:** STRUCT-002, STRUCT-003

### Description

Create a user-friendly wizard for migrating projects from legacy to V2 format.

### UI Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Project Structure Migration                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Your project uses the legacy single-file format. Migrating to the new      │
│  format enables powerful features:                                          │
│                                                                             │
│  ✓ AI-powered editing assistance                                           │
│  ✓ Better Git collaboration (meaningful diffs)                             │
│  ✓ 10x faster project loading                                              │
│  ✓ Component-level version history                                         │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Project Analysis                                                    │   │
│  │                                                                     │   │
│  │ Project: My Conference App                                          │   │
│  │ Components: 54                                                       │   │
│  │ Total Nodes: 3,420                                                  │   │
│  │ Current Size: 2.4 MB                                                │   │
│  │                                                                     │   │
│  │ Estimated time: ~30 seconds                                          │   │
│  │ New size: ~2.6 MB (54 files)                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ⚠️  Pre-flight Checks                                                │   │
│  │                                                                     │   │
│  │ ✓ All 54 components can be parsed                                   │   │
│  │ ✓ No circular reference issues detected                              │   │
│  │ ✓ All node types supported                                          │   │
│  │ ⚠ 2 components have very long paths (may be truncated)              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ☑ Create backup before migration (recommended)                            │
│  ☐ Delete legacy project.json after successful migration                   │
│                                                                             │
│                                                                             │
│                              [Cancel]  [Start Migration]                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Progress View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Migration in Progress                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ████████████████████████████████░░░░░░░░░░░░░░░░░░ 65%                     │
│                                                                             │
│  Current step: Exporting components/pages/SchedulePage...                   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Progress Log                                                    [▼] │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ ✓ Created backup: project_backup_20260107_143022.json               │   │
│  │ ✓ Created directory structure                                       │   │
│  │ ✓ Exported project metadata                                         │   │
│  │ ✓ Exported 32/54 components                                         │   │
│  │ → Exporting components/pages/SchedulePage...                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│                                  [Cancel Migration]                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Implementation

```typescript
// packages/noodl-editor/src/editor/src/views/MigrationWizard/MigrationWizard.tsx

interface MigrationWizardProps {
  projectPath: string;
  onComplete: (success: boolean) => void;
  onCancel: () => void;
}

export function MigrationWizard({ projectPath, onComplete, onCancel }: MigrationWizardProps) {
  const [step, setStep] = useState<'analysis' | 'progress' | 'complete' | 'error'>('analysis');
  const [analysis, setAnalysis] = useState<ProjectAnalysis | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [createBackup, setCreateBackup] = useState(true);
  const [deleteLegacy, setDeleteLegacy] = useState(false);

  useEffect(() => {
    // Run analysis on mount
    analyzeProject(projectPath).then(setAnalysis);
  }, [projectPath]);

  const startMigration = async () => {
    setStep('progress');

    try {
      if (createBackup) {
        setProgressMessage('Creating backup...');
        await createProjectBackup(projectPath);
      }

      const exporter = new ProjectExporter({
        outputDir: projectPath,
        preserveOriginalPaths: true,
        validateOutput: true,
        onProgress: (percent, message) => {
          setProgress(percent);
          setProgressMessage(message);
        }
      });

      const result = await exporter.export(await loadLegacyProject(projectPath));

      if (result.success) {
        if (deleteLegacy) {
          await fs.unlink(path.join(projectPath, 'project.json'));
        }
        setStep('complete');
        onComplete(true);
      } else {
        setError(result.errors.join('\n'));
        setStep('error');
      }
    } catch (err) {
      setError(err.message);
      setStep('error');
    }
  };

  // ... render logic
}
```

### Acceptance Criteria

- [ ] Analysis shows project statistics
- [ ] Pre-flight checks identify issues
- [ ] Progress indicator is accurate
- [ ] Backup creation works
- [ ] Cancel mid-migration works (with rollback)
- [ ] Error handling shows clear messages
- [ ] Success message with next steps

---

## STRUCT-008: Testing & Validation

**Effort:** 16-20 hours (4 days)  
**Priority:** High  
**Depends on:** All other STRUCT tasks

### Description

Comprehensive testing of the entire structure system with real projects.

### Test Suite

```typescript
// packages/noodl-editor/tests/structure/

describe('Project Structure Migration', () => {
  describe('Schema Validation', () => {
    it('should validate component.json schema');
    it('should validate nodes.json schema');
    it('should validate connections.json schema');
    it('should reject invalid schemas with clear errors');
  });

  describe('Export Engine', () => {
    it('should export minimal project');
    it('should export complex project with 200+ components');
    it('should handle cloud components');
    it('should handle special characters in paths');
    it('should preserve all AI metadata');
    it('should preserve dynamic ports');
    it('should preserve component references');
    it('should generate valid registry');
  });

  describe('Import Engine', () => {
    it('should import exported project');
    it('should reconstruct exact legacy format');
    it('should pass round-trip validation');
    it('should import single component');
  });

  describe('Round-Trip Validation', () => {
    testProjects.forEach((project) => {
      it(`should pass round-trip for ${project.name}`, async () => {
        const original = await loadProject(project.path);
        const exported = await exportProject(original);
        const imported = await importProject(exported);

        const validation = await validateRoundTrip(original, imported);
        expect(validation.valid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      });
    });
  });

  describe('Performance', () => {
    it('should export 200 components in <30 seconds');
    it('should import 200 components in <5 seconds');
    it('should load single component in <100ms');
    it('should save single component in <100ms');
  });

  describe('Edge Cases', () => {
    it('should handle empty project');
    it('should handle project with no connections');
    it('should handle circular component references');
    it('should handle very deep nesting');
    it('should handle components with 1000+ nodes');
    it('should handle unicode in component names');
  });
});
```

### Real Project Test Set

Collect 10+ real Noodl projects for testing:

- Small project (5-10 components)
- Medium project (50-100 components)
- Large project (200+ components)
- Project with cloud functions
- Project with AI-generated code
- Project with complex nesting
- Project with special characters
- Project from old Noodl version

### Acceptance Criteria

- [ ] 100% pass rate on unit tests
- [ ] 100% pass rate on integration tests
- [ ] All real projects pass round-trip
- [ ] Performance benchmarks pass
- [ ] Edge cases handled

---

## STRUCT-009: Documentation

**Effort:** 6-8 hours (1.5 days)  
**Priority:** Medium  
**Depends on:** All other STRUCT tasks

### Documentation Files

```
docs/
├── structure/
│   ├── overview.md                # Why we did this
│   ├── file-formats.md            # Detailed format specs
│   ├── migration-guide.md         # How to migrate
│   ├── troubleshooting.md         # Common issues
│   └── api-reference.md           # For developers
└── schemas/
    └── README.md                  # Schema documentation
```

### Acceptance Criteria

- [ ] Overview explains benefits
- [ ] File formats fully documented
- [ ] Migration guide is step-by-step
- [ ] Troubleshooting covers common issues
- [ ] API reference for developers

---

# PHASE 10B: FRONTEND AI ASSISTANT

## Overview

Build an AI assistant that can understand, navigate, and modify Nodegx frontend components using natural language.

**Duration:** 6-8 weeks  
**Total Effort:** 100-130 hours  
**Priority:** HIGH  
**Depends on:** PHASE 10A complete

### Vision

```
User: "Add a loading spinner to the UserProfile component while fetching data"

AI: [Reading components/UserProfile/...]

    I'll add a loading state with spinner:
    - Added condition node for loading state
    - Added Spinner component from shared library
    - Connected fetch.isPending → spinner.visible

    [Modified: components/UserProfile/nodes.json]
    [Modified: components/UserProfile/connections.json]

    Done! The component now shows a spinner during fetch.
```

---

## AI-001: Component Reading Tools

**Effort:** 12-16 hours (3 days)  
**Priority:** Critical

### Description

Create tools that allow AI to read and understand component structure.

### Tool Definitions

```typescript
// packages/noodl-editor/src/editor/src/services/AI/tools/ComponentTools.ts

export const componentTools = [
  {
    name: 'list_components',
    description: 'List all components in the project with summary info',
    parameters: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          description: 'Optional filter: "pages", "shared", "cloud", or path prefix'
        }
      }
    },
    execute: async ({ filter }) => {
      const registry = await loadRegistry();
      let components = Object.entries(registry.components);

      if (filter) {
        components = components.filter(([path]) => path.includes(filter) || path.startsWith(filter));
      }

      return components.map(([path, info]) => ({
        path,
        type: info.type,
        nodeCount: info.nodeCount,
        modified: info.modified
      }));
    }
  },

  {
    name: 'read_component',
    description: 'Read complete component definition including metadata, nodes, and connections',
    parameters: {
      type: 'object',
      properties: {
        componentPath: {
          type: 'string',
          description: 'Path to component, e.g., "pages/HomePage" or "shared/Button"'
        }
      },
      required: ['componentPath']
    },
    execute: async ({ componentPath }) => {
      const componentDir = path.join(projectPath, 'components', componentPath);

      const [meta, nodes, connections] = await Promise.all([
        readJSON(path.join(componentDir, 'component.json')),
        readJSON(path.join(componentDir, 'nodes.json')),
        readJSON(path.join(componentDir, 'connections.json'))
      ]);

      return { meta, nodes, connections };
    }
  },

  {
    name: 'get_component_dependencies',
    description: 'Get all components that this component depends on',
    parameters: {
      type: 'object',
      properties: {
        componentPath: { type: 'string' }
      },
      required: ['componentPath']
    },
    execute: async ({ componentPath }) => {
      const meta = await readComponentMeta(componentPath);
      return {
        direct: meta.dependencies,
        transitive: await getTransitiveDependencies(componentPath)
      };
    }
  },

  {
    name: 'find_components_using',
    description: 'Find all components that use a specific component or model',
    parameters: {
      type: 'object',
      properties: {
        targetPath: { type: 'string' },
        targetType: { type: 'string', enum: ['component', 'model'] }
      },
      required: ['targetPath']
    },
    execute: async ({ targetPath, targetType }) => {
      // Search through all component.json for dependencies
      const registry = await loadRegistry();
      const using: string[] = [];

      for (const [path] of Object.entries(registry.components)) {
        const meta = await readComponentMeta(path);
        if (meta.dependencies?.includes(targetPath)) {
          using.push(path);
        }
      }

      return using;
    }
  },

  {
    name: 'explain_component',
    description: 'Generate a natural language explanation of what a component does',
    parameters: {
      type: 'object',
      properties: {
        componentPath: { type: 'string' }
      },
      required: ['componentPath']
    },
    execute: async ({ componentPath }) => {
      const { meta, nodes, connections } = await readFullComponent(componentPath);

      // Analyze structure
      const analysis = {
        inputPorts: meta.ports?.inputs || [],
        outputPorts: meta.ports?.outputs || [],
        visualNodes: nodes.nodes.filter((n) => isVisualNode(n.type)),
        logicNodes: nodes.nodes.filter((n) => isLogicNode(n.type)),
        dataNodes: nodes.nodes.filter((n) => isDataNode(n.type)),
        componentRefs: nodes.nodes.filter((n) => n.type.startsWith('component:'))
      };

      return analysis;
    }
  }
];
```

### Acceptance Criteria

- [ ] All 5 reading tools implemented
- [ ] Tools return properly structured data
- [ ] Error handling for missing components
- [ ] Performance: each tool <500ms

---

## AI-002: Component Modification Tools

**Effort:** 16-20 hours (4 days)  
**Priority:** Critical

### Tool Definitions

```typescript
export const modificationTools = [
  {
    name: 'add_node',
    description: 'Add a new node to a component',
    parameters: {
      type: 'object',
      properties: {
        componentPath: { type: 'string' },
        node: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            label: { type: 'string' },
            parent: { type: 'string' },
            position: {
              type: 'object',
              properties: { x: { type: 'number' }, y: { type: 'number' } }
            },
            properties: { type: 'object' }
          },
          required: ['type']
        }
      },
      required: ['componentPath', 'node']
    },
    execute: async ({ componentPath, node }) => {
      const nodes = await readNodes(componentPath);

      const newNode = {
        id: generateNodeId(),
        ...node,
        position: node.position || calculatePosition(nodes, node.parent)
      };

      nodes.nodes.push(newNode);

      // Update parent's children if specified
      if (node.parent) {
        const parent = nodes.nodes.find((n) => n.id === node.parent);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(newNode.id);
        }
      }

      await saveNodes(componentPath, nodes);

      return { success: true, nodeId: newNode.id };
    }
  },

  {
    name: 'update_node_property',
    description: 'Update a property on an existing node',
    parameters: {
      type: 'object',
      properties: {
        componentPath: { type: 'string' },
        nodeId: { type: 'string' },
        property: { type: 'string' },
        value: {}
      },
      required: ['componentPath', 'nodeId', 'property', 'value']
    },
    execute: async ({ componentPath, nodeId, property, value }) => {
      const nodes = await readNodes(componentPath);
      const node = nodes.nodes.find((n) => n.id === nodeId);

      if (!node) {
        return { success: false, error: `Node ${nodeId} not found` };
      }

      node.properties = node.properties || {};
      node.properties[property] = value;

      await saveNodes(componentPath, nodes);

      return { success: true };
    }
  },

  {
    name: 'add_connection',
    description: 'Add a connection between two nodes',
    parameters: {
      type: 'object',
      properties: {
        componentPath: { type: 'string' },
        from: {
          type: 'object',
          properties: {
            node: { type: 'string' },
            port: { type: 'string' }
          },
          required: ['node', 'port']
        },
        to: {
          type: 'object',
          properties: {
            node: { type: 'string' },
            port: { type: 'string' }
          },
          required: ['node', 'port']
        }
      },
      required: ['componentPath', 'from', 'to']
    },
    execute: async ({ componentPath, from, to }) => {
      const connections = await readConnections(componentPath);

      const newConnection = {
        id: generateConnectionId(),
        from,
        to
      };

      connections.connections.push(newConnection);
      await saveConnections(componentPath, connections);

      return { success: true, connectionId: newConnection.id };
    }
  },

  {
    name: 'remove_node',
    description: 'Remove a node and its connections from a component',
    parameters: {
      type: 'object',
      properties: {
        componentPath: { type: 'string' },
        nodeId: { type: 'string' }
      },
      required: ['componentPath', 'nodeId']
    },
    execute: async ({ componentPath, nodeId }) => {
      // Remove node
      const nodes = await readNodes(componentPath);
      nodes.nodes = nodes.nodes.filter((n) => n.id !== nodeId);

      // Remove from parent's children
      nodes.nodes.forEach((n) => {
        if (n.children?.includes(nodeId)) {
          n.children = n.children.filter((c) => c !== nodeId);
        }
      });

      // Remove connections
      const connections = await readConnections(componentPath);
      connections.connections = connections.connections.filter((c) => c.from.node !== nodeId && c.to.node !== nodeId);

      await saveNodes(componentPath, nodes);
      await saveConnections(componentPath, connections);

      return { success: true };
    }
  },

  {
    name: 'create_component',
    description: 'Create a new component',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        path: { type: 'string', description: 'e.g., "shared" or "pages"' },
        type: { type: 'string', enum: ['visual', 'logic', 'page'] },
        inputs: { type: 'array' },
        outputs: { type: 'array' }
      },
      required: ['name']
    },
    execute: async ({ name, path: basePath, type, inputs, outputs }) => {
      const componentPath = path.join(basePath || 'shared', name);
      const componentDir = path.join(projectPath, 'components', componentPath);

      await fs.mkdir(componentDir, { recursive: true });

      // Create component.json
      await writeJSON(path.join(componentDir, 'component.json'), {
        id: generateComponentId(),
        name,
        type: type || 'visual',
        ports: { inputs: inputs || [], outputs: outputs || [] },
        dependencies: [],
        created: new Date().toISOString(),
        modified: new Date().toISOString()
      });

      // Create empty nodes.json
      await writeJSON(path.join(componentDir, 'nodes.json'), {
        componentId: generateComponentId(),
        version: 1,
        nodes: []
      });

      // Create empty connections.json
      await writeJSON(path.join(componentDir, 'connections.json'), {
        componentId: generateComponentId(),
        version: 1,
        connections: []
      });

      // Update registry
      await updateRegistry(componentPath);

      return { success: true, componentPath };
    }
  }
];
```

### Acceptance Criteria

- [ ] All modification tools implemented
- [ ] Changes persist correctly
- [ ] Undo support works
- [ ] Validation prevents invalid states
- [ ] Registry updates on changes

---

## AI-003: LangGraph Agent Setup

**Effort:** 16-20 hours (4 days)  
**Priority:** Critical

### Agent Architecture

```typescript
// packages/noodl-editor/src/editor/src/services/AI/FrontendAgent.ts

import { ChatAnthropic } from '@langchain/anthropic';
import { StateGraph, MemorySaver } from '@langchain/langgraph';

interface AgentState {
  messages: Message[];
  currentComponent: string | null;
  pendingChanges: Change[];
  context: ProjectContext;
}

export class FrontendAgent {
  private graph: StateGraph<AgentState>;
  private memory: MemorySaver;

  constructor() {
    this.memory = new MemorySaver();
    this.graph = this.buildGraph();
  }

  private buildGraph(): StateGraph<AgentState> {
    const graph = new StateGraph<AgentState>({
      channels: {
        messages: { default: () => [] },
        currentComponent: { default: () => null },
        pendingChanges: { default: () => [] },
        context: { default: () => ({}) }
      }
    });

    // Add nodes
    graph.addNode('understand', this.understandRequest);
    graph.addNode('gather_context', this.gatherContext);
    graph.addNode('plan_changes', this.planChanges);
    graph.addNode('execute_changes', this.executeChanges);
    graph.addNode('respond', this.generateResponse);

    // Add edges
    graph.addEdge('__start__', 'understand');
    graph.addConditionalEdges('understand', this.routeAfterUnderstand, {
      needs_context: 'gather_context',
      ready_to_plan: 'plan_changes',
      clarify: 'respond'
    });
    graph.addEdge('gather_context', 'plan_changes');
    graph.addEdge('plan_changes', 'execute_changes');
    graph.addEdge('execute_changes', 'respond');
    graph.addEdge('respond', '__end__');

    return graph.compile({ checkpointer: this.memory });
  }

  private understandRequest = async (state: AgentState) => {
    const llm = new ChatAnthropic({ model: 'claude-sonnet-4-20250514' });

    const response = await llm.invoke([{ role: 'system', content: UNDERSTAND_PROMPT }, ...state.messages]);

    return {
      ...state,
      understanding: response.content
    };
  };

  private gatherContext = async (state: AgentState) => {
    // Use reading tools to gather needed context
    const tools = componentTools;

    // Determine what context is needed
    const neededComponents = extractComponentReferences(state.understanding);

    const context = {};
    for (const comp of neededComponents) {
      context[comp] = await tools.find((t) => t.name === 'read_component').execute({ componentPath: comp });
    }

    return {
      ...state,
      context
    };
  };

  private planChanges = async (state: AgentState) => {
    const llm = new ChatAnthropic({ model: 'claude-sonnet-4-20250514' });

    const response = await llm.invoke([
      { role: 'system', content: PLANNING_PROMPT },
      { role: 'user', content: JSON.stringify(state.context) },
      ...state.messages
    ]);

    // Parse planned changes
    const changes = parseChangePlan(response.content);

    return {
      ...state,
      pendingChanges: changes
    };
  };

  private executeChanges = async (state: AgentState) => {
    const results = [];

    for (const change of state.pendingChanges) {
      const tool = modificationTools.find((t) => t.name === change.tool);
      if (tool) {
        const result = await tool.execute(change.params);
        results.push({ change, result });
      }
    }

    return {
      ...state,
      executionResults: results
    };
  };

  async process(message: string, threadId: string): Promise<AgentResponse> {
    const config = { configurable: { thread_id: threadId } };

    const result = await this.graph.invoke(
      {
        messages: [{ role: 'user', content: message }]
      },
      config
    );

    return {
      response: result.messages[result.messages.length - 1].content,
      changes: result.pendingChanges,
      success: result.executionResults?.every((r) => r.result.success)
    };
  }
}
```

### Acceptance Criteria

- [ ] Agent processes natural language requests
- [ ] Context gathering is efficient
- [ ] Change planning is accurate
- [ ] Execution handles errors gracefully
- [ ] Conversation memory persists

---

## AI-004: Conversation Memory & Caching

**Effort:** 12-16 hours (3 days)  
**Priority:** High

### Implementation

```typescript
// packages/noodl-editor/src/editor/src/services/AI/ConversationMemory.ts

export class ConversationMemory {
  private messages: Message[] = [];
  private projectContextCache: Map<string, { data: any; timestamp: number }> = new Map();
  private maxContextTokens = 100000;
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  addUserMessage(content: string): void {
    this.messages.push({ role: 'user', content, timestamp: Date.now() });
    this.pruneIfNeeded();
  }

  addAssistantMessage(content: string): void {
    this.messages.push({ role: 'assistant', content, timestamp: Date.now() });
  }

  getMessagesForRequest(): Message[] {
    // Return messages formatted for API call
    return this.messages.map((m) => ({
      role: m.role,
      content: m.content
    }));
  }

  getCachedContext(key: string): any | null {
    const cached = this.projectContextCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }
    return null;
  }

  setCachedContext(key: string, data: any): void {
    this.projectContextCache.set(key, { data, timestamp: Date.now() });
  }

  private pruneIfNeeded(): void {
    // Estimate token count
    const estimatedTokens = this.messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);

    if (estimatedTokens > this.maxContextTokens * 0.8) {
      // Summarize older messages
      this.summarizeOldMessages();
    }
  }

  private async summarizeOldMessages(): Promise<void> {
    if (this.messages.length <= 10) return;

    const oldMessages = this.messages.slice(0, -10);
    const recentMessages = this.messages.slice(-10);

    const summary = await this.generateSummary(oldMessages);

    this.messages = [
      { role: 'system', content: `Previous conversation summary:\n${summary}`, timestamp: Date.now() },
      ...recentMessages
    ];
  }
}
```

### Acceptance Criteria

- [ ] Messages persist across turns
- [ ] Context caching reduces API calls
- [ ] Token count stays within limits
- [ ] Summarization works correctly
- [ ] Cache invalidation works

---

## AI-005: AI Panel UI

**Effort:** 16-20 hours (4 days)  
**Priority:** High

### UI Component

```typescript
// packages/noodl-editor/src/editor/src/views/AIPanel/AIPanel.tsx

export function AIPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Change[]>([]);

  const agent = useFrontendAgent();

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage = input;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsProcessing(true);

    try {
      const response = await agent.process(userMessage);

      setMessages((prev) => [...prev, { role: 'assistant', content: response.response }]);

      if (response.changes?.length > 0) {
        setPendingChanges(response.changes);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${error.message}`,
          isError: true
        }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={styles.aiPanel}>
      <div className={styles.header}>
        <h3>AI Assistant</h3>
        <div className={styles.actions}>
          <button onClick={handleNewChat}>New Chat</button>
          <button onClick={handleShowHistory}>History</button>
        </div>
      </div>

      <div className={styles.quickActions}>
        <button onClick={() => setInput('Create a new component that ')}>+ Create Component</button>
        <button onClick={() => setInput('Add to the selected component ')}>✨ Improve Selected</button>
      </div>

      <div className={styles.messages}>
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        {isProcessing && <ProcessingIndicator />}
      </div>

      {pendingChanges.length > 0 && (
        <PendingChangesPreview
          changes={pendingChanges}
          onApply={applyChanges}
          onDiscard={() => setPendingChanges([])}
        />
      )}

      <div className={styles.inputArea}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe what you want to build or change..."
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
        />
        <button onClick={handleSend} disabled={isProcessing}>
          Send
        </button>
      </div>
    </div>
  );
}
```

### Acceptance Criteria

- [ ] Chat interface works
- [ ] Messages display correctly
- [ ] Processing indicator shows
- [ ] Quick actions work
- [ ] Change preview shows
- [ ] Undo/redo integrates

---

## AI-006: Context Menu Integration

**Effort:** 8-10 hours (2 days)  
**Priority:** Medium

### Implementation

Add AI options to component right-click menu:

- "Ask AI about this..."
- "Improve with AI"
- "Document with AI"
- "Explain this component"

---

## AI-007: Streaming Responses

**Effort:** 8-10 hours (2 days)  
**Priority:** Medium

### Implementation

Stream AI responses for better UX during longer operations.

---

## AI-008: Error Handling & Recovery

**Effort:** 8-10 hours (2 days)  
**Priority:** High

### Implementation

- Graceful error messages
- Automatic retry logic
- Change rollback on failure
- Undo integration

---

# PHASE 10C: BACKEND CREATION AI

**Duration:** 8-10 weeks  
**Total Effort:** 140-180 hours

[See PHASE-7-AI-POWERED-CREATION.md for detailed vision]

## Tasks Summary

| Task     | Name                      | Effort      |
| -------- | ------------------------- | ----------- |
| BACK-001 | Requirements Analyzer     | 16-20 hours |
| BACK-002 | Architecture Planner      | 12-16 hours |
| BACK-003 | Code Generation Engine    | 24-30 hours |
| BACK-004 | UBA Schema Generator      | 12-16 hours |
| BACK-005 | Docker Integration        | 16-20 hours |
| BACK-006 | Container Management      | 12-16 hours |
| BACK-007 | Backend Agent (LangGraph) | 16-20 hours |
| BACK-008 | Iterative Refinement      | 12-16 hours |
| BACK-009 | Backend Templates         | 12-16 hours |
| BACK-010 | Testing & Validation      | 16-20 hours |

---

# PHASE 10D: UNIFIED AI EXPERIENCE

**Duration:** 4-6 weeks  
**Total Effort:** 60-80 hours

## Tasks Summary

| Task      | Name                      | Effort      |
| --------- | ------------------------- | ----------- |
| UNIFY-001 | AI Orchestrator           | 16-20 hours |
| UNIFY-002 | Intent Classification     | 8-12 hours  |
| UNIFY-003 | Cross-Agent Context       | 12-16 hours |
| UNIFY-004 | Unified Chat UI           | 10-14 hours |
| UNIFY-005 | AI Settings & Preferences | 6-8 hours   |
| UNIFY-006 | Usage Analytics           | 8-10 hours  |

---

# PHASE 10E: DEPLOY SYSTEM UPDATES

## Overview

Review and update DEPLOY tasks to work with the new project structure and AI features.

**Duration:** 1-2 weeks  
**Total Effort:** 20-30 hours

---

## DEPLOY-UPDATE-001: V2 Project Format Support

**Effort:** 8-10 hours  
**Priority:** High

### Description

Update deployment system to work with V2 project format.

### Required Changes

```typescript
// packages/noodl-editor/src/editor/src/utils/compilation/build/deployer.ts

export async function deployToFolder(options: DeployToFolderOptions) {
  const format = await detectProjectFormat(options.project.path);

  if (format === ProjectFormat.V2) {
    // For V2 format, need to reconstruct project.json temporarily
    // OR update bundler to work with new format directly
    const tempProject = await reconstructLegacyProject(options.project.path);
    return deployLegacy(tempProject, options);
  }

  return deployLegacy(options.project, options);
}
```

### Changes Needed

1. **deployer.ts** - Format detection before deploy
2. **compilation.ts** - Support V2 format compilation
3. **bundler.ts** - Read from component files instead of project.json

### Acceptance Criteria

- [ ] V2 projects deploy correctly
- [ ] Legacy projects still work
- [ ] No performance regression
- [ ] All platform targets work

---

## DEPLOY-UPDATE-002: AI-Generated Backend Deployment

**Effort:** 6-8 hours  
**Priority:** Medium

### Description

Add deployment support for AI-generated backends.

### Required Changes

1. Detect AI-generated backends in project
2. Include Docker compose in deployment options
3. Add backend URL configuration to deploy settings

### Acceptance Criteria

- [ ] AI backends detected
- [ ] Docker deployment option available
- [ ] Backend URLs configurable

---

## DEPLOY-UPDATE-003: Preview Deploys with AI Changes

**Effort:** 4-6 hours  
**Priority:** Medium

### Description

Enable preview deployments to include uncommitted AI changes.

### Acceptance Criteria

- [ ] Preview includes pending AI changes
- [ ] Option to deploy with/without AI changes
- [ ] Change summary in preview

---

## DEPLOY-UPDATE-004: Environment Variables for AI Services

**Effort:** 4-6 hours  
**Priority:** Low

### Description

Add environment variable presets for common AI service configurations.

### Acceptance Criteria

- [ ] Anthropic API key preset
- [ ] OpenAI API key preset
- [ ] Custom AI service configuration

---

# PHASE 10F: LEGACY MIGRATION SYSTEM

## Overview

Extend the existing migration system to automatically convert legacy project.json files to the new V2 format during import.

**Duration:** 2-3 weeks  
**Total Effort:** 40-50 hours

---

## MIGRATE-001: Project Analysis Engine

**Effort:** 10-12 hours (2.5 days)  
**Priority:** Critical

### Description

Build an analysis engine that examines legacy project.json files and predicts potential migration issues before conversion.

### Implementation

```typescript
// packages/noodl-editor/src/editor/src/services/Migration/ProjectAnalyzer.ts

export interface AnalysisResult {
  canMigrate: boolean;
  confidence: 'high' | 'medium' | 'low';

  stats: {
    componentCount: number;
    totalNodes: number;
    totalConnections: number;
    estimatedNewFileCount: number;
    estimatedNewSize: number;
  };

  warnings: MigrationWarning[];
  errors: MigrationError[];

  componentAnalysis: ComponentAnalysis[];
}

export interface MigrationWarning {
  code: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  component?: string;
  suggestion?: string;
}

export interface MigrationError {
  code: string;
  message: string;
  component?: string;
  blocking: boolean;
}

export class ProjectAnalyzer {
  async analyze(projectJson: LegacyProject): Promise<AnalysisResult> {
    const warnings: MigrationWarning[] = [];
    const errors: MigrationError[] = [];
    const componentAnalysis: ComponentAnalysis[] = [];

    // Basic stats
    const components = Object.entries(projectJson.components || {});
    let totalNodes = 0;
    let totalConnections = 0;

    for (const [path, component] of components) {
      const analysis = await this.analyzeComponent(path, component);
      componentAnalysis.push(analysis);

      totalNodes += analysis.nodeCount;
      totalConnections += analysis.connectionCount;

      warnings.push(...analysis.warnings);
      errors.push(...analysis.errors);
    }

    // Check for global issues
    await this.checkGlobalIssues(projectJson, warnings, errors);

    // Calculate migration confidence
    const confidence = this.calculateConfidence(warnings, errors);
    const canMigrate = !errors.some((e) => e.blocking);

    return {
      canMigrate,
      confidence,
      stats: {
        componentCount: components.length,
        totalNodes,
        totalConnections,
        estimatedNewFileCount: components.length * 3 + 5, // 3 files per component + project files
        estimatedNewSize: this.estimateNewSize(projectJson)
      },
      warnings,
      errors,
      componentAnalysis
    };
  }

  private async analyzeComponent(path: string, component: LegacyComponent): Promise<ComponentAnalysis> {
    const warnings: MigrationWarning[] = [];
    const errors: MigrationError[] = [];

    // 1. Check path for issues
    const normalizedPath = this.normalizePath(path);
    if (normalizedPath.length > 200) {
      warnings.push({
        code: 'PATH_TOO_LONG',
        severity: 'medium',
        message: `Component path exceeds 200 characters and may be truncated`,
        component: path,
        suggestion: 'Consider renaming to a shorter path'
      });
    }

    if (this.hasProblematicCharacters(path)) {
      warnings.push({
        code: 'PATH_SPECIAL_CHARS',
        severity: 'low',
        message: `Component path contains special characters that will be normalized`,
        component: path
      });
    }

    // 2. Check for unsupported node types
    const nodes = component.graph?.roots || [];
    for (const node of nodes) {
      if (this.isDeprecatedNodeType(node.type)) {
        warnings.push({
          code: 'DEPRECATED_NODE',
          severity: 'high',
          message: `Node type "${node.type}" is deprecated`,
          component: path,
          suggestion: `Consider replacing with ${this.getSuggestedReplacement(node.type)}`
        });
      }

      if (this.isUnknownNodeType(node.type)) {
        errors.push({
          code: 'UNKNOWN_NODE_TYPE',
          message: `Unknown node type "${node.type}"`,
          component: path,
          blocking: false
        });
      }
    }

    // 3. Check for circular references
    const componentRefs = nodes
      .filter((n) => n.type.startsWith('/#') || n.type.startsWith('component:'))
      .map((n) => n.type);

    if (componentRefs.includes(path)) {
      warnings.push({
        code: 'SELF_REFERENCE',
        severity: 'medium',
        message: `Component references itself`,
        component: path
      });
    }

    // 4. Check for very large components
    if (nodes.length > 500) {
      warnings.push({
        code: 'LARGE_COMPONENT',
        severity: 'medium',
        message: `Component has ${nodes.length} nodes, which may impact performance`,
        component: path,
        suggestion: 'Consider splitting into smaller components'
      });
    }

    // 5. Check for orphaned nodes (no connections)
    const connections = component.graph?.connections || [];
    const connectedNodeIds = new Set([...connections.map((c) => c.fromId), ...connections.map((c) => c.toId)]);

    const orphanedNodes = nodes.filter(
      (n) => !connectedNodeIds.has(n.id) && n.type !== 'Component Inputs' && n.type !== 'Component Outputs'
    );

    if (orphanedNodes.length > 10) {
      warnings.push({
        code: 'MANY_ORPHANED_NODES',
        severity: 'low',
        message: `Component has ${orphanedNodes.length} unconnected nodes`,
        component: path,
        suggestion: 'Consider cleaning up unused nodes'
      });
    }

    // 6. Check metadata integrity
    if (component.metadata?.prompt?.history) {
      // Verify AI history is valid JSON
      try {
        JSON.stringify(component.metadata.prompt.history);
      } catch {
        warnings.push({
          code: 'CORRUPT_AI_HISTORY',
          severity: 'medium',
          message: `AI prompt history contains invalid data`,
          component: path,
          suggestion: 'AI history will be preserved but may be incomplete'
        });
      }
    }

    return {
      path,
      normalizedPath,
      nodeCount: nodes.length,
      connectionCount: connections.length,
      warnings,
      errors,
      dependencies: componentRefs
    };
  }

  private async checkGlobalIssues(
    project: LegacyProject,
    warnings: MigrationWarning[],
    errors: MigrationError[]
  ): Promise<void> {
    // Check for duplicate component IDs
    const ids = new Set<string>();
    for (const [path, component] of Object.entries(project.components || {})) {
      if (component.id && ids.has(component.id)) {
        errors.push({
          code: 'DUPLICATE_COMPONENT_ID',
          message: `Duplicate component ID: ${component.id}`,
          component: path,
          blocking: false
        });
      }
      ids.add(component.id);
    }

    // Check for missing dependencies
    const allPaths = new Set(Object.keys(project.components || {}));
    for (const [path, component] of Object.entries(project.components || {})) {
      const refs = (component.graph?.roots || []).filter((n) => n.type.startsWith('/#')).map((n) => n.type);

      for (const ref of refs) {
        if (!allPaths.has(ref) && !this.isBuiltInComponent(ref)) {
          warnings.push({
            code: 'MISSING_DEPENDENCY',
            severity: 'high',
            message: `Component references missing component: ${ref}`,
            component: path
          });
        }
      }
    }

    // Check project version
    if (project.version && this.isOldVersion(project.version)) {
      warnings.push({
        code: 'OLD_PROJECT_VERSION',
        severity: 'low',
        message: `Project was created with an older version of Noodl`,
        suggestion: 'Some features may need updating after migration'
      });
    }
  }

  private calculateConfidence(warnings: MigrationWarning[], errors: MigrationError[]): 'high' | 'medium' | 'low' {
    const highWarnings = warnings.filter((w) => w.severity === 'high').length;
    const blockingErrors = errors.filter((e) => e.blocking).length;

    if (blockingErrors > 0) return 'low';
    if (highWarnings > 5 || errors.length > 10) return 'low';
    if (highWarnings > 0 || errors.length > 0) return 'medium';
    return 'high';
  }
}
```

### Warning Codes Reference

| Code                   | Severity | Description                    |
| ---------------------- | -------- | ------------------------------ |
| PATH_TOO_LONG          | Medium   | Path > 200 chars               |
| PATH_SPECIAL_CHARS     | Low      | Special chars in path          |
| DEPRECATED_NODE        | High     | Using deprecated node type     |
| UNKNOWN_NODE_TYPE      | Error    | Unrecognized node type         |
| SELF_REFERENCE         | Medium   | Component references itself    |
| LARGE_COMPONENT        | Medium   | > 500 nodes                    |
| MANY_ORPHANED_NODES    | Low      | > 10 unconnected nodes         |
| CORRUPT_AI_HISTORY     | Medium   | Invalid AI metadata            |
| DUPLICATE_COMPONENT_ID | Error    | Same ID used twice             |
| MISSING_DEPENDENCY     | High     | Referenced component not found |
| OLD_PROJECT_VERSION    | Low      | Created with old Noodl         |

### Acceptance Criteria

- [ ] Analyzes all component types
- [ ] Detects all warning conditions
- [ ] Calculates accurate confidence
- [ ] Performance: < 5 seconds for 500 components
- [ ] Returns actionable suggestions

---

## MIGRATE-002: Pre-Migration Warning UI

**Effort:** 8-10 hours (2 days)  
**Priority:** Critical

### Description

Display analysis results to user before migration, allowing them to understand and address issues.

### UI Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Project Migration Analysis                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Migration Confidence: ████████░░ HIGH                                     │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Project Statistics                                                   │   │
│  │                                                                     │   │
│  │ Components:     54          Estimated new files: 167                │   │
│  │ Total Nodes:    3,420       Estimated new size:  2.8 MB             │   │
│  │ Connections:    8,950       Migration time:      ~45 seconds        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ⚠️  Warnings (3)                                           [Expand] │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                     │   │
│  │ ⚠ HIGH: Deprecated node type "OldRestAPI" in /pages/DataPage       │   │
│  │   → Suggestion: Replace with "REST" node                           │   │
│  │                                                                     │   │
│  │ ⚠ MEDIUM: Component has 650 nodes in /pages/ComplexDashboard       │   │
│  │   → Suggestion: Consider splitting into smaller components         │   │
│  │                                                                     │   │
│  │ ⚠ LOW: Path contains special characters: /#__cloud__/Email         │   │
│  │   → Will be normalized to: cloud/Email                              │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ✓ No blocking errors detected                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ☑ Create backup before migration                                          │
│  ☐ Fix warnings before migrating (optional)                                │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ℹ️ What happens during migration:                                    │   │
│  │                                                                     │   │
│  │ 1. Your project will be backed up                                   │   │
│  │ 2. Each component becomes its own folder with separate files        │   │
│  │ 3. All connections and metadata are preserved                       │   │
│  │ 4. AI-generated code history is maintained                          │   │
│  │ 5. You can undo migration by restoring backup                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│                      [Cancel]  [Fix Warnings First]  [Migrate Now]         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Error State UI

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Project Migration Analysis                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Migration Confidence: ██░░░░░░░░ LOW                                      │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ❌ Blocking Issues Found (2)                                         │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                     │   │
│  │ ✖ BLOCKING: Missing dependency /shared/CustomButton                 │   │
│  │   Referenced by: /pages/HomePage, /pages/ProfilePage               │   │
│  │   → Action required: Import or recreate this component              │   │
│  │                                                                     │   │
│  │ ✖ BLOCKING: Corrupt component data in /pages/BrokenPage            │   │
│  │   → Action required: Remove or repair this component                │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Migration cannot proceed until blocking issues are resolved.              │
│                                                                             │
│                           [Cancel]  [Get Help]                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Acceptance Criteria

- [ ] Shows analysis results clearly
- [ ] Warnings grouped by severity
- [ ] Blocking errors prevent migration
- [ ] Suggestions are actionable
- [ ] User can proceed or cancel

---

## MIGRATE-003: Integration with Import Flow

**Effort:** 10-12 hours (2.5 days)  
**Priority:** Critical

### Description

Integrate the migration system into the existing project import flow.

### Import Flow Changes

```typescript
// packages/noodl-editor/src/editor/src/services/ProjectService.ts

export class ProjectService {
  async importProject(sourcePath: string): Promise<ImportResult> {
    // 1. Detect format
    const format = await this.detectFormat(sourcePath);

    if (format === ProjectFormat.LEGACY) {
      // 2. Analyze for migration
      const project = await this.loadLegacyProject(sourcePath);
      const analysis = await this.analyzer.analyze(project);

      // 3. Show migration dialog
      const userChoice = await this.showMigrationDialog(analysis);

      if (userChoice === 'cancel') {
        return { success: false, cancelled: true };
      }

      if (userChoice === 'migrate') {
        // 4. Perform migration
        return await this.migrateAndImport(sourcePath, project, analysis);
      }

      if (userChoice === 'legacy') {
        // 5. Import as legacy (AI features disabled)
        return await this.importLegacy(sourcePath, project);
      }
    }

    // Already V2 format
    return await this.importV2(sourcePath);
  }

  private async migrateAndImport(
    sourcePath: string,
    project: LegacyProject,
    analysis: AnalysisResult
  ): Promise<ImportResult> {
    // Create backup
    const backupPath = await this.createBackup(sourcePath);

    try {
      // Export to V2
      const exporter = new ProjectExporter({
        outputDir: sourcePath,
        preserveOriginalPaths: true,
        validateOutput: true,
        onProgress: this.onMigrationProgress
      });

      const exportResult = await exporter.export(project);

      if (!exportResult.success) {
        throw new Error(`Migration failed: ${exportResult.errors.join(', ')}`);
      }

      // Validate round-trip
      const validator = new RoundTripValidator();
      const validation = await validator.validate(project, await this.importV2Project(sourcePath));

      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      return {
        success: true,
        migrated: true,
        backupPath,
        warnings: [...exportResult.warnings, ...validation.warnings]
      };
    } catch (error) {
      // Restore from backup
      await this.restoreBackup(backupPath, sourcePath);

      return {
        success: false,
        error: error.message,
        backupRestored: true
      };
    }
  }
}
```

### Acceptance Criteria

- [ ] Migration offered on legacy import
- [ ] User can choose to migrate or skip
- [ ] Backup created before migration
- [ ] Rollback works on failure
- [ ] Success shows warnings

---

## MIGRATE-004: Incremental Migration

**Effort:** 8-10 hours (2 days)  
**Priority:** Medium

### Description

Support migrating individual components instead of entire project.

### Use Cases

1. User wants to try migration on one component first
2. User has a very large project and wants to migrate in stages
3. User wants to migrate only components they're actively working on

### Implementation

```typescript
// packages/noodl-editor/src/editor/src/services/Migration/IncrementalMigrator.ts

export class IncrementalMigrator {
  async migrateComponent(projectPath: string, componentPath: string): Promise<MigrationResult> {
    // 1. Load the specific component from legacy project.json
    const project = await this.loadLegacyProject(projectPath);
    const component = project.components[componentPath];

    if (!component) {
      throw new Error(`Component not found: ${componentPath}`);
    }

    // 2. Analyze just this component
    const analysis = await this.analyzer.analyzeComponent(componentPath, component);

    if (analysis.errors.some((e) => e.blocking)) {
      return { success: false, errors: analysis.errors };
    }

    // 3. Export just this component
    const exporter = new ProjectExporter({
      outputDir: projectPath,
      preserveOriginalPaths: true,
      validateOutput: true
    });

    await exporter.exportSingleComponent(componentPath, component);

    // 4. Update registry to include this component
    await this.updateRegistry(projectPath, componentPath, component);

    // 5. Remove from legacy project.json (optional)
    // Keep for now for safety

    return {
      success: true,
      componentPath,
      warnings: analysis.warnings
    };
  }

  async getMigrationStatus(projectPath: string): Promise<MigrationStatus> {
    const hasLegacy = await fs.pathExists(path.join(projectPath, 'project.json'));
    const hasV2 = await fs.pathExists(path.join(projectPath, 'nodegx.project.json'));

    if (hasV2 && hasLegacy) {
      // Partial migration - some components migrated
      const legacyProject = await this.loadLegacyProject(projectPath);
      const registry = await this.loadRegistry(projectPath);

      const legacyComponents = Object.keys(legacyProject.components || {});
      const migratedComponents = Object.keys(registry.components || {});

      return {
        status: 'partial',
        totalComponents: legacyComponents.length,
        migratedComponents: migratedComponents.length,
        remainingComponents: legacyComponents.filter((c) => !migratedComponents.includes(this.normalizePath(c)))
      };
    }

    if (hasV2) {
      return { status: 'complete' };
    }

    return { status: 'not_started' };
  }
}
```

### Acceptance Criteria

- [ ] Single component migration works
- [ ] Migration status tracking works
- [ ] Partial migration state handled
- [ ] Can complete migration incrementally

---

## MIGRATE-005: Migration Testing & Validation

**Effort:** 10-12 hours (2.5 days)  
**Priority:** High

### Description

Comprehensive testing of migration system with real-world projects.

### Test Cases

```typescript
describe('Migration System', () => {
  describe('ProjectAnalyzer', () => {
    it('should detect path length warnings');
    it('should detect deprecated node types');
    it('should detect circular references');
    it('should detect missing dependencies');
    it('should calculate confidence correctly');
    it('should handle corrupt metadata gracefully');
  });

  describe('Migration Flow', () => {
    it('should migrate minimal project');
    it('should migrate complex project');
    it('should create valid backup');
    it('should restore on failure');
    it('should preserve all data');
  });

  describe('Incremental Migration', () => {
    it('should migrate single component');
    it('should track migration status');
    it('should handle partial state');
  });

  describe('Real Projects', () => {
    realProjects.forEach((project) => {
      it(`should migrate ${project.name}`, async () => {
        const result = await migrator.migrate(project.path);
        expect(result.success).toBe(true);

        // Verify round-trip
        const original = await loadLegacy(project.path);
        const migrated = await loadV2(project.path);
        const reimported = await exportToLegacy(migrated);

        expect(deepEqual(original, reimported)).toBe(true);
      });
    });
  });
});
```

### Acceptance Criteria

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] 10+ real projects migrate successfully
- [ ] Round-trip validation passes
- [ ] Performance benchmarks met

---

# SUMMARY

## Phase 10 Complete Task List

| Phase | Task ID           | Name                            | Effort |
| ----- | ----------------- | ------------------------------- | ------ |
| 10A   | STRUCT-001        | JSON Schema Definition          | 12-16h |
| 10A   | STRUCT-002        | Export Engine Core              | 16-20h |
| 10A   | STRUCT-003        | Import Engine Core              | 16-20h |
| 10A   | STRUCT-004        | Editor Format Detection         | 6-8h   |
| 10A   | STRUCT-005        | Lazy Component Loading          | 12-16h |
| 10A   | STRUCT-006        | Component-Level Save            | 12-16h |
| 10A   | STRUCT-007        | Migration Wizard UI             | 10-14h |
| 10A   | STRUCT-008        | Testing & Validation            | 16-20h |
| 10A   | STRUCT-009        | Documentation                   | 6-8h   |
| 10B   | AI-001            | Component Reading Tools         | 12-16h |
| 10B   | AI-002            | Component Modification Tools    | 16-20h |
| 10B   | AI-003            | LangGraph Agent Setup           | 16-20h |
| 10B   | AI-004            | Conversation Memory & Caching   | 12-16h |
| 10B   | AI-005            | AI Panel UI                     | 16-20h |
| 10B   | AI-006            | Context Menu Integration        | 8-10h  |
| 10B   | AI-007            | Streaming Responses             | 8-10h  |
| 10B   | AI-008            | Error Handling & Recovery       | 8-10h  |
| 10C   | BACK-001          | Requirements Analyzer           | 16-20h |
| 10C   | BACK-002          | Architecture Planner            | 12-16h |
| 10C   | BACK-003          | Code Generation Engine          | 24-30h |
| 10C   | BACK-004          | UBA Schema Generator            | 12-16h |
| 10C   | BACK-005          | Docker Integration              | 16-20h |
| 10C   | BACK-006          | Container Management            | 12-16h |
| 10C   | BACK-007          | Backend Agent (LangGraph)       | 16-20h |
| 10C   | BACK-008          | Iterative Refinement            | 12-16h |
| 10C   | BACK-009          | Backend Templates               | 12-16h |
| 10C   | BACK-010          | Testing & Validation            | 16-20h |
| 10D   | UNIFY-001         | AI Orchestrator                 | 16-20h |
| 10D   | UNIFY-002         | Intent Classification           | 8-12h  |
| 10D   | UNIFY-003         | Cross-Agent Context             | 12-16h |
| 10D   | UNIFY-004         | Unified Chat UI                 | 10-14h |
| 10D   | UNIFY-005         | AI Settings & Preferences       | 6-8h   |
| 10D   | UNIFY-006         | Usage Analytics                 | 8-10h  |
| 10E   | DEPLOY-UPDATE-001 | V2 Project Format Support       | 8-10h  |
| 10E   | DEPLOY-UPDATE-002 | AI-Generated Backend Deployment | 6-8h   |
| 10E   | DEPLOY-UPDATE-003 | Preview Deploys with AI Changes | 4-6h   |
| 10E   | DEPLOY-UPDATE-004 | Environment Variables for AI    | 4-6h   |
| 10F   | MIGRATE-001       | Project Analysis Engine         | 10-12h |
| 10F   | MIGRATE-002       | Pre-Migration Warning UI        | 8-10h  |
| 10F   | MIGRATE-003       | Integration with Import Flow    | 10-12h |
| 10F   | MIGRATE-004       | Incremental Migration           | 8-10h  |
| 10F   | MIGRATE-005       | Migration Testing & Validation  | 10-12h |

**Total: 42 tasks, 400-550 hours**

---

## Critical Path

```
STRUCT-001 → STRUCT-002 → STRUCT-003 → STRUCT-004 → STRUCT-005 → STRUCT-006
                                           ↓
                                    MIGRATE-001 → MIGRATE-002 → MIGRATE-003
                                           ↓
                                    AI-001 → AI-002 → AI-003 → AI-004 → AI-005
                                           ↓
                                    BACK-001 → BACK-002 → ... → BACK-010
                                           ↓
                                    UNIFY-001 → UNIFY-002 → ... → UNIFY-006
```

Phase 10A (Structure) and 10F (Migration) can proceed in parallel after STRUCT-003.
Phase 10E (DEPLOY updates) can proceed independently after STRUCT-004.
Phase 10B (Frontend AI) requires 10A complete.
Phase 10C (Backend AI) can start after 10B begins.
Phase 10D (Unified) requires 10B and 10C substantially complete.

```

```
