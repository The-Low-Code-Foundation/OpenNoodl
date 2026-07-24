/**
 * SUB-007: shared types for graph-native diff and merge.
 *
 * These types are the contract consumed by the diff review UI and by
 * Phase 15's AI review (AIX-003) — change them deliberately.
 * Semantics are specified in dev-docs/tasks/phase-13-format-ai-substrate/SUB-007-DESIGN.md.
 */

export type ParamMap = Record<string, unknown>;

/** Normalized node, format-agnostic. Hierarchy is parent + childIndex. */
export interface SnapshotNode {
  id: string;
  type: string;
  label?: string;
  x?: number;
  y?: number;
  variant?: string;
  version?: unknown;
  /** Parent node id; undefined means root. */
  parent?: string;
  /** Index among siblings (or among roots when parent is undefined). */
  childIndex: number;
  parameters: ParamMap;
  stateParameters?: Record<string, ParamMap>;
  stateTransitions?: Record<string, ParamMap>;
  defaultStateTransitions?: ParamMap;
  /** Instance ports (often derived from parameters). */
  ports: unknown[];
  metadata?: Record<string, unknown>;
  /** Unknown/passthrough fields preserved verbatim for round-trip fidelity. */
  rest: Record<string, unknown>;
}

export interface SnapshotConnection {
  fromId: string;
  fromProperty: string;
  toId: string;
  toProperty: string;
  rest: Record<string, unknown>;
}

export interface SnapshotComment {
  /** Real id when present, otherwise a positional key assigned by the adapter. */
  key: string;
  text: string;
  x?: number;
  y?: number;
  rest: Record<string, unknown>;
}

/** Normalized component graph. Built by adapters in GraphSnapshot.ts. */
export interface GraphSnapshot {
  name: string;
  nodes: Map<string, SnapshotNode>;
  connections: SnapshotConnection[];
  comments: SnapshotComment[];
  /** Component-level metadata (legacy component.metadata / v2 component.json metadata). */
  metadata: Record<string, unknown>;
  /**
   * Component-level extras merged per top-level key (e.g. v2 visualRoots,
   * component.json ports/type, legacy component id). Not diffed field-by-field.
   */
  extras: Record<string, unknown>;
}

/** Reference to a node embedded in changes so formatters need no graph access. */
export interface NodeRef {
  id: string;
  type: string;
  label?: string;
}

export type ChangeCategory = 'semantic' | 'cosmetic';

/** How the diff decided two nodes are "the same node" (see design doc §2). */
export type IdentitySource = 'id' | 'structural';

export interface ParamDelta {
  name: string;
  base?: unknown;
  target?: unknown;
}

export type GraphChange =
  | { kind: 'node-added'; node: NodeRef; category: 'semantic' }
  | { kind: 'node-removed'; node: NodeRef; category: 'semantic' }
  | {
      kind: 'node-recreated';
      /** Removed node (base side) and the added node it was matched to. */
      node: NodeRef;
      recreatedAs: NodeRef;
      identity: 'structural';
      params: ParamDelta[];
      category: 'semantic';
    }
  | { kind: 'node-renamed'; node: NodeRef; fromLabel?: string; toLabel?: string; category: 'semantic' }
  | { kind: 'node-type-changed'; node: NodeRef; fromType: string; toType: string; category: 'semantic' }
  | { kind: 'node-parameters-changed'; node: NodeRef; params: ParamDelta[]; category: 'semantic' }
  | {
      kind: 'node-state-changed';
      node: NodeRef;
      bundle: 'stateParameters' | 'stateTransitions' | 'defaultStateTransitions';
      state?: string;
      params: ParamDelta[];
      category: 'semantic';
    }
  | { kind: 'node-variant-changed'; node: NodeRef; fromVariant?: string; toVariant?: string; category: 'semantic' }
  | {
      kind: 'node-reparented';
      node: NodeRef;
      fromParent?: NodeRef;
      toParent?: NodeRef;
      category: 'semantic';
    }
  | { kind: 'node-reordered'; node: NodeRef; parent?: NodeRef; fromIndex: number; toIndex: number; category: 'semantic' }
  | { kind: 'node-moved'; node: NodeRef; from: { x?: number; y?: number }; to: { x?: number; y?: number }; category: 'cosmetic' }
  | { kind: 'node-ports-changed'; node: NodeRef; category: 'semantic' }
  | { kind: 'connection-added'; connection: ConnectionRef; category: 'semantic' }
  | { kind: 'connection-removed'; connection: ConnectionRef; category: 'semantic' }
  | {
      kind: 'connection-rewired';
      /** The endpoint that stayed fixed. */
      at: 'target' | 'source';
      before: ConnectionRef;
      after: ConnectionRef;
      category: 'semantic';
    }
  | { kind: 'comment-added'; commentKey: string; text: string; category: 'semantic' }
  | { kind: 'comment-removed'; commentKey: string; text: string; category: 'semantic' }
  | { kind: 'comment-changed'; commentKey: string; fromText: string; toText: string; category: 'semantic' }
  | { kind: 'comment-moved'; commentKey: string; category: 'cosmetic' }
  | { kind: 'component-renamed'; fromName: string; toName: string; category: 'semantic' }
  | { kind: 'component-metadata-changed'; path: string; base?: unknown; target?: unknown; category: 'semantic' };

/** Connection endpoints plus resolved node refs for readable rendering. */
export interface ConnectionRef {
  fromId: string;
  fromProperty: string;
  toId: string;
  toProperty: string;
  fromNode?: NodeRef;
  toNode?: NodeRef;
}

export interface ComponentDiff {
  component: string;
  changes: GraphChange[];
}

export interface ProjectDiffV2 {
  addedComponents: string[];
  removedComponents: string[];
  changedComponents: ComponentDiff[];
}

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------

export type ConflictKind =
  | 'parameter'
  | 'source-code'
  | 'state-parameter'
  | 'state-transition'
  | 'default-state-transition'
  | 'label'
  | 'variant'
  | 'typename'
  | 'ports'
  | 'delete-vs-edit'
  | 'add-add'
  | 'reparent'
  | 'orphaned'
  | 'child-order'
  | 'connection-rewire'
  | 'connection-to-deleted'
  | 'comment'
  | 'component-rename'
  | 'component-metadata'
  /** Project-level scalar (settings, styles, metadata) — see ProjectMerge.ts. */
  | 'project-setting';

export type ConflictSide = 'ours' | 'theirs';

export interface GraphConflict {
  /** Stable within a merge result: kind plus anchor plus discriminator. */
  id: string;
  kind: ConflictKind;
  /** The node this conflict anchors to, when node-scoped. */
  node?: NodeRef;
  /** Parameter/state/port/metadata discriminator, when applicable. */
  name?: string;
  state?: string;
  connection?: ConnectionRef;
  /** For delete-vs-edit / connection-to-deleted: which side deleted. */
  deletedBy?: ConflictSide;
  base?: unknown;
  ours?: unknown;
  theirs?: unknown;
  /** For source-code conflicts: diff3 output with conflict regions marked, for UI rendering. */
  mergedWithMarkers?: string;
  /** Set by applyResolution. */
  resolution?: ConflictSide;
}

export interface MergeResult {
  merged: GraphSnapshot;
  conflicts: GraphConflict[];
}
