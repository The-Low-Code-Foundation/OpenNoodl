/**
 * Data Lineage Analysis
 *
 * Traces the complete upstream (source) and downstream (destination) paths for data flow,
 * crossing component boundaries to provide a full picture of where values come from and where they go.
 *
 * @module graphAnalysis/lineage
 * @since 1.3.0
 */

import type { ComponentModel } from '@noodl-models/componentmodel';
import type { NodeGraphNode } from '@noodl-models/nodegraphmodel';
import type { ProjectModel } from '@noodl-models/projectmodel';

import { resolveComponentBoundary } from './crossComponent';
import { getPortConnections } from './traversal';
import type { ConnectionRef } from './types';

/**
 * Complete lineage result for a node/port
 */
export interface LineageResult {
  /** The node/port being analyzed */
  selectedNode: {
    id: string;
    label: string;
    type: string;
    componentName: string;
    port?: string;
  };

  /** Upstream path (where data comes from) */
  upstream: LineagePath;

  /** Downstream paths (where data goes to) - can branch to multiple destinations */
  downstream: LineagePath[];
}

/**
 * A path through the graph showing data flow
 */
export interface LineagePath {
  /** Ordered steps in this path */
  steps: LineageStep[];

  /** Component boundary crossings in this path */
  crossings: ComponentBoundary[];

  /** Whether this path branches into multiple destinations */
  branches?: boolean;
}

/**
 * A single step in a lineage path
 */
export interface LineageStep {
  /** The node at this step */
  node: NodeGraphNode;

  /** Component containing this node */
  component: ComponentModel;

  /** Port name */
  port: string;

  /** Port direction */
  portType: 'input' | 'output';

  /** Optional description of transformation (e.g., ".name property", "Expression: {a} + {b}") */
  transformation?: string;

  /** True if this is the ultimate source (no further upstream) */
  isSource?: boolean;

  /** True if this is a final destination (no further downstream) */
  isSink?: boolean;

  /** Connection leading to/from this step */
  connection?: ConnectionRef;
}

/**
 * Information about crossing a component boundary
 */
export interface ComponentBoundary {
  /** Component we're leaving */
  from: ComponentModel;

  /** Component we're entering */
  to: ComponentModel;

  /** Port name at the boundary */
  viaPort: string;

  /** Direction of crossing */
  direction: 'into' | 'outof';

  /** Index in the steps array where this crossing occurs */
  stepIndex: number;
}

/**
 * Build complete lineage for a node, tracing both upstream and downstream paths.
 *
 * @param project - Project containing all components
 * @param component - Component containing the starting node
 * @param nodeId - ID of the node to trace
 * @param port - Optional specific port to trace (if omitted, traces all connections)
 * @returns Complete lineage result with upstream and downstream paths
 *
 * @example
 * ```typescript
 * const lineage = buildLineage(project, component, textNodeId, 'text');
 * console.log('Source:', lineage.upstream.steps[0].node.label);
 * console.log('Destinations:', lineage.downstream.map(p => p.steps[p.steps.length - 1].node.label));
 * ```
 */
export function buildLineage(
  project: ProjectModel,
  component: ComponentModel,
  nodeId: string,
  port?: string
): LineageResult | null {
  const node = component.graph.nodeMap.get(nodeId);
  if (!node) {
    return null;
  }

  const selectedNode = {
    id: node.id,
    label: node.label || node.typename,
    type: node.typename,
    componentName: component.name,
    port
  };

  // Trace upstream (find sources)
  const upstream = traceUpstream(project, component, node, port);

  // Trace downstream (find all destinations)
  const downstream = traceDownstream(project, component, node, port);

  return {
    selectedNode,
    upstream,
    downstream
  };
}

/**
 * Trace upstream to find the source(s) of data.
 * Follows connections backwards through the graph and across component boundaries.
 */
/**
 * Primary data ports by node type - only trace these ports for focused results
 */
const PRIMARY_DATA_PORTS: Record<string, string[]> = {
  Variable: ['value'],
  Variable2: ['value'],
  String: ['value'],
  Number: ['value'],
  Boolean: ['value'],
  Object: ['value'],
  Array: ['value'],
  Text: ['text'],
  Image: ['src'],
  Component: [], // Skip visual components entirely for primary tracing
  Group: [] // Skip layout components
};

export function traceUpstream(
  project: ProjectModel,
  component: ComponentModel,
  startNode: NodeGraphNode,
  startPort?: string,
  visited: Set<string> = new Set(),
  depth: number = 0
): LineagePath {
  const MAX_DEPTH = 5; // Limit depth to prevent noise
  const steps: LineageStep[] = [];
  const crossings: ComponentBoundary[] = [];

  if (depth >= MAX_DEPTH) {
    return { steps, crossings };
  }

  // Create unique key for cycle detection
  const nodeKey = `${component.fullName}:${startNode.id}:${startPort || '*'}`;
  if (visited.has(nodeKey)) {
    return { steps, crossings }; // Cycle detected
  }
  visited.add(nodeKey);

  // Determine which inputs to trace
  const portsToTrace = startPort ? [startPort] : getInputPorts(startNode);

  for (const portName of portsToTrace) {
    const connections = getPortConnections(component, startNode.id, portName, 'input');

    if (connections.length === 0) {
      // No connections - skip unconnected ports unless this is a Component Input boundary
      if (startNode.typename === 'Component Inputs') {
        // Cross into parent component
        const external = resolveComponentBoundary(project, component, startNode.id, portName);

        if (external.length > 0) {
          // Found connection in parent - continue tracing there
          const ext = external[0]; // Take first parent connection
          const parentComponent = project.getComponentWithName(ext.parentNodeId.split('.')[0]);

          if (parentComponent) {
            const parentNode = parentComponent.graph.nodeMap.get(ext.parentNodeId);

            if (parentNode) {
              crossings.push({
                from: component,
                to: parentComponent,
                viaPort: portName,
                direction: 'into',
                stepIndex: steps.length
              });

              // Recursively trace in parent
              const parentPath = traceUpstream(
                project,
                parentComponent,
                parentNode,
                ext.parentPort,
                visited,
                depth + 1
              );

              steps.push(...parentPath.steps);
              crossings.push(...parentPath.crossings);
            }
          }
        }
      } else {
        // True source node - no further upstream
        steps.push({
          node: startNode,
          component,
          port: portName,
          portType: 'input',
          isSource: true
        });
      }
      continue;
    }

    // Follow connections upstream
    for (const conn of connections) {
      const sourceNode = component.graph.nodeMap.get(conn.fromNodeId);
      if (!sourceNode) continue;

      // Add this step
      steps.push({
        node: sourceNode,
        component,
        port: conn.fromPort,
        portType: 'output',
        transformation: describeTransformation(sourceNode, conn.fromPort),
        connection: conn
      });

      // Check if source is a source-type node
      if (isSourceNode(sourceNode)) {
        steps[steps.length - 1].isSource = true;
        continue; // Don't trace further
      }

      // Check for component boundary
      if (sourceNode.typename === 'Component Outputs') {
        // This comes from a child component
        // For now, mark as boundary - full child traversal can be added later
        steps[steps.length - 1].transformation = `From child component output: ${conn.fromPort}`;
        continue;
      }

      // Recursively trace further upstream
      const upstreamPath = traceUpstream(project, component, sourceNode, undefined, visited, depth + 1);
      steps.push(...upstreamPath.steps);
      crossings.push(...upstreamPath.crossings);
    }
  }

  return { steps, crossings };
}

/**
 * Trace downstream to find all destinations of data.
 * Follows connections forward through the graph and across component boundaries.
 */
export function traceDownstream(
  project: ProjectModel,
  component: ComponentModel,
  startNode: NodeGraphNode,
  startPort?: string,
  visited: Set<string> = new Set(),
  depth: number = 0
): LineagePath[] {
  const MAX_DEPTH = 50;
  const paths: LineagePath[] = [];

  if (depth >= MAX_DEPTH) {
    return paths;
  }

  const nodeKey = `${component.fullName}:${startNode.id}:${startPort || '*'}`;
  if (visited.has(nodeKey)) {
    return paths;
  }
  visited.add(nodeKey);

  // Determine which outputs to trace
  const portsToTrace = startPort ? [startPort] : getOutputPorts(startNode);

  for (const portName of portsToTrace) {
    const connections = getPortConnections(component, startNode.id, portName, 'output');

    if (connections.length === 0) {
      // No connections - check if this is a component boundary
      if (startNode.typename === 'Component Outputs') {
        // Cross out to parent component
        const external = resolveComponentBoundary(project, component, startNode.id, portName);

        if (external.length > 0) {
          const ext = external[0];
          // Create path showing we crossed the boundary
          paths.push({
            steps: [
              {
                node: startNode,
                component,
                port: portName,
                portType: 'output',
                transformation: `Exported to parent as: ${portName}`
              }
            ],
            crossings: [
              {
                from: component,
                to: component, // Would need to resolve parent component here
                viaPort: portName,
                direction: 'outof',
                stepIndex: 0
              }
            ]
          });
        }
      } else {
        // True sink - no further downstream
        paths.push({
          steps: [
            {
              node: startNode,
              component,
              port: portName,
              portType: 'output',
              isSink: true
            }
          ],
          crossings: []
        });
      }
      continue;
    }

    // Follow each connection downstream (can branch to multiple destinations)
    for (const conn of connections) {
      const destNode = component.graph.nodeMap.get(conn.toNodeId);
      if (!destNode) continue;

      const pathSteps: LineageStep[] = [
        {
          node: destNode,
          component,
          port: conn.toPort,
          portType: 'input',
          transformation: describeTransformation(destNode, conn.toPort),
          connection: conn
        }
      ];

      // Check if destination is a sink
      if (isSinkNode(destNode)) {
        pathSteps[0].isSink = true;
        paths.push({ steps: pathSteps, crossings: [] });
        continue;
      }

      // Check for component boundary
      if (destNode.typename === 'Component Inputs') {
        // This goes into a child component
        pathSteps[0].transformation = `Into child component input: ${conn.toPort}`;
        paths.push({ steps: pathSteps, crossings: [] });
        continue;
      }

      // Recursively trace further downstream
      const downstreamPaths = traceDownstream(project, component, destNode, undefined, visited, depth + 1);

      if (downstreamPaths.length === 0) {
        // Dead end
        paths.push({ steps: pathSteps, crossings: [] });
      } else {
        // Merge this step with downstream paths
        for (const downPath of downstreamPaths) {
          paths.push({
            steps: [...pathSteps, ...downPath.steps],
            crossings: downPath.crossings,
            branches: downstreamPaths.length > 1
          });
        }
      }
    }
  }

  return paths;
}

/**
 * Describe what transformation a node performs (if any)
 */
function describeTransformation(node: NodeGraphNode, port: string): string | undefined {
  switch (node.typename) {
    case 'Expression':
      return `Expression: ${node.parameters.expression || '...'}`;

    case 'String Format':
      return `Format: ${node.parameters.format || '...'}`;

    case 'Object':
      // Check if accessing a property
      if (port && port !== 'object') {
        return `.${port} property`;
      }
      return 'Object value';

    case 'Array':
      if (port === 'length') return 'Array length';
      if (port.startsWith('item-')) return `Array item [${port.substring(5)}]`;
      return undefined;

    case 'Variable':
      return `Variable: ${node.parameters.name || node.label || 'unnamed'}`;

    case 'Function':
      return `Function: ${node.parameters.name || 'unnamed'}`;

    default:
      return undefined;
  }
}

/**
 * Check if a node is a data source (no further upstream to trace)
 */
function isSourceNode(node: NodeGraphNode): boolean {
  const sourceTypes = [
    'REST',
    'Cloud Function',
    'Function',
    'String',
    'Number',
    'Boolean',
    'Color',
    'Page Inputs',
    'Receive Event'
  ];

  return sourceTypes.includes(node.typename);
}

/**
 * Check if a node is a data sink (no further downstream to trace)
 */
function isSinkNode(node: NodeGraphNode): boolean {
  const sinkTypes = [
    'REST', // Also a sink when sending
    'Cloud Function',
    'Function',
    'Send Event',
    'Navigate',
    'Set Variable',
    'Page Router'
  ];

  return sinkTypes.includes(node.typename);
}

/**
 * Ports to skip when tracing lineage (signals, metadata, internal state)
 */
const SKIP_PORTS = new Set([
  // Signal ports (events, not data)
  'changed',
  'fetched',
  'onSave',
  'onLoad',
  'onClick',
  'onHover',
  'onPress',
  'onFocus',
  'onBlur',

  // Metadata ports (not actual data flow)
  'name',
  'id',
  'savedValue',
  'isLoading',
  'error',

  // Internal state
  '__state',
  '__internal'
]);

/**
 * Check if a port should be included in lineage tracing
 */
function shouldTracePort(port: { name: string; type?: string }): boolean {
  // Skip signal ports
  if (port.type === 'signal') {
    return false;
  }

  // Skip known metadata/event ports
  if (SKIP_PORTS.has(port.name)) {
    return false;
  }

  // Skip ports starting with underscore (internal)
  if (port.name.startsWith('_')) {
    return false;
  }

  return true;
}

/**
 * Get all input port names for a node (filtered for data ports only)
 */
function getInputPorts(node: NodeGraphNode): string[] {
  const ports = node.getPorts('input');
  return ports.filter(shouldTracePort).map((p) => p.name);
}

/**
 * Get all output port names for a node (filtered for data ports only)
 */
function getOutputPorts(node: NodeGraphNode): string[] {
  // Check if this node type has primary data ports defined
  const primaryPorts = PRIMARY_DATA_PORTS[node.typename];
  if (primaryPorts !== undefined) {
    return primaryPorts; // Only trace primary ports for this type
  }

  // Default: trace all filtered ports
  const ports = node.getPorts('output');
  return ports.filter(shouldTracePort).map((p) => p.name);
}
