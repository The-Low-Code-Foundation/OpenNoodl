/**
 * TypeScript interfaces for the Canvas Highlighting API
 *
 * This system enables persistent, multi-channel highlighting of nodes and connections
 * on the canvas, used by Data Lineage and Impact Radar visualization views.
 */

/**
 * Options for creating a highlight
 */
export interface HighlightOptions {
  /** Channel identifier (e.g., 'lineage', 'impact', 'selection') */
  channel: string;

  /** Override the default channel color */
  color?: string;

  /** Visual style for the highlight */
  style?: 'solid' | 'glow' | 'pulse';

  /** Whether highlight persists across navigation (default: true) */
  persistent?: boolean;

  /** Optional label to display near the highlight */
  label?: string;
}

/**
 * Reference to a connection between two nodes
 */
export interface ConnectionRef {
  fromNodeId: string;
  fromPort: string;
  toNodeId: string;
  toPort: string;
}

/**
 * Definition of a path through the node graph
 */
export interface PathDefinition {
  /** Ordered list of node IDs in the path */
  nodes: string[];

  /** Connections between the nodes */
  connections: ConnectionRef[];

  /** Whether this path crosses component boundaries */
  crossesComponents?: boolean;

  /** Component boundaries crossed by this path */
  componentBoundaries?: ComponentBoundary[];
}

/**
 * Information about a component boundary crossing
 *
 * Represents a transition where a highlighted path crosses from one component to another.
 */
export interface ComponentBoundary {
  /** Component where the path is coming from */
  fromComponent: string;

  /** Component where the path is going to */
  toComponent: string;

  /** Direction of crossing: 'up' = to parent, 'down' = to child */
  direction: 'up' | 'down';

  /** Node ID at the edge of the visible component where path crosses */
  edgeNodeId: string;

  /** Optional: Component Input node ID (for 'down' direction) */
  entryNodeId?: string;

  /** Optional: Component Output node ID (for 'up' direction) */
  exitNodeId?: string;
}

/**
 * Handle for controlling an active highlight
 */
export interface IHighlightHandle {
  /** Unique identifier for this highlight */
  readonly id: string;

  /** Channel this highlight belongs to */
  readonly channel: string;

  /** Update the highlighted nodes */
  update(nodeIds: string[]): void;

  /** Update the label */
  setLabel(label: string): void;

  /** Remove this highlight */
  dismiss(): void;

  /** Check if this highlight is still active */
  isActive(): boolean;

  /** Get the current node IDs */
  getNodeIds(): string[];

  /** Get the current connection refs */
  getConnections(): ConnectionRef[];
}

/**
 * Information about an active highlight
 */
export interface HighlightInfo {
  id: string;
  channel: string;
  nodeIds: string[];
  connections: ConnectionRef[];
  options: HighlightOptions;
  createdAt: Date;
}

/**
 * Internal state for a highlight
 */
export interface HighlightState {
  id: string;
  channel: string;
  allNodeIds: string[];
  allConnections: ConnectionRef[];
  visibleNodeIds: string[];
  visibleConnections: ConnectionRef[];
  componentBoundaries?: ComponentBoundary[];
  options: HighlightOptions;
  createdAt: Date;
  active: boolean;
}

/**
 * Channel configuration
 */
export interface ChannelConfig {
  color: string;
  style: 'solid' | 'glow' | 'pulse';
  description: string;
  zIndex?: number;
}

/**
 * Events emitted by HighlightManager
 */
export type HighlightManagerEvent =
  | 'highlightAdded'
  | 'highlightRemoved'
  | 'highlightUpdated'
  | 'channelCleared'
  | 'allCleared';

/**
 * Callback for highlight events
 */
export type HighlightEventCallback = (data: {
  highlightId?: string;
  channel?: string;
  highlight?: HighlightInfo;
}) => void;
