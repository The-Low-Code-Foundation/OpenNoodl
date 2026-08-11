/**
 * STRUCT-002 — Export Engine Core
 *
 * Converts a legacy monolithic project.json into the v2 multi-file directory
 * structure defined by the JSON schemas in STRUCT-001.
 *
 * Output layout:
 *   <outputDir>/
 *     nodegx.project.json          ← project metadata
 *     nodegx.routes.json           ← route definitions (if any)
 *     nodegx.styles.json           ← global styles + variants
 *     components/
 *       _registry.json             ← component index
 *       <ComponentName>/
 *         component.json           ← component metadata + ports
 *         nodes.json               ← node graph
 *         connections.json         ← wiring
 *
 * @module noodl-editor/io/ProjectExporter
 * @since 1.2.0
 */

import type {
  ProjectV2File,
  ComponentV2File,
  NodesV2File,
  ConnectionsV2File,
  RegistryV2File,
  RegistryComponentEntry,
  RoutesV2File,
  StylesV2File,
  NodeV2,
  ConnectionV2,
  PortDefinition
} from '../schemas';

// ─── Legacy format types (what project.toJSON() produces) ─────────────────────

/** A single connection in the legacy graph format */
export interface LegacyConnection {
  fromId: string;
  fromProperty: string;
  toId: string;
  toProperty: string;
  /** CAN-002: author-written text on the wire. */
  label?: string;
  /** CAN-001: where that text sits along the wire. */
  labelT?: number;
  annotation?: 'Deleted' | 'Changed' | 'Created';
}

/** A single node in the legacy graph format (recursive via children) */
export interface LegacyNode {
  id: string;
  type: string;
  variant?: string;
  version?: number;
  label?: string;
  x?: number;
  y?: number;
  parameters?: Record<string, unknown>;
  stateParameters?: Record<string, Record<string, unknown>>;
  stateTransitions?: Record<string, Record<string, unknown>>;
  defaultStateTransitions?: Record<string, unknown>;
  ports?: unknown[];
  dynamicports?: unknown[];
  conflicts?: unknown[];
  children?: LegacyNode[];
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/** The graph object inside a legacy component */
export interface LegacyGraph {
  roots: LegacyNode[];
  connections: LegacyConnection[];
  visualRoots?: string[];
  comments?: unknown[];
}

/** A single component in the legacy project.json */
export interface LegacyComponent {
  name: string;
  /** Optional in practice — many real/imported projects have id-less components. */
  id?: string;
  /**
   * LEG-006 — "one or two sentences: what this component is and does", the
   * authoring vocabulary's own words. Authorable through `create_component`,
   * the plan tools and `AUTHORED_PAYLOAD_FIELDS`; before LEG-006 it reached
   * disk and was then deleted by the first editor save, because
   * `buildComponentV2Files` wrote six keys and this was not one of them.
   */
  description?: string;
  /** LEG-006 (L3) — ISO timestamp stamped once, by whoever created the component. */
  created?: string;
  /** LEG-006 (L3) — who last wrote it ("noodl-mcp" for an agent-authored component). */
  modifiedBy?: string;
  metadata?: Record<string, unknown>;
  graph: LegacyGraph;
}

/** A variant entry in the legacy project.json */
export interface LegacyVariant {
  /** Optional in practice — most real variants carry only a typename. */
  name?: string;
  typename: string;
  parameters?: Record<string, unknown>;
  stateParamaters?: Record<string, Record<string, unknown>>; // note: legacy typo
  stateTransitions?: Record<string, Record<string, unknown>>;
  defaultStateTransitions?: Record<string, unknown>;
  conflicts?: unknown[];
}

/** The full legacy project.json structure */
export interface LegacyProject {
  name: string;
  id?: string;
  version?: string;
  runtimeVersion?: 'react17' | 'react19';
  settings?: Record<string, unknown>;
  rootNodeId?: string;
  thumbnailURI?: string;
  metadata?: Record<string, unknown>;
  lesson?: unknown;
  variants?: LegacyVariant[];
  components: LegacyComponent[];
}

// ─── Export result types ───────────────────────────────────────────────────────

/** A single file to be written as part of the export */
export interface ExportFile {
  /** Relative path from the output directory root */
  relativePath: string;
  /** Parsed JSON content (caller serialises with JSON.stringify) */
  content: unknown;
}

/** The complete result of a ProjectExporter.export() call */
export interface ExportResult {
  /** All files that should be written to disk */
  files: ExportFile[];
  /** Summary statistics */
  stats: {
    totalComponents: number;
    totalNodes: number;
    totalConnections: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converts a legacy component name (e.g. "/#Header", "/Pages/Home") to a
 * filesystem-safe directory name relative to the components/ folder.
 *
 * Rules:
 *   - Strip leading "/"
 *   - Strip leading "#" (root component marker)
 *   - Replace remaining "/" with OS path separator (we use "/" for portability)
 *   - Strip "__cloud__/" prefix used by cloud function components
 *
 * Examples:
 *   "/#Header"                  → "Header"
 *   "/%rootcomponent"           → "%rootcomponent"
 *   "/Pages/Home"               → "Pages/Home"
 *   "/#__cloud__/SendGrid/Send" → "__cloud__/SendGrid/Send"
 */
export function legacyNameToPath(legacyName: string): string {
  // Remove leading slash
  let path = legacyName.startsWith('/') ? legacyName.slice(1) : legacyName;
  // Remove leading # (root component marker in legacy format)
  if (path.startsWith('#')) {
    path = path.slice(1);
  }
  return path;
}

/**
 * Infers the component type from its legacy name and graph structure.
 *
 * Heuristics (in priority order):
 *   1. "/%rootcomponent" → 'root'
 *   2. Name contains "/Pages/" or starts with "Pages/" → 'page'
 *   3. Name contains "/__cloud__/" → 'cloud'
 *   4. Default → 'visual'
 */
export function inferComponentType(
  legacyName: string
): 'root' | 'page' | 'visual' | 'logic' | 'cloud' {
  const lower = legacyName.toLowerCase();
  if (lower.includes('%rootcomponent')) return 'root';
  if (lower.includes('__cloud__')) return 'cloud';
  if (lower.includes('/pages/') || lower.startsWith('/pages/')) return 'page';
  return 'visual';
}

/**
 * Flattens a tree of legacy nodes (which embed children recursively) into a
 * flat array of NodeV2 objects, preserving parent/child relationships via IDs.
 */
export function flattenNodes(roots: LegacyNode[]): NodeV2[] {
  const result: NodeV2[] = [];

  function visit(node: LegacyNode, parentId?: string): void {
    const childIds = (node.children ?? []).map((c) => c.id);

    const v2Node: NodeV2 = {
      id: node.id,
      type: node.type
    };

    // Only include optional fields when they have meaningful values
    if (node.label !== undefined) v2Node.label = node.label;
    if (node.x !== undefined) v2Node.x = node.x;
    if (node.y !== undefined) v2Node.y = node.y;
    if (node.variant !== undefined) v2Node.variant = node.variant;
    if (node.version !== undefined) v2Node.version = node.version;
    if (node.parameters && Object.keys(node.parameters).length > 0) {
      v2Node.parameters = node.parameters;
    }
    if (node.stateParameters && Object.keys(node.stateParameters).length > 0) {
      v2Node.stateParameters = node.stateParameters;
    }
    if (node.stateTransitions && Object.keys(node.stateTransitions).length > 0) {
      v2Node.stateTransitions = node.stateTransitions;
    }
    if (node.defaultStateTransitions && Object.keys(node.defaultStateTransitions).length > 0) {
      v2Node.defaultStateTransitions = node.defaultStateTransitions;
    }
    if (node.ports && (node.ports as unknown[]).length > 0) {
      v2Node.ports = node.ports as NodeV2['ports'];
    }
    if (node.dynamicports && (node.dynamicports as unknown[]).length > 0) {
      v2Node.dynamicports = node.dynamicports as NodeV2['dynamicports'];
    }
    if (node.conflicts && (node.conflicts as unknown[]).length > 0) {
      v2Node.conflicts = node.conflicts as NodeV2['conflicts'];
    }
    if (node.metadata && Object.keys(node.metadata).length > 0) {
      v2Node.metadata = node.metadata;
    }
    if (childIds.length > 0) v2Node.children = childIds;
    if (parentId !== undefined) v2Node.parent = parentId;

    result.push(v2Node);

    // Recurse into children
    for (const child of node.children ?? []) {
      visit(child, node.id);
    }
  }

  for (const root of roots) {
    visit(root);
  }

  return result;
}

/**
 * Counts all nodes in a legacy component graph (including nested children).
 */
export function countNodes(roots: LegacyNode[]): number {
  let count = 0;
  function visit(node: LegacyNode): void {
    count++;
    for (const child of node.children ?? []) visit(child);
  }
  for (const root of roots) visit(root);
  return count;
}

/**
 * Extracts component ports from the legacy component metadata.
 * Legacy components don't store ports directly — they're derived at runtime
 * from nodes with `haveComponentPorts`. We preserve whatever is in metadata.
 */
function extractPorts(component: LegacyComponent): ComponentV2File['ports'] | undefined {
  // Legacy format doesn't serialise computed ports into component JSON.
  // If the component metadata has port info, preserve it.
  const meta = component.metadata;
  if (!meta) return undefined;

  // Some components store port info in metadata under 'ports' key
  if (meta.ports && typeof meta.ports === 'object') {
    return meta.ports as ComponentV2File['ports'];
  }

  return undefined;
}

/** The three per-component files produced by the v2 exporter. */
export interface ComponentV2Files {
  component: ComponentV2File;
  nodes: NodesV2File;
  connections: ConnectionsV2File;
}

/**
 * Builds the three v2 files (component.json, nodes.json, connections.json) for a
 * single legacy component. Pure — no filesystem access.
 *
 * Extracted so that per-component savers (ComponentSaver) can serialise one
 * component without re-running a whole-project export. `ProjectExporter.export`
 * delegates to this for each component, so there is a single source of truth for
 * the per-component layout.
 */
export function buildComponentV2Files(component: LegacyComponent, now: string): ComponentV2Files {
  const componentPath = legacyNameToPath(component.name);
  const localName = componentPath.split('/').pop() ?? componentPath;

  const componentFile: ComponentV2File = {
    $schema: 'https://opennoodl.dev/schemas/component-v2.json',
    id: component.id as string,
    name: localName,
    path: component.name, // preserve original legacy path for round-trip
    type: inferComponentType(component.name),
    modified: now
  };

  // LEG-006 — authored prose and provenance, carried rather than dropped.
  //
  // These three keys are declared on `ComponentV2File` and written by every MCP
  // create, and until LEG-006 none of them was written here: the file was rebuilt
  // from six keys, so the first editor save after an agent wrote a description
  // deleted it, silently, with the validator clean and the graph intact
  // (measured in BEN-005, register B23, 2026-08-09).
  //
  // Each is added only when present. An absent description must not become an
  // empty string: a component that never had one would then gain a key and a
  // spurious diff on a save that changed nothing (F46), which is the same class
  // of bug one polarity over.
  if (typeof component.description === 'string' && component.description.length > 0) {
    componentFile.description = component.description;
  }
  if (typeof component.created === 'string' && component.created.length > 0) {
    componentFile.created = component.created;
  }
  // Preserved, not restamped. Restamping every editor save `modifiedBy: 'editor'`
  // would be a defensible policy and is a different decision from "stop deleting
  // it"; making it here would rewrite the field on every MCP-authored component
  // the first time it is opened. See NOTES-LEG-006.md.
  if (typeof component.modifiedBy === 'string' && component.modifiedBy.length > 0) {
    componentFile.modifiedBy = component.modifiedBy;
  }

  const ports = extractPorts(component);
  if (ports) {
    componentFile.ports = ports;
  }

  const nodesFile: NodesV2File = {
    $schema: 'https://opennoodl.dev/schemas/nodes-v2.json',
    componentId: component.id as string,
    version: 1,
    nodes: flattenNodes(component.graph?.roots ?? [])
  };

  // Graph-level canvas state (visualRoots / comments).
  const visualRoots = component.graph?.visualRoots;
  if (visualRoots && visualRoots.length > 0) {
    nodesFile.visualRoots = visualRoots;
  }
  const comments = component.graph?.comments;
  if (comments && comments.length > 0) {
    nodesFile.comments = comments;
  }

  const connectionsFile: ConnectionsV2File = {
    $schema: 'https://opennoodl.dev/schemas/connections-v2.json',
    componentId: component.id as string,
    version: 1,
    connections: (component.graph?.connections ?? []).map((c) => {
      const conn: ConnectionV2 = {
        fromId: c.fromId,
        fromProperty: c.fromProperty,
        toId: c.toId,
        toProperty: c.toProperty
      };
      // A wire label is authored content (CAN-002), not decoration: dropping it
      // here loses it on every export, and — because both sides of the AI review
      // diff come through this serializer — made a relabel invisible to review.
      if (c.label !== undefined) conn.label = c.label;
      if (c.labelT !== undefined) conn.labelT = c.labelT;
      if (c.annotation) conn.annotation = c.annotation;
      return conn;
    })
  };

  return { component: componentFile, nodes: nodesFile, connections: connectionsFile };
}

/**
 * Builds the project-level metadata file (nodegx.project.json). Pure.
 * Extracted so ComponentSaver can rewrite just this file without a full export.
 */
export function buildProjectV2File(project: LegacyProject, now: string): ProjectV2File {
  const file: ProjectV2File = {
    $schema: 'https://opennoodl.dev/schemas/project-v2.json',
    name: project.name,
    version: project.version ?? '4',
    nodegxVersion: '1.1.0',
    modified: now,
    structure: {
      componentsDir: 'components',
      assetsDir: 'assets'
    }
  };

  if (project.id !== undefined) file.id = project.id;
  if (project.runtimeVersion) file.runtimeVersion = project.runtimeVersion;
  if (project.rootNodeId !== undefined) file.rootNodeId = project.rootNodeId;
  if (project.lesson !== undefined) file.lesson = project.lesson;
  if (project.thumbnailURI !== undefined) file.thumbnailURI = project.thumbnailURI;
  if (project.settings && Object.keys(project.settings).length > 0) {
    file.settings = project.settings as ProjectV2File['settings'];
  }

  // Preserve metadata, minus the keys extracted into their own files.
  // `styles` always moves to nodegx.styles.json. `routes` only moves to
  // nodegx.routes.json when it is array-shaped (buildRoutesV2File emits nothing
  // otherwise), so non-array routes must stay in metadata or they are lost.
  if (project.metadata) {
    const rest = { ...(project.metadata as Record<string, unknown>) };
    delete rest.styles;
    if (Array.isArray(rest.routes)) {
      delete rest.routes;
    }
    if (Object.keys(rest).length > 0) {
      file.metadata = rest;
    }
  }

  return file;
}

/** Builds nodegx.routes.json, or null when the project has no array-shaped routes. Pure. */
export function buildRoutesV2File(project: LegacyProject): RoutesV2File | null {
  const routes = (project.metadata as Record<string, unknown> | undefined)?.routes;
  if (!routes) return null;

  if (Array.isArray(routes)) {
    return {
      $schema: 'https://opennoodl.dev/schemas/routes-v2.json',
      version: 1,
      routes: routes as RoutesV2File['routes']
    };
  }

  return null;
}

/** Builds nodegx.styles.json, or null when the project has no styles or variants. Pure. */
export function buildStylesV2File(project: LegacyProject): StylesV2File | null {
  const metaStyles = (project.metadata as Record<string, unknown> | undefined)?.styles as
    | Record<string, unknown>
    | undefined;
  const hasVariants = project.variants && project.variants.length > 0;
  const hasStyles = metaStyles && Object.keys(metaStyles).length > 0;

  if (!hasStyles && !hasVariants) return null;

  const file: StylesV2File = {
    $schema: 'https://opennoodl.dev/schemas/styles-v2.json',
    version: 1
  };

  if (metaStyles) {
    if (metaStyles.colors && typeof metaStyles.colors === 'object') {
      file.colors = metaStyles.colors as Record<string, string>;
    }
    // Legacy stores text presets under `text`; v2 names the field `textStyles`.
    if (metaStyles.text && typeof metaStyles.text === 'object') {
      file.textStyles = metaStyles.text as Record<string, Record<string, unknown>>;
    }
  }

  if (project.variants && project.variants.length > 0) {
    file.variants = project.variants.map((v) => ({
      name: v.name as string,
      typename: v.typename,
      parameters: v.parameters,
      // Note: legacy uses "stateParamaters" (typo) — we normalise here
      stateParameters: v.stateParamaters,
      stateTransitions: v.stateTransitions,
      defaultStateTransitions: v.defaultStateTransitions,
      conflicts: v.conflicts
    }));
  }

  return file;
}

// ─── ProjectExporter ──────────────────────────────────────────────────────────

/**
 * Converts a legacy project.json object into the v2 multi-file format.
 *
 * This class is pure — it does not touch the filesystem. The caller receives
 * an `ExportResult` containing all files to write, and is responsible for
 * actually writing them (e.g. via `fs.writeFile` or the platform abstraction).
 *
 * @example
 * ```ts
 * const exporter = new ProjectExporter();
 * const result = exporter.export(legacyProjectJson);
 *
 * for (const file of result.files) {
 *   await fs.writeFile(
 *     path.join(outputDir, file.relativePath),
 *     JSON.stringify(file.content, null, 2),
 *     'utf-8'
 *   );
 * }
 * ```
 */
export class ProjectExporter {
  /**
   * Exports a legacy project JSON object to the v2 multi-file format.
   *
   * @param project - The parsed legacy project.json object
   * @returns ExportResult containing all files to write and summary stats
   */
  export(project: LegacyProject): ExportResult {
    const files: ExportFile[] = [];
    const now = new Date().toISOString();

    // ── 1. Project metadata file ─────────────────────────────────────────────
    files.push({
      relativePath: 'nodegx.project.json',
      content: this.buildProjectFile(project, now)
    });

    // ── 2. Routes file (extracted from metadata if present) ──────────────────
    const routesFile = this.buildRoutesFile(project);
    if (routesFile !== null) {
      files.push({
        relativePath: 'nodegx.routes.json',
        content: routesFile
      });
    }

    // ── 3. Styles file (colors, textStyles, variants) ────────────────────────
    const stylesFile = this.buildStylesFile(project);
    if (stylesFile !== null) {
      files.push({
        relativePath: 'nodegx.styles.json',
        content: stylesFile
      });
    }

    // ── 4. Components ────────────────────────────────────────────────────────
    const registry: RegistryV2File = {
      $schema: 'https://opennoodl.dev/schemas/registry-v2.json',
      version: 1,
      lastUpdated: now,
      components: {},
      stats: {
        totalComponents: 0,
        totalNodes: 0,
        totalConnections: 0
      }
    };

    let totalNodes = 0;
    let totalConnections = 0;

    for (const component of project.components) {
      const componentPath = legacyNameToPath(component.name);
      const nodeCount = countNodes(component.graph?.roots ?? []);
      const connectionCount = (component.graph?.connections ?? []).length;

      totalNodes += nodeCount;
      totalConnections += connectionCount;

      const componentFiles = buildComponentV2Files(component, now);

      files.push({
        relativePath: `components/${componentPath}/component.json`,
        content: componentFiles.component
      });
      files.push({
        relativePath: `components/${componentPath}/nodes.json`,
        content: componentFiles.nodes
      });
      files.push({
        relativePath: `components/${componentPath}/connections.json`,
        content: componentFiles.connections
      });

      // Registry entry
      const registryEntry: RegistryComponentEntry = {
        path: componentPath,
        type: inferComponentType(component.name),
        nodeCount,
        connectionCount,
        modified: now
      };

      // Preserve the created timestamp. LEG-006 made `created` a first-class
      // field on the component (that is where MCP writes it and where
      // component.json reads it back from); the metadata fallback stays for the
      // projects that put it there.
      if (typeof component.created === 'string' && component.created.length > 0) {
        registryEntry.created = component.created;
      } else if (component.metadata?.created && typeof component.metadata.created === 'string') {
        registryEntry.created = component.metadata.created;
      }

      registry.components[componentPath] = registryEntry;
    }

    // Update registry stats
    registry.stats = {
      totalComponents: project.components.length,
      totalNodes,
      totalConnections
    };

    // _registry.json
    files.push({
      relativePath: 'components/_registry.json',
      content: registry
    });

    return {
      files,
      stats: {
        totalComponents: project.components.length,
        totalNodes,
        totalConnections
      }
    };
  }

  // ─── Private builders (delegate to the shared pure functions) ────────────────

  private buildProjectFile(project: LegacyProject, now: string): ProjectV2File {
    return buildProjectV2File(project, now);
  }

  private buildRoutesFile(project: LegacyProject): RoutesV2File | null {
    return buildRoutesV2File(project);
  }

  private buildStylesFile(project: LegacyProject): StylesV2File | null {
    return buildStylesV2File(project);
  }
}
