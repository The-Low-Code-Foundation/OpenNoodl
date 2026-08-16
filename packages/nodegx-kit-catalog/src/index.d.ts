/**
 * Hand-written declarations for `@nodegx/kit-catalog`.
 *
 * Hand-written on purpose: this package has **no build step**, which is what
 * lets a plain-JS extractor and the TypeScript editor share one mapping in a
 * fresh checkout. That buys the shared mapping and costs this file — it is not
 * generated, so it drifts if you change `index.js` without changing it.
 * `@nodegx/module-inject` and `@nodegx/render-measure` make the same trade for
 * the same reason.
 */

/** A port as `generateNodeLibrary` exports it (`@noodl/runtime/src/nodelibraryexport`). */
export interface ExportedPort {
  name: string;
  /** Either a bare type name (`"string"`) or a spec object. Both occur. */
  type: unknown;
  plug: string;
  group?: unknown;
  displayName?: unknown;
  description?: unknown;
  editorName?: unknown;
  default?: unknown;
  index?: unknown;
  allowVisualStates?: unknown;
  [extra: string]: unknown;
}

/** One entry of the payload's `nodetypes` list. */
export interface ExportedNodeType {
  name: string;
  displayNodeName?: string;
  category?: string;
  /**
   * The module that registered this type. `NoodlRuntime.registerModule` stamps
   * it, so its presence is what distinguishes a kit node from a built-in — this
   * package keys off it rather than off a name prefix.
   */
  module?: string;
  docs?: string;
  shortDocs?: string;
  searchTags?: unknown;
  deprecated?: boolean;
  singleton?: boolean;
  allowAsChild?: boolean;
  allowAsExportRoot?: unknown;
  allowChildrenWithCategory?: unknown;
  useVariants?: unknown;
  visualStates?: unknown;
  dynamicports?: unknown[];
  ports?: ExportedPort[];
  [extra: string]: unknown;
}

/** The blob the viewer sends over `sendNodeLibrary`, and what a headless extractor produces. */
export interface NodeLibraryPayload {
  nodetypes: ExportedNodeType[];
  [extra: string]: unknown;
}

export interface OverlayPortType {
  name: string;
  [extra: string]: unknown;
}

/** Catalog-shaped port. Structurally assignable to `CatalogPort`. */
export interface OverlayCatalogPort {
  name: string;
  plug: 'input' | 'output';
  type: OverlayPortType;
  isSignal: boolean;
  displayName?: unknown;
  editorName?: unknown;
  group?: unknown;
  default?: unknown;
  description?: unknown;
  index?: unknown;
  allowVisualStates?: unknown;
}

/**
 * One conditionally-declared group of ports, in the shape the shipped catalog
 * stores and every consumer reads (`conditionForInput`,
 * `CatalogIndex.computePortNames`). ⚠️ **Not** the shape `formatDynamicPorts`
 * exports — see `toDynamicPorts` for the translation and why it matters.
 */
export interface OverlayDeclaredPortGroup {
  condition?: string;
  inputs?: string[];
  outputs?: string[];
}

export interface OverlayDynamicPortInfo {
  /**
   * `declared-port-groups` when the node has an enumerable conditional set,
   * `runtime-discovered` when it mints ports at runtime, both when it does both.
   * A node whose every entry is unrecognised gets `runtime-discovered`, because
   * the conservative answer costs a skipped check rather than a false warning on
   * a correct kit.
   */
  mechanisms: string[];
  description: string;
  /** Absent — never `[]` — when the node declares no enumerable group. */
  declaredPortGroups?: OverlayDeclaredPortGroup[];
}

/**
 * A catalog entry for a node a project's own kit declares.
 *
 * Deliberately **not** `CatalogNode`: that type's `typeName` is a union of the
 * shipped type names and its `providedBy` a union of the four shipped sources,
 * and `node-catalog.d.ts` is generated — a kit type belongs to neither union and
 * widening them would mean editing a generated file.
 */
export interface OverlayCatalogNode {
  typeName: string;
  displayName: string;
  category?: string;
  isVisual: boolean;
  isDeprecated: boolean;
  inNodePicker: boolean;
  availableIn: string[];
  providedBy: 'project-kit';
  /** The `noodl_modules` directory / module name that declared this node. */
  kitModule: string;
  docs?: string;
  searchTags?: unknown;
  module?: string;
  shortDesc?: string;
  singleton?: boolean;
  allowAsChild?: boolean;
  allowChildrenWithCategory?: unknown;
  allowAsExportRoot?: unknown;
  useVariants?: boolean;
  visualStates?: unknown;
  inputs: OverlayCatalogPort[];
  outputs: OverlayCatalogPort[];
  dynamicPorts: OverlayDynamicPortInfo | null;
  /**
   * Always `{ known: false }` today — the key formulas are derived by driving
   * the node, which the payload cannot express. Never absent: a gap must not be
   * able to pass for "nothing to say". CN-010 owns closing it.
   */
  parameterEncoding: { known: false; reason: string };
}

/** A kit type name that shadows a shipped one. Built-ins win; this is what gets reported. */
export interface OverlayCollision {
  typeName: string;
  kitModule: string;
}

export interface Overlay {
  nodes: OverlayCatalogNode[];
  collisions: OverlayCollision[];
}

/** The subset of `NodeCatalog` the merge touches. */
export interface NodeCatalogLike {
  nodes: unknown[];
  portTypeNames?: string[];
  [extra: string]: unknown;
}

export interface OverlayDivergence {
  typeName: string;
  kind: 'type-missing' | 'field-differs' | 'port-missing' | 'port-type-differs';
  field?: string;
  plug?: 'input' | 'output';
  port?: string;
  detail: string;
}

export interface OverlayComparison {
  agree: boolean;
  divergences: OverlayDivergence[];
  labelA: string;
  labelB: string;
}

export declare const KIT_PROVENANCE: 'project-kit';

export declare function normalizePortType(type: unknown): OverlayPortType;

export declare function catalogNodesFromNodeLibrary(
  payload: NodeLibraryPayload,
  options?: {
    /** Shipped catalog type names. A kit type matching one is reported, not merged. */
    builtinTypeNames?: Iterable<string>;
    /** Module name → its manifest `runtimes`, so a cloud-only kit is not claimed browser-available. */
    moduleRuntimes?: Record<string, string[]>;
  }
): Overlay;

export declare function mergeOverlay(catalog: NodeCatalogLike, overlayNodes: OverlayCatalogNode[]): NodeCatalogLike;

export declare function compareOverlays(
  a: OverlayCatalogNode[],
  b: OverlayCatalogNode[],
  labels?: { labelA?: string; labelB?: string }
): OverlayComparison;

export declare function describeComparison(comparison: OverlayComparison): string;
