/**
 * OpenNoodl v2 Project Format — Schema Exports
 *
 * Central export point for all JSON schemas, the validator, and related types.
 *
 * Usage:
 * ```ts
 * import { SchemaValidator, SCHEMA_IDS, validateSchema } from '@noodl-schemas';
 * // or
 * import { SchemaValidator } from '../../schemas';
 * ```
 *
 * @module noodl-editor/schemas
 * @since 1.2.0
 */

// ─── Schema JSON files ────────────────────────────────────────────────────────

export { default as projectV2Schema } from './project-v2.schema.json';
export { default as componentSchema } from './component.schema.json';
export { default as nodesSchema } from './nodes.schema.json';
export { default as connectionsSchema } from './connections.schema.json';
export { default as registrySchema } from './registry.schema.json';
export { default as routesSchema } from './routes.schema.json';
export { default as stylesSchema } from './styles.schema.json';
export { default as modelSchema } from './model.schema.json';

// ─── Validator ────────────────────────────────────────────────────────────────

export {
  SchemaValidator,
  validateSchema,
  formatValidationErrors,
  SCHEMA_IDS
} from './validator';

export type { ValidationResult, ValidationError, SchemaId } from './validator';

// ─── TypeScript interfaces for v2 format files ────────────────────────────────

/**
 * Root project metadata (nodegx.project.json)
 */
export interface ProjectV2File {
  $schema?: string;
  name: string;
  id?: string;
  version: string;
  nodegxVersion: string;
  runtimeVersion?: 'react17' | 'react19';
  created?: string;
  modified?: string;
  settings?: {
    rootComponent?: string;
    defaultRoute?: string;
    bodyScroll?: boolean;
    headCode?: string;
    htmlTitle?: string;
    navigationPathType?: string;
    responsive?: { breakpoints?: string[] };
    [key: string]: unknown;
  };
  structure?: {
    componentsDir?: string;
    modelsDir?: string;
    assetsDir?: string;
  };
  /**
   * ID of the **node** the runtime mounts as the app root — not a component id.
   * It names one top-level node inside one component (typically the Page Router
   * in `/App`); the export derives `rootComponent` from whichever component owns
   * it. Without it `Exporter.exportToJSON` returns nothing and the app renders
   * blank, so any tool authoring a project from scratch must set it.
   */
  rootNodeId?: string;
  /** Lesson/tutorial payload attached to the project (interactive-lesson projects). */
  lesson?: unknown;
  /** Data-URI or path to the project thumbnail shown in the launcher. */
  thumbnailURI?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Port definition used in component.json
 */
export interface PortDefinition {
  name: string;
  type: string | Record<string, unknown>;
  displayName?: string;
  description?: string;
  default?: unknown;
  required?: boolean;
  group?: string;
  index?: number;
  plug?: 'input' | 'output' | 'input/output';
  [key: string]: unknown;
}

/**
 * Component metadata file (component.json)
 */
export interface ComponentV2File {
  $schema?: string;
  id: string;
  name: string;
  displayName?: string;
  path?: string;
  type: 'root' | 'page' | 'visual' | 'logic' | 'cloud';
  description?: string;
  category?: string;
  tags?: string[];
  ports?: {
    inputs?: PortDefinition[];
    outputs?: PortDefinition[];
  };
  dependencies?: string[];
  settings?: Record<string, unknown>;
  created?: string;
  modified?: string;
  modifiedBy?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Port definition used in nodes.json
 */
export interface NodePort {
  name: string;
  type?: string | Record<string, unknown>;
  displayName?: string;
  plug?: string;
  group?: string;
  index?: number;
  default?: unknown;
  [key: string]: unknown;
}

/**
 * Single node entry in nodes.json
 */
export interface NodeV2 {
  id: string;
  type: string;
  label?: string;
  x?: number;
  y?: number;
  variant?: string;
  version?: number;
  parameters?: Record<string, unknown>;
  stateParameters?: Record<string, Record<string, unknown>>;
  stateTransitions?: Record<string, Record<string, unknown>>;
  defaultStateTransitions?: Record<string, unknown>;
  ports?: NodePort[];
  dynamicports?: NodePort[];
  children?: string[];
  parent?: string;
  conflicts?: Record<string, unknown>[];
  annotation?: 'Deleted' | 'Created' | 'Changed';
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Nodes file (nodes.json)
 */
export interface NodesV2File {
  $schema?: string;
  componentId: string;
  version?: number;
  nodes: NodeV2[];
  /** IDs of nodes that are visual roots of the component graph (canvas roots). */
  visualRoots?: string[];
  /** Free-floating comment/annotation boxes drawn on the graph canvas. */
  comments?: unknown[];
}

/**
 * Single connection entry in connections.json
 */
export interface ConnectionV2 {
  fromId: string;
  fromProperty: string;
  toId: string;
  toProperty: string;
  annotation?: 'Deleted' | 'Changed' | 'Created';
  [key: string]: unknown;
}

/**
 * Connections file (connections.json)
 */
export interface ConnectionsV2File {
  $schema?: string;
  componentId: string;
  version?: number;
  connections: ConnectionV2[];
}

/**
 * Single entry in the component registry
 */
export interface RegistryComponentEntry {
  path: string;
  type: 'root' | 'page' | 'visual' | 'logic' | 'cloud';
  route?: string;
  created?: string;
  modified?: string;
  nodeCount?: number;
  connectionCount?: number;
}

/**
 * Component registry file (_registry.json)
 */
export interface RegistryV2File {
  $schema?: string;
  version: number;
  lastUpdated?: string;
  components: Record<string, RegistryComponentEntry>;
  stats?: {
    totalComponents: number;
    totalNodes: number;
    totalConnections: number;
  };
}

/**
 * Single route definition in routes.json
 */
export interface RouteDefinition {
  path: string;
  component: string;
  title?: string;
  exact?: boolean;
  redirect?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Routes file (nodegx.routes.json)
 */
export interface RoutesV2File {
  $schema?: string;
  version?: number;
  routes: RouteDefinition[];
  notFound?: string;
}

/**
 * Styles file (nodegx.styles.json)
 */
export interface StylesV2File {
  $schema?: string;
  version?: number;
  colors?: Record<string, string>;
  textStyles?: Record<string, Record<string, unknown>>;
  variants?: Array<{
    name: string;
    typename: string;
    parameters?: Record<string, unknown>;
    stateParameters?: Record<string, Record<string, unknown>>;
    stateTransitions?: Record<string, Record<string, unknown>>;
    defaultStateTransitions?: Record<string, unknown>;
    conflicts?: unknown[];
    [key: string]: unknown;
  }>;
  tokens?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Model field definition
 */
export interface ModelField {
  name: string;
  type: 'String' | 'Number' | 'Boolean' | 'Date' | 'Object' | 'Array' | 'Pointer' | 'Relation' | 'File' | 'GeoPoint';
  displayName?: string;
  description?: string;
  required?: boolean;
  default?: unknown;
  targetClass?: string;
  unique?: boolean;
}

/**
 * Model definition file (models/<Name>.json)
 */
export interface ModelV2File {
  $schema?: string;
  name: string;
  displayName?: string;
  description?: string;
  className?: string;
  fields: ModelField[];
  indexes?: Array<{
    name?: string;
    fields: string[];
    unique?: boolean;
  }>;
  acl?: Record<string, unknown>;
  created?: string;
  modified?: string;
  metadata?: Record<string, unknown>;
}
