/**
 * AIX-002 — The Authoring Loop: tool surface
 *
 * The same vocabulary SUB-008 exposes to external agents, shaped for the
 * in-editor loop: read tools that pull *bounded* context through the
 * ContextBuilder (so every read is charged and logged), and one write-shaped
 * tool that submits the whole candidate to the validation gate. There is no
 * tool that returns more than one component, and no tool that touches disk.
 *
 * @module AiAssistant/authoring/tools
 */

import type { ConnectionV2, NodePort } from '../../../schemas';
import type { AiToolCall, AiToolDefinition } from '../client/types';
import type { AuthoringContextBuilder } from './ContextBuilder';
import type { SubmitPayload, SubmittedNode } from './types';

export const GET_NODE_TYPES = 'get_node_types';
export const GET_COMPONENT = 'get_component';
export const SUBMIT_COMPONENT = 'submit_component';

const nodeSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Unique id you invent; required to wire connections or parent nodes' },
    type: {
      type: 'string',
      description: 'Exact catalog typeName ("Group"), or an existing component name ("/Pages/Home") to instantiate it'
    },
    label: { type: 'string', description: 'What this node is for, in this graph' },
    x: { type: 'number' },
    y: { type: 'number' },
    parent: { type: 'string', description: 'Id of the parent node in the visual tree; omit for roots and logic nodes' },
    parameters: { type: 'object', description: 'Static input values keyed by exact port name' },
    ports: {
      type: 'array',
      description:
        'Instance ports — only for "Component Inputs" (plug "output") and "Component Outputs" (plug "input") nodes',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          plug: { type: 'string', enum: ['input', 'output'] },
          type: { type: 'string', description: 'Port value type; "*" when it does not matter' },
          index: { type: 'number' }
        },
        required: ['name', 'plug']
      }
    }
  },
  required: ['id', 'type']
} as const;

const connectionSchema = {
  type: 'object',
  properties: {
    fromId: { type: 'string' },
    fromProperty: { type: 'string', description: 'Output port name on the source node' },
    toId: { type: 'string' },
    toProperty: { type: 'string', description: 'Input port name on the target node' }
  },
  required: ['fromId', 'fromProperty', 'toId', 'toProperty']
} as const;

export const AUTHORING_TOOLS: AiToolDefinition[] = [
  {
    name: GET_NODE_TYPES,
    description:
      'Full documentation — ports, types, defaults, usage — for catalog node types. Batch every type you ' +
      'plan to use into ONE call before authoring; port names must be exact.',
    parameters: {
      type: 'object',
      properties: {
        typeNames: { type: 'array', items: { type: 'string' }, minItems: 1 }
      },
      required: ['typeNames']
    }
  },
  {
    name: GET_COMPONENT,
    description:
      'The bounded graph of ONE existing component. Reads are limited and budgeted — use only when the ' +
      'interface shown in the project overview is not enough.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Component name as listed in the overview, e.g. "/Pages/Home"' }
      },
      required: ['name']
    }
  },
  {
    name: SUBMIT_COMPONENT,
    description:
      'Submit the complete component for validation. Diagnostics come back with fixes; correct them and ' +
      'resubmit the full graph. A valid submission ends the task.',
    parameters: {
      type: 'object',
      properties: {
        nodes: { type: 'array', items: nodeSchema, minItems: 1 },
        connections: { type: 'array', items: connectionSchema },
        visual_roots: {
          type: 'array',
          items: { type: 'string' },
          description: 'Ids of the canvas root nodes (the visual root container for pages/visual components)'
        },
        description: { type: 'string', description: 'One or two sentences: what this component is and does' }
      },
      required: ['nodes']
    }
  }
];

/** Parse submit_component arguments into a SubmitPayload (snake_case → camelCase). */
export function toSubmitPayload(args: Record<string, unknown>): SubmitPayload {
  return {
    nodes: (args.nodes as SubmittedNode[]) ?? [],
    connections: args.connections as ConnectionV2[] | undefined,
    visualRoots: args.visual_roots as string[] | undefined,
    description: typeof args.description === 'string' ? args.description : undefined
  };
}

/**
 * Dispatch one read tool call against the context builder. `submit_component`
 * is not handled here — the session owns it, because a valid submission ends
 * the loop.
 */
export function dispatchReadTool(call: AiToolCall, context: AuthoringContextBuilder): string {
  if (call.name === GET_NODE_TYPES) {
    const names = Array.isArray(call.arguments.typeNames) ? (call.arguments.typeNames as string[]) : [];
    if (names.length === 0) return 'get_node_types needs a non-empty typeNames array.';
    return context.nodeTypeDetails(names.map(String));
  }
  if (call.name === GET_COMPONENT) {
    const name = call.arguments.name;
    if (typeof name !== 'string' || !name) return 'get_component needs a component name from the project overview.';
    return context.componentContext(name);
  }
  return `Unknown tool "${call.name}". Available: ${GET_NODE_TYPES}, ${GET_COMPONENT}, ${SUBMIT_COMPONENT}.`;
}
