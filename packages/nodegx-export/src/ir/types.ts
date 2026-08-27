/**
 * The export IR — the shared contract between the deterministic generators (EXP-002), AI logic
 * translation (EXP-003) and the manifest consumers (EXP-004/005/007).
 *
 * Design rationale, invariants and the determinism rules (D1–D7) live in
 * dev-docs/tasks/phase-18-code-export-v2/EXP-002-IR-DESIGN.md. The short version:
 *
 * - Plain serialisable data. No live models, no Maps, no methods. Arrays carry a defined order.
 * - Identity is adopted, never minted: node ids from the substrate, the GraphSnapshot
 *   connectionKey format for connections, component paths in "Pages/Landing" form.
 * - Parsing never drops and never fails on content. Unknown types, script parameters and
 *   statically-unknowable port sets become representable states, and later dispositions —
 *   not errors.
 * - Nothing React-shaped appears here. The analysis/emit layer owns the React mapping.
 */

export interface ExportIR {
  project: ProjectIR;
  /** Sorted by `path`, codepoint order (D1). */
  components: ComponentIR[];
}

export interface ProjectIR {
  name: string;
  catalogFormatVersion: string;
  exporterVersion: string;
  /** Source order preserved — these render as tokens.css in that order. */
  designTokens: TokenIR[];
  /** From nodegx.project.json metadata.dbCollections; typed API stubs are generated from these. */
  collections: CollectionIR[];
  /** One per Router node found in the project. */
  routers: RouterIR[];
  /**
   * Component paths under components/__cloud__ — cloud functions, executed by the backend's
   * interpreter. The frontend export skips them entirely; they surface as one report note.
   */
  cloudComponents: string[];
}

export interface TokenIR {
  /** CSS custom property name, exactly as authored ("--primary"). */
  name: string;
  value: string;
  category?: string;
  /** Authored description; becomes the comment above the token in tokens.css. */
  description?: string;
}

export interface CollectionIR {
  name: string;
  columns: Array<{ name: string; type: string }>;
}

export interface RouterIR {
  /** The Router node's `name` parameter ("Main"). */
  name: string;
  /** Component id of the node's own component, and the node's id — provenance for the manifest. */
  componentPath: string;
  nodeId: string;
  /** Legacy component path of the start page ("/Pages/Landing"). */
  startPage?: string;
  /** Legacy component paths, source order. */
  routes: string[];
}

export interface ComponentIR {
  id: string;
  /** "Pages/Landing" — component.json `path` with the leading slash stripped. */
  path: string;
  /** From component.json `type`; anything not "page" is "component". */
  role: 'page' | 'component';
  /** Source order from nodes.json (D2). */
  nodes: NodeIR[];
  /** Source order from connections.json (D2). */
  connections: ConnectionIR[];
  intent: AuthoringIntent;
}

export interface NodeIR {
  id: string;
  /** Catalog typeName, or a "/"-prefixed legacy component path for component instances. */
  type: string;
  /**
   * The catalog typeName this node resolved against, or null for component instances and types
   * the catalog does not know (old projects). Ports beyond `declaredPorts` are looked up in the
   * catalog through this reference rather than embedded per node.
   */
  catalogRef: string | null;
  /**
   * Present only when the serialized `label` key was present in nodes.json. Never read through a
   * live model's defaulting getter (EXP-006's trap: that emits a title for every node).
   */
  authoredLabel?: string;
  /** Sorted by name (D3). */
  parameters: ParamIR[];
  /** The node's own `dynamicports` declarations, as-written. Catalog ports are not duplicated here. */
  declaredPorts: PortIR[];
  /**
   * 'complete'  — catalog entry with dynamicPorts: null, or a component instance whose interface
   *               is its Component Inputs/Outputs.
   * 'partial'   — the catalog marks this type's port set as parameter-dependent (dynamicPorts
   *               non-null); declaredPorts + catalog cover what is statically knowable.
   * 'unknown'   — ports only execution reveals (Function-style nodes). EXP-003 back-fills
   *               `resolvedPorts` from traces.
   */
  portKnowledge: 'complete' | 'partial' | 'unknown';
  /** Written by EXP-003 from trace data; absent until then. */
  resolvedPorts?: PortIR[];
  /**
   * Verbatim author-written code for script-bearing nodes (Function, Expression, mapping
   * scripts). This is the EXP-003 LLM payload and the preserved-as-comment fallback when a
   * translation stays unverified. Never trimmed, never reformatted.
   */
  sourceText?: string;
  parent?: string;
  /** Visual children, order = render order (D2). */
  children?: string[];
}

export interface ParamIR {
  name: string;
  value: ParamValue;
}

export type ParamValue =
  /** Strings (including "var(--token)" references, kept textual), numbers, booleans. */
  | { kind: 'literal'; value: string | number | boolean }
  /** {value: 340, unit: "px"} objects. */
  | { kind: 'dimension'; value: number; unit: string }
  /** An expression parameter — any input may carry one, evaluated live in the interpreter. */
  | { kind: 'expression'; source: string }
  /** Code-editor-typed parameters (mapping scripts, function bodies). */
  | { kind: 'script'; source: string }
  /** Structured editor values (query filters, sort specs, router page sets). */
  | { kind: 'json'; value: unknown };

export interface PortIR {
  name: string;
  plug: 'input' | 'output';
  /**
   * Never flattened: EXP-003's equivalence rules count and order signals, and the emit rule that
   * value outputs land before the signal that follows them depends on knowing which is which.
   */
  kind: 'value' | 'signal';
  /** Port type name when declared ("string", "boolean", "component", …). */
  type?: string;
  default?: unknown;
}

export interface ConnectionIR {
  /**
   * `${fromId}:${fromProperty}->${toId}:${toProperty}` — the GraphSnapshot.connectionKey format,
   * adopted verbatim because EXP-006's wire labels are keyed by exactly this string.
   */
  key: string;
  fromId: string;
  fromProperty: string;
  toId: string;
  toProperty: string;
  /** The source port's kind. 'value' when it cannot be determined statically (reported, not guessed). */
  kind: 'value' | 'signal';
  /**
   * Author-written wire label. Irrecoverable if dropped — the wire itself vanishes in generated
   * code, so this must land as a comment on the statement the wire becomes.
   */
  label?: string;
}

/** CAN-005's authoring-intent bundle, in serialisable form. */
export interface AuthoringIntent {
  nodeComments: Array<{ nodeId: string; text: string }>;
  wireLabels: Array<{ connectionKey: string; text: string }>;
  /** Ordered, outermost first. */
  regions: Array<{ text: string; nodeIds: string[] }>;
  componentDescription?: string;
}

/**
 * Dispositions are analysis output about the graph, not facts of it — they live in the manifest
 * (ExportManifest.nodes), never on NodeIR.
 */
export type Disposition =
  | { kind: 'static' }
  | { kind: 'collapsed'; into: string }
  | { kind: 'deferred'; to: 'EXP-003'; reason: string }
  | { kind: 'stubbed'; reason: string }
  | { kind: 'unknown-type'; reason: string };

/** The durable sidecar emitted beside the code — see EXP-002-IR-DESIGN.md "The manifest". */
export interface ExportManifest {
  exporterVersion: string;
  catalogFormatVersion: string;
  files: ManifestFile[];
  nodes: ManifestNode[];
  /** EXP-006's rule: nothing silently dropped. */
  dropped: Array<{ what: string; where: string; reason: string }>;
}

export interface ManifestFile {
  path: string;
  kind: 'component' | 'page' | 'store' | 'logic' | 'api-stub' | 'styles' | 'scaffold';
  sources: Array<{ componentPath: string; nodeIds: string[] }>;
  /** SHA-256 of the body excluding the provenance header. */
  contentHash: string;
}

export interface ManifestNode {
  componentPath: string;
  nodeId: string;
  disposition: Disposition;
  emittedAs?: Array<{ file: string; symbol: string }>;
  /** Written by EXP-003; EXP-005 must propagate it, never drop it at the framework boundary. */
  verdict?: 'verified' | 'mismatched' | 'unverified';
}
