/**
 * ProjectTemplate
 *
 * Defines the structure for project templates that can be used
 * to create new projects with pre-configured components and settings.
 *
 * @module noodl-editor/models/template
 */

/**
 * Represents a complete project template structure
 */
export interface ProjectTemplate {
  /** Unique identifier for the template */
  id: string;

  /** Display name of the template */
  name: string;

  /** Description of what the template provides */
  description: string;

  /**
   * Category for grouping templates.
   *
   * 🔴 **THE PLATFORM'S VOCABULARY IS CANONICAL, INCLUDING HERE** — ruled 2026-08-26 between
   * FB-005 T4 and phase 76. One of `starter`, `data-app`, `dashboard`, `site`, `form`,
   * `integration`, matching `0020`'s `project_template_category_known` in `nodegx-community`.
   *
   * ⚠️ The type cannot say so — this is a plain `string`, and the vocabulary is a CHECK
   * constraint in another repository. `EMBEDDED_TEMPLATE_CATEGORIES` in
   * `tests-unit/fb-005/template-shelf.test.ts` is what enforces it, and it is the copy that can
   * drift; see its comment for what a drift costs.
   *
   * **Why it matters at all**, given nothing branches on it: FB-005 T3's picker draws embedded and
   * platform templates in **one list**. This was free text until the ruling, and `hello-world`
   * said *"Getting Started"* — so a category facet bar (T4) would have shown a prose title beside
   * six slugs, as a facet of exactly one row.
   */
  category: string;

  /** Template version (semver) */
  version: string;

  /** Optional thumbnail/icon URL for UI display */
  thumbnail?: string;

  /** The actual project content */
  content: ProjectContent;
}

/**
 * The core content structure of a Noodl project
 */
export interface ProjectContent {
  /** Project name (will be overridden by user input) */
  name: string;

  /** Name of the root component that serves as the entry point */
  rootComponent?: string;

  /**
   * Id of the root node (the "home"). Resolved from `rootComponent` at
   * instantiation time so the home component is set deterministically,
   * independent of NodeLibrary state. Present on serialized project.json.
   */
  rootNodeId?: string;

  /** Array of component definitions */
  components: ComponentDefinition[];

  /** Project-level settings */
  settings?: ProjectSettings;

  /** Project metadata */
  metadata?: ProjectMetadata;
}

/**
 * Definition of a single component in the project
 */
export interface ComponentDefinition {
  /** Component name (e.g., "App", "/#__page__/Home") */
  name: string;

  /** Component graph structure */
  graph?: ComponentGraph;

  /** Whether this is a visual component */
  visual?: boolean;

  /** Component ID (optional, will be generated if not provided) */
  id?: string;

  /** Port definitions for the component */
  ports?: PortDefinition[];

  /** Visual state transitions (for visual components) */
  visualStateTransitions?: unknown[];

  /** Component metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Component graph containing nodes and connections
 */
export interface ComponentGraph {
  /** Root nodes in the component */
  roots: NodeDefinition[];

  /** Connections between nodes */
  connections: ConnectionDefinition[];

  /** Comments in the graph (required by NodeGraphModel) */
  comments?: unknown[];
}

/**
 * Definition of a single node in the component graph
 */
export interface NodeDefinition {
  /** Unique node ID */
  id: string;

  /** Node type (e.g., "Group", "Text", "PageRouter") */
  type: string;

  /** X position on canvas */
  x: number;

  /** Y position on canvas */
  y: number;

  /** Node parameters/properties */
  parameters: Record<string, unknown>;

  /** Port definitions */
  ports?: PortDefinition[];

  /** Child nodes (for visual hierarchy) */
  children?: NodeDefinition[];

  /** Variant (for some node types) */
  variant?: string;

  /** State parameters (for state nodes) */
  stateParameters?: Record<string, unknown>;

  /** State transitions (for state nodes) */
  stateTransitions?: unknown[];
}

/**
 * Connection between two nodes
 */
export interface ConnectionDefinition {
  /** Source node ID */
  fromId: string;

  /** Source port/property name */
  fromProperty: string;

  /** Target node ID */
  toId: string;

  /** Target port/property name */
  toProperty: string;
}

/**
 * Port definition for components/nodes
 */
export interface PortDefinition {
  /** Port name */
  name: string;

  /** Port type (e.g., "string", "number", "signal") */
  type: string;

  /** Port direction ("input" or "output") */
  plug: 'input' | 'output';

  /** Port index (for ordering) */
  index?: number;

  /** Default value */
  default?: unknown;

  /** Display name */
  displayName?: string;

  /** Port group */
  group?: string;
}

/**
 * Project-level settings
 */
export interface ProjectSettings {
  /** Project settings go here */
  [key: string]: unknown;
}

/**
 * Project metadata
 */
export interface ProjectMetadata {
  /** Project title */
  title?: string;

  /** Project description */
  description?: string;

  /** Other metadata fields */
  [key: string]: unknown;
}
