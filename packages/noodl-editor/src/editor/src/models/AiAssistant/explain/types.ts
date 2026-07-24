/**
 * AIX-004 — Explain Mode: context model
 *
 * The types here describe *what the model is shown*, and nothing else. They sit
 * deliberately between the editor's graph models and the prompt: assembly reads
 * a source-agnostic `ExplainGraph` (see ./graph) and produces an
 * `ExplainContext`, which ./render turns into text. Keeping that middle step a
 * plain data structure is what makes context bounding testable — a spec can
 * assert on what was included and what was dropped without going near a
 * provider.
 *
 * @module AiAssistant/explain/types
 */

/** What the user asked about. */
export type ExplainScope = 'node' | 'subgraph' | 'component';

// ── Source-agnostic graph shape (see ./graph for the adapters) ────────────────

export interface GraphNode {
  id: string;
  /** Node type exactly as authored — a catalog type name or a component ref. */
  type: string;
  /** The user's label for this node, when they set one. */
  label?: string;
  /** Authored parameter values, keyed by port name. */
  parameters: Record<string, unknown>;
  /** Parent node id in the visual hierarchy. */
  parent?: string;
  children: string[];
  /**
   * Ports serialised on the *instance* — component instances and dynamic-port
   * nodes carry ports the catalog cannot enumerate, and those are frequently
   * the interesting ones.
   */
  instancePorts: string[];
  /** A user comment attached to the node, when present. */
  comment?: string;
}

export interface GraphConnection {
  fromId: string;
  fromProperty: string;
  toId: string;
  toProperty: string;
}

export interface GraphComponent {
  /** Component identifier, e.g. "/#Home" or "/Pages/About". */
  name: string;
  nodes: GraphNode[];
  connections: GraphConnection[];
}

export interface ExplainGraph {
  components: GraphComponent[];
}

// ── Assembled context ─────────────────────────────────────────────────────────

/** How a node came to be in the context. */
export type NodeRole =
  | 'selected'
  /** Feeds one of the selected nodes. */
  | 'upstream'
  /** Is fed by one of the selected nodes. */
  | 'downstream'
  /** Parent or child in the visual hierarchy of a selected node. */
  | 'container'
  /** Present for shape only, in a component-scope overview. */
  | 'peer';

export interface ContextPort {
  name: string;
  displayName?: string;
  /** Port value type name, e.g. "string", "signal". */
  type?: string;
  isSignal?: boolean;
  /** Authored port semantics from SUB-005's enrichment. */
  description?: string;
}

/** A node as the model sees it. */
export interface ContextNode {
  id: string;
  type: string;
  /** Catalog display name, falling back to the type string. */
  displayName: string;
  label?: string;
  role: NodeRole;
  comment?: string;
  /**
   * Parameters actually worth showing — empty and default-valued ones are
   * dropped during assembly, and long values are truncated.
   */
  parameters: Array<{ name: string; value: string; truncated?: boolean }>;
  /** True when assembly dropped parameters to stay inside the budget. */
  parametersOmitted?: number;
  /** Set when the node is a project component instance rather than a library node. */
  isComponentInstance?: boolean;
}

/** A node type's documentation, included once per distinct type in context. */
export interface ContextNodeType {
  typeName: string;
  displayName: string;
  category?: string;
  isVisual?: boolean;
  summary?: string;
  description?: string;
  whenToUse?: string;
  /** Present only for nodes that create ports at runtime. */
  runtimeBehavior?: string;
  /** Only the ports that this context actually references. */
  ports: ContextPort[];
  /** True when the type is not in the catalog at all (module or legacy node). */
  unknown?: boolean;
}

export interface ContextConnection extends GraphConnection {
  /** True when the connection carries a signal rather than a value. */
  isSignal?: boolean;
}

/** A component-shape overview, included for the component scope. */
export interface ContextComponentShape {
  name: string;
  nodeCount: number;
  connectionCount: number;
  /** The component's own input/output ports, as its parents see them. */
  inputPorts: string[];
  outputPorts: string[];
  /** Node type counts, most frequent first — cheap structural signal. */
  typeCounts: Array<{ type: string; count: number }>;
  /** Visual root ids, which is where a reader's eye starts. */
  visualRoots: string[];
}

/** What assembly had to leave out, so both the prompt and the UI can say so. */
export interface ContextBounds {
  /** Nodes in the component that were not included at all. */
  nodesOmitted: number;
  /** Connections between included nodes that were dropped. */
  connectionsOmitted: number;
  /** True when any bound was hit — the prompt tells the model to hedge. */
  truncated: boolean;
  /** Human-readable notes about each bound that bit. */
  notes: string[];
}

export interface ExplainContext {
  scope: ExplainScope;
  /** The component the selection lives in. */
  component: ContextComponentShape;
  /** Ids of the nodes the user actually asked about. */
  selectedIds: string[];
  nodes: ContextNode[];
  connections: ContextConnection[];
  nodeTypes: ContextNodeType[];
  bounds: ContextBounds;
  /** Rough size accounting, logged so context growth is observable. */
  stats: {
    nodeCount: number;
    connectionCount: number;
    nodeTypeCount: number;
    /** Character length of the rendered context block. */
    renderedChars: number;
  };
}

/** Tunables for assembly. Defaults live in ./assemble. */
export interface ExplainContextOptions {
  /** How many connection hops out from the selection to follow. */
  neighbourDepth?: number;
  /** Hard cap on nodes in context. */
  maxNodes?: number;
  /** Hard cap on parameters shown per node. */
  maxParametersPerNode?: number;
  /** Characters before a parameter value is truncated. */
  maxParameterChars?: number;
  /** Hard cap on distinct node types documented. */
  maxNodeTypes?: number;
}
