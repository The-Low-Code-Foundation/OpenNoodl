# Phase 10A  AI-Powered Development: Dishant's Progress

**Developer:** Dishant  
**Branch:** `cline-dev-dishant`  
**Last Updated:** 2026-02-19

---

## Task Status

| Task ID    | Title                        | Status      | Notes                                      |
|------------|------------------------------|-------------|--------------------------------------------|
| STRUCT-001 | JSON Schema Definition       |  Complete | 8 schemas + validator + tests (33/33 pass) |
| STRUCT-002 | Export Engine Core           |  Complete | ProjectExporter + 50 unit tests            |

---

## STRUCT-001  JSON Schema Definition 

**Completed:** 2026-02-18  
**Scope:** Define JSON schemas for the v2 multi-file project format

### What was built

All files live under `packages/noodl-editor/src/editor/src/schemas/`:

#### Schema files (8 total)

| File | Schema ID | Describes |
|------|-----------|-----------|
| `project-v2.schema.json` | `https://opennoodl.dev/schemas/project-v2.json` | Root project metadata (`nodegx.project.json`) |
| `component.schema.json` | `https://opennoodl.dev/schemas/component-v2.json` | Component metadata (`component.json`) |
| `nodes.schema.json` | `https://opennoodl.dev/schemas/nodes-v2.json` | Node graph definitions (`nodes.json`) |
| `connections.schema.json` | `https://opennoodl.dev/schemas/connections-v2.json` | Connection/wire definitions (`connections.json`) |
| `registry.schema.json` | `https://opennoodl.dev/schemas/registry-v2.json` | Component index (`_registry.json`) |
| `routes.schema.json` | `https://opennoodl.dev/schemas/routes-v2.json` | URL route definitions (`nodegx.routes.json`) |
| `styles.schema.json` | `https://opennoodl.dev/schemas/styles-v2.json` | Global styles + variants (`nodegx.styles.json`) |
| `model.schema.json` | `https://opennoodl.dev/schemas/model-v2.json` | Backend data model definitions (`models/<Name>.json`) |

#### Validator (`validator.ts`)

- `SchemaValidator` singleton class  compiles all 8 schemas once, reuses validators
- `SCHEMA_IDS` const  typed schema ID map
- `validateSchema()` convenience function
- `validateOrThrow()`  throws with context on failure
- Per-schema convenience methods: `validateProject()`, `validateComponent()`, etc.
- `formatValidationErrors()`  human-readable error formatting
- Ajv v8 with `ajv-formats` for `date-time` format validation
- `allErrors: true`  collects all errors, not just first

#### Index (`index.ts`)

- Re-exports all schemas, validator, and TypeScript interfaces
- Full TS interfaces for all 8 file types: `ProjectV2File`, `ComponentV2File`, `NodesV2File`, `ConnectionsV2File`, `RegistryV2File`, `RoutesV2File`, `StylesV2File`, `ModelV2File`

#### Tests (`tests/schemas/schema-validator.test.ts`)

- 33 test cases covering all 8 schemas
- Valid minimal fixtures, full fixtures with all optional fields
- Invalid cases: missing required fields, wrong enum values, invalid formats
- Edge cases: legacy component refs (`/#Header`), complex port type objects, deeply nested metadata
- Registered in `tests/index.ts`  `tests/schemas/index.ts`

### Dependencies added

```json
"ajv": "^8.x",
"ajv-formats": "^2.x"
```

Added to `packages/noodl-editor/package.json` dependencies.

### Key design decisions

1. **`additionalProperties: true` on nodes/connections**  node parameters and connection metadata are open-ended by design; the schema validates structure, not content
2. **Port type is `oneOf [string, object]`**  Noodl uses both `"string"` and `{ name: "stringlist", ... }` type formats
3. **`strict: false` on Ajv**  schemas use `description` in `definitions` which Ajv strict mode rejects
4. **`require()` for `ajv-formats`**  avoids TS type conflict between root-level `ajv-formats` (which bundles its own Ajv) and the package-local Ajv v8

### Verification

```
33/33 smoke tests passed (node smoke-test-schemas.js)
0 TypeScript errors
```

---

## STRUCT-002  Export Engine Core 

**Completed:** 2026-02-19  
**Scope:** Build the engine that converts the legacy `project.json` format into the v2 multi-file directory structure

### What was built

All files:

| File | Purpose |
|------|---------|
| `packages/noodl-editor/src/editor/src/io/ProjectExporter.ts` | Core exporter class + legacy type definitions + helper functions |
| `packages/noodl-editor/tests/io/ProjectExporter.test.ts` | 50 unit tests |
| `packages/noodl-editor/tests/io/index.ts` | Test barrel export |

### Architecture

`ProjectExporter` is a **pure class**  it does not touch the filesystem. It takes a `LegacyProject` object (the parsed `project.json`) and returns an `ExportResult` containing all files to write.

```
ProjectExporter.export(legacyProject)
   ExportResult {
      files: ExportFile[],   // { relativePath, content }[]
      stats: { totalComponents, totalNodes, totalConnections }
    }
```

Output file layout:
```
nodegx.project.json           project metadata
nodegx.routes.json            route definitions (if any in metadata)
nodegx.styles.json            global styles + variants (if any)
components/
  _registry.json              component index
  Header/
    component.json            component metadata
    nodes.json                flat node list (tree flattened)
    connections.json          connection list
  Pages/Home/
    component.json
    nodes.json
    connections.json
  ...
```

### Key functions exported

| Function | Purpose |
|----------|---------|
| `legacyNameToPath(name)` | Converts `/#Header`  `Header`, `/Pages/Home`  `Pages/Home` |
| `inferComponentType(name)` | Heuristic: root/page/cloud/visual from legacy name |
| `flattenNodes(roots)` | Flattens recursive legacy node tree  flat `NodeV2[]` with parent/children IDs |
| `countNodes(roots)` | Counts all nodes including nested children |

### Key design decisions

1. **Pure / filesystem-agnostic**  caller writes files; exporter just produces the data. Easy to test, easy to use in different contexts (Electron, Node, tests).
2. **Node tree flattening**  legacy format stores nodes as a recursive tree (children embedded). v2 format stores a flat array with `parent` and `children` (as ID arrays). `flattenNodes()` handles this.
3. **Styles file is conditional**  only produced when `metadata.styles` has content OR variants exist. Same for routes.
4. **Legacy `stateParamaters` typo normalised**  VariantModel.toJSON() uses `stateParamaters` (typo). The exporter maps this to `stateParameters` in the v2 format.
5. **Metadata split**  `styles` and `routes` are extracted from `project.metadata` into their own files; remaining metadata keys stay in `nodegx.project.json`.
6. **Original legacy path preserved**  `component.json` stores `path: "/#Header"` for round-trip fidelity (STRUCT-003 import engine will need this).
7. **Empty fields omitted**  nodes with empty `parameters: {}` don't get a `parameters` key in the output, keeping files lean.

### Tests

50 unit tests in `tests/io/ProjectExporter.test.ts` covering:

- `legacyNameToPath`  6 cases (slash stripping, hash stripping, cloud paths, nested paths)
- `inferComponentType`  6 cases (root, cloud, page, case-insensitive, visual)
- `countNodes`  4 cases (empty, single, recursive, multiple roots)
- `flattenNodes`  11 cases (empty, single, nested, parent/child IDs, field omission, metadata)
- `ProjectExporter.export()`  23 cases across:
  - Basic structure (always-present files, conditional files, stats)
  - Project file (name, version, runtimeVersion, settings, $schema, metadata stripping)
  - Routes file (conditional, content, non-array guard)
  - Styles file (conditional, colors, variant typo normalisation)
  - Component files (3 files per component, paths, IDs, type inference, node flattening, connections)
  - Registry (all components listed, path/type/nodeCount/connectionCount, stats, version)
  - ExportResult stats
  - Edge cases (no graph, empty graph, multiple components, cloud type, variant preservation)

### Registered in

- `tests/io/index.ts`  `tests/index.ts`

---

## Next: STRUCT-003  Import Engine

**Unblocked by:** STRUCT-002   
**Goal:** Build the engine that converts the v2 multi-file format back to the legacy `project.json` format, with round-trip validation.
