/**
 * Component X-Ray Panel Types
 *
 * TypeScript interfaces for the Component X-Ray data structure.
 */

import { ComponentModel } from '@noodl-models/componentmodel';

/**
 * Information about where a component is used
 */
export interface ComponentUsageInfo {
  component: ComponentModel;
  instanceCount: number;
  instanceNodeIds: string[];
}

/**
 * Component input port information
 */
export interface ComponentInputInfo {
  name: string;
  type: string;
  isSignal: boolean;
}

/**
 * Component output port information
 */
export interface ComponentOutputInfo {
  name: string;
  type: string;
  isSignal: boolean;
}

/**
 * Subcomponent instance information
 */
export interface SubcomponentInfo {
  name: string;
  fullName: string;
  component: ComponentModel | null;
  nodeId: string;
}

/**
 * Node breakdown by semantic category
 */
export interface NodeCategoryBreakdown {
  category: string;
  count: number;
  nodeIds: string[]; // Node IDs in this category for highlighting
}

/**
 * REST call information
 */
export interface RESTCallInfo {
  method: string;
  endpoint: string;
  nodeId: string;
  nodeLabel: string;
}

/**
 * Event information (sent or received)
 */
export interface EventInfo {
  eventName: string;
  nodeId: string;
  nodeLabel: string;
}

/**
 * Function node information
 */
export interface FunctionInfo {
  name: string;
  nodeId: string;
  nodeLabel: string;
}

/**
 * Internal state node information
 */
export interface StateNodeInfo {
  name: string;
  nodeId: string;
  nodeType: 'Variable' | 'Object' | 'States';
}

/**
 * Complete X-Ray data for a component
 */
export interface ComponentXRayData {
  // Component identity
  componentName: string;
  componentFullName: string;

  // Usage information
  usedIn: ComponentUsageInfo[];

  // Component interface
  inputs: ComponentInputInfo[];
  outputs: ComponentOutputInfo[];

  // Contents
  subcomponents: SubcomponentInfo[];
  nodeBreakdown: NodeCategoryBreakdown[];
  totalNodes: number;

  // External dependencies
  restCalls: RESTCallInfo[];
  eventsSent: EventInfo[];
  eventsReceived: EventInfo[];
  functions: FunctionInfo[];

  // Internal state
  stateNodes: StateNodeInfo[];
}
