/**
 * STRUCT-003  Import Engine Core
 *
 * Converts the v2 multi-file directory structure back into the legacy
 * monolithic project.json format. Designed for round-trip fidelity with
 * ProjectExporter  export  import should produce an identical project.
 *
 * This class is pure  it does not touch the filesystem. The caller provides
 * all file contents as an ImportInput object, and receives a LegacyProject.
 *
 * @module noodl-editor/io/ProjectImporter
 * @since 1.2.0
 */

import type {
  ProjectV2File,
  ComponentV2File,
  NodesV2File,
  ConnectionsV2File,
  RegistryV2File,
  RoutesV2File,
  StylesV2File,
  NodeV2
} from '../schemas';

import type {
  LegacyProject,
  LegacyComponent,
  LegacyNode,
  LegacyGraph,
  LegacyConnection,
  LegacyVariant
} from './ProjectExporter';

//  Import input types 

/**
 * All files needed to reconstruct a project.
 * The caller reads these from disk and passes them in.
 */
export interface ImportInput {
  /** Contents of nodegx.project.json */
  project: ProjectV2File;
  /** Contents of components/_registry.json */
  registry: RegistryV2File;
  /** Contents of nodegx.routes.json (optional) */
  routes?: RoutesV2File;
  /** Contents of nodegx.styles.json (optional) */
  styles?: StylesV2File;
  /** Per-component files, keyed by registry path (e.g. "Header", "Pages/Home") */
  components: Record<
    string,
    {
      component: ComponentV2File;
      nodes: NodesV2File;
      connections: ConnectionsV2File;
    }
  >;
}

/**
 * Result of a ProjectImporter.import() call.
 */
export interface ImportResult {
  /** The reconstructed legacy project object */
  project: LegacyProject;
  /** Any non-fatal warnings encountered during import */
  warnings: string[];
}

//  Helpers 

/**
 * Reconstructs a recursive legacy node tree from a flat NodeV2 array.
 *
 * The flat array uses `parent` and `children` (as ID arrays) to encode the
 * tree structure. We rebuild the recursive tree that legacy format expects.
 *
 * @param flatNodes - Flat array of NodeV2 objects from nodes.json
 * @returns Array of root LegacyNode objects with children embedded recursively
 */
export function unflattenNodes(flatNodes: NodeV2[]): LegacyNode[] {
  if (flatNodes.length === 0) return [];

  // Build a map for O(1) lookup
  const nodeMap = new Map<string, LegacyNode>();

  // First pass: create all LegacyNode objects (without children populated yet)
  for (const v2Node of flatNodes) {
    const legacyNode: LegacyNode = {
      id: v2Node.id,
      type: v2Node.type,
      children: []
    };

    // Restore optional fields
    if (v2Node.label !== undefined) legacyNode.label = v2Node.label;
    if (v2Node.x !== undefined) legacyNode.x = v2Node.x;
    if (v2Node.y !== undefined) legacyNode.y = v2Node.y;
    if (v2Node.variant !== undefined) legacyNode.variant = v2Node.variant;
    if (v2Node.version !== undefined) legacyNode.version = v2Node.version;
    // Always present in legacy graphs (every node in every corpus project carries
    // it), and editor code that runs before NodeGraphNode's own defaulting —
    // applyPatches in particular — dereferences it unconditionally. v2 makes it
    // optional, so restore the invariant here.
    legacyNode.parameters = v2Node.parameters ?? {};
    if (v2Node.stateParameters !== undefined) legacyNode.stateParameters = v2Node.stateParameters;
    if (v2Node.stateTransitions !== undefined) legacyNode.stateTransitions = v2Node.stateTransitions;
    if (v2Node.defaultStateTransitions !== undefined) {
      legacyNode.defaultStateTransitions = v2Node.defaultStateTransitions;
    }
    // Same invariant as `parameters`: legacy graphs always carry both (3691 of
    // 3691 nodes across the corpus projects), and `NodeGraphNode.toJSON` emits
    // them whether or not they hold anything. v2 omits them when empty, so a
    // reconstructed node that did not restore them compares unequal to the live
    // model over nothing — which surfaced as every component being permanently
    // "Changed" in the version-control panel, since `nodesSoftEqual` omits
    // `dynamicports` but not `ports`.
    legacyNode.ports = (v2Node.ports as unknown[]) ?? [];
    legacyNode.dynamicports = (v2Node.dynamicports as unknown[]) ?? [];
    if (v2Node.conflicts !== undefined) legacyNode.conflicts = v2Node.conflicts as unknown[];
    if (v2Node.metadata !== undefined) legacyNode.metadata = v2Node.metadata;

    nodeMap.set(v2Node.id, legacyNode);
  }

  // Second pass: wire up children arrays using the children ID lists
  const roots: LegacyNode[] = [];

  for (const v2Node of flatNodes) {
    const legacyNode = nodeMap.get(v2Node.id)!;

    if (v2Node.parent === undefined) {
      // No parent = root node
      roots.push(legacyNode);
    }

    // Populate children in order (children array contains IDs in order)
    if (v2Node.children && v2Node.children.length > 0) {
      legacyNode.children = v2Node.children
        .map((childId) => nodeMap.get(childId))
        .filter((n): n is LegacyNode => n !== undefined);
    }
  }

  return roots;
}

/**
 * Converts a v2 component path back to the legacy name format.
 *
 * If the component.json has a `path` field (the original legacy name),
 * use that directly for perfect round-trip fidelity.
 * Otherwise, reconstruct from the registry path.
 *
 * @param componentFile - The component.json content
 * @param registryPath - The registry key (e.g. "Header", "Pages/Home")
 * @returns The legacy component name (e.g. "/#Header", "/Pages/Home")
 */
export function toLegacyName(componentFile: ComponentV2File, registryPath: string): string {
  // Prefer the preserved original path for perfect round-trip
  if (componentFile.path) {
    return componentFile.path;
  }

  // Reconstruct from registry path
  if (registryPath.startsWith('%rootcomponent')) {
    return `/${registryPath}`;
  }
  if (registryPath.startsWith('__cloud__/')) {
    return `/#${registryPath}`;
  }
  // Default: add leading slash
  return `/${registryPath}`;
}

/**
 * Reconstructs a single LegacyComponent from its three v2 files. Pure — no
 * filesystem access.
 *
 * Extracted so a per-component loader (ComponentLoader) can reconstruct one
 * component on demand without importing the whole project. `ProjectImporter`
 * delegates to this so there is a single source of truth for the reconstruction.
 */
export function reconstructLegacyComponent(
  registryPath: string,
  componentFile: ComponentV2File,
  nodesFile: NodesV2File,
  connectionsFile: ConnectionsV2File
): LegacyComponent {
  const legacyName = toLegacyName(componentFile, registryPath);
  const roots = unflattenNodes(nodesFile.nodes ?? []);

  const connections: LegacyConnection[] = (connectionsFile.connections ?? []).map((c) => {
    const conn: LegacyConnection = {
      fromId: c.fromId,
      fromProperty: c.fromProperty,
      toId: c.toId,
      toProperty: c.toProperty
    };
    // The other half of the export's label carry — an import that dropped it
    // would still lose every wire label on the round trip (CAN-002/CAN-001).
    if (typeof c.label === 'string') conn.label = c.label;
    if (typeof c.labelT === 'number') conn.labelT = c.labelT;
    if (c.annotation) conn.annotation = c.annotation;
    return conn;
  });

  const graph: LegacyGraph = { roots, connections };

  // Restore graph-level canvas state carried in nodes.json.
  if (nodesFile.visualRoots && nodesFile.visualRoots.length > 0) {
    graph.visualRoots = nodesFile.visualRoots;
  }
  if (nodesFile.comments && nodesFile.comments.length > 0) {
    graph.comments = nodesFile.comments;
  }

  const component: LegacyComponent = {
    name: legacyName,
    graph
  };

  // Many real/imported components are id-less — do not fabricate an id key.
  if (componentFile.id !== undefined) {
    component.id = componentFile.id;
  }

  if (componentFile.metadata && Object.keys(componentFile.metadata).length > 0) {
    component.metadata = componentFile.metadata as Record<string, unknown>;
  }

  return component;
}

//  ProjectImporter

/**
 * Converts v2 multi-file project format back to the legacy project.json format.
 *
 * This class is pure  it does not touch the filesystem. The caller provides
 * all file contents and receives a LegacyProject object.
 *
 * @example
 * ```ts
 * const importer = new ProjectImporter();
 * const result = importer.import({
 *   project: JSON.parse(await fs.readFile('nodegx.project.json', 'utf-8')),
 *   registry: JSON.parse(await fs.readFile('components/_registry.json', 'utf-8')),
 *   routes: JSON.parse(await fs.readFile('nodegx.routes.json', 'utf-8')),
 *   styles: JSON.parse(await fs.readFile('nodegx.styles.json', 'utf-8')),
 *   components: {
 *     'Header': {
 *       component: JSON.parse(await fs.readFile('components/Header/component.json', 'utf-8')),
 *       nodes: JSON.parse(await fs.readFile('components/Header/nodes.json', 'utf-8')),
 *       connections: JSON.parse(await fs.readFile('components/Header/connections.json', 'utf-8')),
 *     }
 *   }
 * });
 * const legacyProject = result.project;
 * ```
 */
export class ProjectImporter {
  /**
   * Imports a v2 multi-file project into the legacy project.json format.
   *
   * @param input - All file contents needed to reconstruct the project
   * @returns ImportResult with the reconstructed project and any warnings
   */
  import(input: ImportInput): ImportResult {
    const warnings: string[] = [];

    //  1. Reconstruct metadata (merge routes + styles back in) 
    const metadata = this.reconstructMetadata(input);

    //  2. Reconstruct variants from styles file 
    const variants = this.reconstructVariants(input.styles);

    //  3. Reconstruct components 
    const components: LegacyComponent[] = [];

    for (const [registryPath, componentFiles] of Object.entries(input.components)) {
      try {
        const legacyComponent = this.reconstructComponent(
          registryPath,
          componentFiles.component,
          componentFiles.nodes,
          componentFiles.connections
        );
        components.push(legacyComponent);
      } catch (err) {
        warnings.push(
          `Failed to reconstruct component "${registryPath}": ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    //  4. Reconstruct project 
    const project: LegacyProject = {
      name: input.project.name,
      version: input.project.version,
      components
    };

    if (input.project.id !== undefined) {
      project.id = input.project.id;
    }

    if (input.project.runtimeVersion) {
      project.runtimeVersion = input.project.runtimeVersion;
    }

    if (input.project.rootNodeId !== undefined) {
      project.rootNodeId = input.project.rootNodeId;
    }

    if (input.project.lesson !== undefined) {
      project.lesson = input.project.lesson;
    }

    if (input.project.thumbnailURI !== undefined) {
      project.thumbnailURI = input.project.thumbnailURI;
    }

    if (input.project.settings && Object.keys(input.project.settings).length > 0) {
      project.settings = input.project.settings as Record<string, unknown>;
    }

    if (Object.keys(metadata).length > 0) {
      project.metadata = metadata;
    }

    if (variants.length > 0) {
      project.variants = variants;
    }

    return { project, warnings };
  }

  //  Private helpers 

  /**
   * Reconstructs the legacy project.metadata by merging:
   * - project.json metadata (non-styles, non-routes keys)
   * - routes from nodegx.routes.json
   * - styles from nodegx.styles.json
   */
  private reconstructMetadata(input: ImportInput): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};

    // Restore non-styles/non-routes metadata from project file
    if (input.project.metadata) {
      Object.assign(metadata, input.project.metadata);
    }

    // Restore routes
    if (input.routes?.routes) {
      metadata.routes = input.routes.routes;
    }

    // Restore styles. Legacy names the text-preset map `text`; v2 renames it to
    // `textStyles` (see ProjectExporter.buildStylesFile) — reverse that here.
    if (input.styles) {
      const styles: Record<string, unknown> = {};
      if (input.styles.colors) styles.colors = input.styles.colors;
      if (input.styles.textStyles) styles.text = input.styles.textStyles;
      if (Object.keys(styles).length > 0) {
        metadata.styles = styles;
      }
    }

    return metadata;
  }

  /**
   * Reconstructs legacy variants from the styles file.
   * Reverses the stateParameters  stateParamaters normalisation.
   */
  private reconstructVariants(styles?: StylesV2File): LegacyVariant[] {
    if (!styles?.variants) return [];

    return styles.variants.map((v) => {
      const variant: LegacyVariant = {
        typename: v.typename
      };

      // Most real variants carry only a typename — do not fabricate a name key.
      if (v.name !== undefined) variant.name = v.name;
      if (v.parameters !== undefined) variant.parameters = v.parameters;
      // Reverse the typo normalisation: stateParameters  stateParamaters
      if (v.stateParameters !== undefined) {
        variant.stateParamaters = v.stateParameters as Record<string, Record<string, unknown>>;
      }
      if (v.stateTransitions !== undefined) {
        variant.stateTransitions = v.stateTransitions as Record<string, Record<string, unknown>>;
      }
      if (v.defaultStateTransitions !== undefined) {
        variant.defaultStateTransitions = v.defaultStateTransitions as Record<string, unknown>;
      }
      if (v.conflicts !== undefined) {
        variant.conflicts = v.conflicts as unknown[];
      }

      return variant;
    });
  }

  /**
   * Reconstructs a single LegacyComponent from its three v2 files.
   * Delegates to the shared {@link reconstructLegacyComponent} helper.
   */
  private reconstructComponent(
    registryPath: string,
    componentFile: ComponentV2File,
    nodesFile: NodesV2File,
    connectionsFile: ConnectionsV2File
  ): LegacyComponent {
    return reconstructLegacyComponent(registryPath, componentFile, nodesFile, connectionsFile);
  }
}
