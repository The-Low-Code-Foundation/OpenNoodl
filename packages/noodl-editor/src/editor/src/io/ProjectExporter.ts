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

      // component.json
      files.push({
        relativePath: `components/${componentPath}/component.json`,
        content: this.buildComponentFile(component, now)
      });

      // nodes.json
      files.push({
        relativePath: `components/${componentPath}/nodes.json`,
        content: this.buildNodesFile(component)
      });

      // connections.json
      files.push({
        relativePath: `components/${componentPath}/connections.json`,
        content: this.buildConnectionsFile(component)
      });

      // Registry entry
      const registryEntry: RegistryComponentEntry = {
        path: componentPath,
        type: inferComponentType(component.name),
        nodeCount,
        connectionCount,
        modified: now
      };

      // Preserve created timestamp from metadata if available
      if (component.metadata?.created && typeof component.metadata.created === 'string') {
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

  // ─── Private builders ──────────────────────────────────────────────────────

  private buildProjectFile(project: LegacyProject, now: string): ProjectV2File {
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

    if (project.id !== undefined) {
      file.id = project.id;
    }

    if (project.runtimeVersion) {
      file.runtimeVersion = project.runtimeVersion;
    }

    if (project.rootNodeId !== undefined) {
      file.rootNodeId = project.rootNodeId;
    }

    if (project.lesson !== undefined) {
      file.lesson = project.lesson;
    }

    if (project.thumbnailURI !== undefined) {
      file.thumbnailURI = project.thumbnailURI;
    }

    if (project.settings && Object.keys(project.settings).length > 0) {
      file.settings = project.settings as ProjectV2File['settings'];
    }

    // Preserve metadata, minus the keys that are extracted into their own files.
    // `styles` always moves to nodegx.styles.json. `routes` only moves to
    // nodegx.routes.json when it is array-shaped (buildRoutesFile emits nothing
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

  private buildRoutesFile(project: LegacyProject): RoutesV2File | null {
    const routes = (project.metadata as Record<string, unknown> | undefined)?.routes;
    if (!routes) return null;

    // If routes is already an array of route objects, use it directly
    if (Array.isArray(routes)) {
      return {
        $schema: 'https://opennoodl.dev/schemas/routes-v2.json',
        version: 1,
        routes: routes as RoutesV2File['routes']
      };
    }

    return null;
  }

  private buildStylesFile(project: LegacyProject): StylesV2File | null {
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
      // (The previous code read `metaStyles.textStyles`, a key legacy never uses,
      // so every real project's text styles were silently dropped.)
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

  private buildComponentFile(component: LegacyComponent, now: string): ComponentV2File {
    const componentPath = legacyNameToPath(component.name);
    const localName = componentPath.split('/').pop() ?? componentPath;

    const file: ComponentV2File = {
      $schema: 'https://opennoodl.dev/schemas/component-v2.json',
      id: component.id as string,
      name: localName,
      path: component.name, // preserve original legacy path for round-trip
      type: inferComponentType(component.name),
      modified: now
    };

    // Preserve metadata fields as component settings
    if (component.metadata && Object.keys(component.metadata).length > 0) {
      file.metadata = component.metadata;
    }

    // Extract ports if available in metadata
    const ports = extractPorts(component);
    if (ports) {
      file.ports = ports;
    }

    return file;
  }

  private buildNodesFile(component: LegacyComponent): NodesV2File {
    const nodes = flattenNodes(component.graph?.roots ?? []);

    const file: NodesV2File = {
      $schema: 'https://opennoodl.dev/schemas/nodes-v2.json',
      componentId: component.id as string,
      version: 1,
      nodes
    };

    // Graph-level canvas state — dropped by the original engine.
    const visualRoots = component.graph?.visualRoots;
    if (visualRoots && visualRoots.length > 0) {
      file.visualRoots = visualRoots;
    }
    const comments = component.graph?.comments;
    if (comments && comments.length > 0) {
      file.comments = comments;
    }

    return file;
  }

  private buildConnectionsFile(component: LegacyComponent): ConnectionsV2File {
    const legacyConnections = component.graph?.connections ?? [];

    const connections: ConnectionV2[] = legacyConnections.map((c) => {
      const conn: ConnectionV2 = {
        fromId: c.fromId,
        fromProperty: c.fromProperty,
        toId: c.toId,
        toProperty: c.toProperty
      };
      if (c.annotation) conn.annotation = c.annotation;
      return conn;
    });

    return {
      $schema: 'https://opennoodl.dev/schemas/connections-v2.json',
      componentId: component.id as string,
      version: 1,
      connections
    };
  }
}
