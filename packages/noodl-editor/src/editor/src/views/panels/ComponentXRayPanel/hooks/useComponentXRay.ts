/**
 * useComponentXRay Hook
 *
 * Collects comprehensive X-Ray data for a component, including:
 * - Where it's used
 * - Component interface (inputs/outputs)
 * - Internal structure (subcomponents, node breakdown)
 * - External dependencies (REST, Events, Functions)
 * - Internal state (Variables, Objects, States)
 */

import { NodeGraphContextTmp } from '@noodl-contexts/NodeGraphContext/NodeGraphContext';
import { useEventListener } from '@noodl-hooks/useEventListener';
import { useMemo, useState } from 'react';

import { ComponentModel } from '@noodl-models/componentmodel';
import { NodeGraphNode } from '@noodl-models/nodegraphmodel';
import { ProjectModel } from '@noodl-models/projectmodel';
import { categorizeNodes, findComponentUsages, findNodesOfType } from '@noodl-utils/graphAnalysis';

import {
  ComponentInputInfo,
  ComponentOutputInfo,
  ComponentUsageInfo,
  ComponentXRayData,
  EventInfo,
  FunctionInfo,
  NodeCategoryBreakdown,
  RESTCallInfo,
  StateNodeInfo,
  SubcomponentInfo
} from '../utils/xrayTypes';

/**
 * Extract component inputs from Component Inputs nodes
 */
function extractComponentInputs(component: ComponentModel): ComponentInputInfo[] {
  const inputNodes = findNodesOfType(component, 'Component Inputs');

  const inputs: ComponentInputInfo[] = [];

  for (const node of inputNodes) {
    // Get all ports defined on this node
    const ports = node.getPorts();

    for (const port of ports) {
      if (port.plug === 'output') {
        // Component Inputs node has outputs that represent component inputs
        inputs.push({
          name: port.name,
          type: port.type?.name || port.type || 'any',
          isSignal: port.type === 'signal' || port.type?.name === 'signal'
        });
      }
    }
  }

  return inputs;
}

/**
 * Extract component outputs from Component Outputs nodes
 */
function extractComponentOutputs(component: ComponentModel): ComponentOutputInfo[] {
  const outputNodes = findNodesOfType(component, 'Component Outputs');

  const outputs: ComponentOutputInfo[] = [];

  for (const node of outputNodes) {
    // Get all ports defined on this node
    const ports = node.getPorts();

    for (const port of ports) {
      if (port.plug === 'input') {
        // Component Outputs node has inputs that represent component outputs
        outputs.push({
          name: port.name,
          type: port.type?.name || port.type || 'any',
          isSignal: port.type === 'signal' || port.type?.name === 'signal'
        });
      }
    }
  }

  return outputs;
}

/**
 * Extract subcomponent instances used within this component
 */
function extractSubcomponents(component: ComponentModel): SubcomponentInfo[] {
  const subcomponents: SubcomponentInfo[] = [];
  const seen = new Set<string>();

  // Find all nodes that are component instances
  component.graph.forEachNode((node: NodeGraphNode) => {
    if (node.type instanceof ComponentModel) {
      const key = `${node.type.fullName}-${node.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        subcomponents.push({
          name: node.type.name,
          fullName: node.type.fullName,
          component: node.type,
          nodeId: node.id
        });
      }
    }
  });

  return subcomponents;
}

/**
 * Extract REST call information from REST nodes
 */
function extractRESTCalls(component: ComponentModel): RESTCallInfo[] {
  const restNodes = findNodesOfType(component, 'REST');
  const rest2Nodes = findNodesOfType(component, 'REST2');
  const allRestNodes = [...restNodes, ...rest2Nodes];

  return allRestNodes.map((node) => ({
    method: (node.parameters.method as string) || 'GET',
    endpoint: (node.parameters.url as string) || (node.parameters.endpoint as string) || 'No endpoint',
    nodeId: node.id,
    nodeLabel: node.label || 'REST Call'
  }));
}

/**
 * Extract sent event information from Send Event nodes
 */
function extractSentEvents(component: ComponentModel): EventInfo[] {
  const sendEventNodes = findNodesOfType(component, 'Send Event');

  return sendEventNodes.map((node) => ({
    eventName: (node.parameters.eventName as string) || (node.parameters.channel as string) || 'Unnamed Event',
    nodeId: node.id,
    nodeLabel: node.label || 'Send Event'
  }));
}

/**
 * Extract received event information from Receive Event nodes
 */
function extractReceivedEvents(component: ComponentModel): EventInfo[] {
  const receiveEventNodes = findNodesOfType(component, 'Receive Event');

  return receiveEventNodes.map((node) => ({
    eventName: (node.parameters.eventName as string) || (node.parameters.channel as string) || 'Unnamed Event',
    nodeId: node.id,
    nodeLabel: node.label || 'Receive Event'
  }));
}

/**
 * Extract function information from JavaScriptFunction nodes
 */
function extractFunctions(component: ComponentModel): FunctionInfo[] {
  const functionNodes = findNodesOfType(component, 'JavaScriptFunction');

  return functionNodes.map((node) => ({
    name: (node.parameters.name as string) || node.typename,
    nodeId: node.id,
    nodeLabel: node.label || 'JavaScript Function'
  }));
}

/**
 * Extract internal state nodes (Variables, Objects, States)
 */
function extractStateNodes(component: ComponentModel): StateNodeInfo[] {
  // Support both Variable and Variable2 (newer version)
  const variableNodes = findNodesOfType(component, 'Variable');
  const variable2Nodes = findNodesOfType(component, 'Variable2');
  const objectNodes = findNodesOfType(component, 'Object');
  const statesNodes = findNodesOfType(component, 'States');

  const stateNodes: StateNodeInfo[] = [];

  for (const node of variableNodes) {
    stateNodes.push({
      name: node.label || 'Unnamed Variable',
      nodeId: node.id,
      nodeType: 'Variable'
    });
  }

  for (const node of variable2Nodes) {
    stateNodes.push({
      name: node.label || 'Unnamed Variable',
      nodeId: node.id,
      nodeType: 'Variable'
    });
  }

  for (const node of objectNodes) {
    stateNodes.push({
      name: node.label || 'Unnamed Object',
      nodeId: node.id,
      nodeType: 'Object'
    });
  }

  for (const node of statesNodes) {
    stateNodes.push({
      name: node.label || 'States',
      nodeId: node.id,
      nodeType: 'States'
    });
  }

  return stateNodes;
}

/**
 * Extract node breakdown by category
 */
function extractNodeBreakdown(component: ComponentModel): NodeCategoryBreakdown[] {
  const categorized = categorizeNodes(component);

  // Map totals to include node IDs for highlighting
  return categorized.totals.map((total) => {
    const nodes = categorized.byCategory.get(total.category) || [];
    const nodeIds = nodes.map((node) => node.id);

    return {
      category: total.category,
      count: total.count,
      nodeIds
    };
  });
}

/**
 * Extract component usage information from the project
 */
function extractUsageInfo(project: ProjectModel, componentFullName: string): ComponentUsageInfo[] {
  const usages = findComponentUsages(project, componentFullName);

  return usages.map((usage) => ({
    component: usage.usedIn,
    instanceCount: 1, // Each usage represents one instance
    instanceNodeIds: [usage.instanceNodeId]
  }));
}

/**
 * Hook that builds and returns complete X-Ray data for the currently active component.
 *
 * Automatically updates when:
 * - The active component changes
 * - Components are added or removed from the project
 * - Nodes are added or removed from the current component
 *
 * @returns Complete X-Ray data for the current component, or null if no component is active
 *
 * @example
 * ```tsx
 * function MyPanel() {
 *   const xrayData = useComponentXRay();
 *
 *   if (!xrayData) {
 *     return <div>No component selected</div>;
 *   }
 *
 *   return (
 *     <div>
 *       <h2>{xrayData.componentName}</h2>
 *       <p>Total nodes: {xrayData.totalNodes}</p>
 *       <p>Used in {xrayData.usedIn.length} places</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useComponentXRay(): ComponentXRayData | null {
  const project = ProjectModel.instance;
  const [updateTrigger, setUpdateTrigger] = useState(0);

  // Get current component from NodeGraphContext
  const currentComponent = NodeGraphContextTmp.nodeGraph?.activeComponent || null;

  // Trigger rebuild when components change
  useEventListener(ProjectModel.instance, 'componentAdded', () => {
    setUpdateTrigger((prev) => prev + 1);
  });

  useEventListener(ProjectModel.instance, 'componentRemoved', () => {
    setUpdateTrigger((prev) => prev + 1);
  });

  // Trigger rebuild when active component switches
  useEventListener(NodeGraphContextTmp.nodeGraph, 'activeComponentChanged', () => {
    setUpdateTrigger((prev) => prev + 1);
  });

  // Trigger rebuild when nodes change in the current component
  // IMPORTANT: Listen to the component's graph, not the NodeGraphContextTmp singleton
  useEventListener(currentComponent?.graph, 'nodeAdded', () => {
    setUpdateTrigger((prev) => prev + 1);
  });

  useEventListener(currentComponent?.graph, 'nodeRemoved', () => {
    setUpdateTrigger((prev) => prev + 1);
  });

  const xrayData = useMemo<ComponentXRayData | null>(() => {
    if (!currentComponent) {
      return null;
    }

    // Build complete X-Ray data
    const data: ComponentXRayData = {
      // Identity
      componentName: currentComponent.name,
      componentFullName: currentComponent.fullName,

      // Usage
      usedIn: extractUsageInfo(project, currentComponent.fullName),

      // Interface
      inputs: extractComponentInputs(currentComponent),
      outputs: extractComponentOutputs(currentComponent),

      // Contents
      subcomponents: extractSubcomponents(currentComponent),
      nodeBreakdown: extractNodeBreakdown(currentComponent),
      totalNodes: extractNodeBreakdown(currentComponent).reduce((sum, cat) => sum + cat.count, 0),

      // External dependencies
      restCalls: extractRESTCalls(currentComponent),
      eventsSent: extractSentEvents(currentComponent),
      eventsReceived: extractReceivedEvents(currentComponent),
      functions: extractFunctions(currentComponent),

      // Internal state
      stateNodes: extractStateNodes(currentComponent)
    };

    return data;
  }, [currentComponent, project, updateTrigger]);

  return xrayData;
}
