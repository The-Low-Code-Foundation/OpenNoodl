/**
 * AIX-002 — The Authoring Loop: tool surface
 *
 * The same vocabulary SUB-008 exposes to external agents, shaped for the
 * in-editor loop: read tools that pull *bounded* context through the
 * ContextBuilder (so every read is charged and logged), and one write-shaped
 * tool that submits the whole candidate to the validation gate. There is no
 * tool that returns more than one component, and no tool that touches disk.
 *
 * ⚠️ AAQ-005: "the same vocabulary" was an intention, not a fact. This file
 * hand-wrote `submit_component`'s node/connection/port schemas in JSON Schema
 * while `noodl-mcp/src/tools/author.ts` hand-wrote the same three in zod, and
 * they had drifted in both directions — MCP accepted `children` and `variant`
 * the editor did not, and never declared `plug` on an instance port, which is
 * the field that decides whether the port exists at all. Both are now rendered
 * from `validation/authoringVocabulary`, where each remaining difference is
 * declared with its reason and pinned by `vocabularyParity.test.ts`.
 *
 * @module AiAssistant/authoring/tools
 */

import type { ConnectionV2, NodePort } from '../../../schemas';
import { jsonSchemasFor } from '../../../validation/authoringVocabulary';
import type { AiToolCall, AiToolDefinition } from '../client/types';
import type { AuthoringContextBuilder } from './ContextBuilder';
import type { AgentSampleData, SubmitPayload, SubmittedNode } from './types';

/** Records per collection the preview will show; more is wasted context. */
const MAX_SAMPLE_RECORDS = 5;

/**
 * `sample_data` is model-supplied and unvalidated, so it is narrowed here
 * rather than trusted: object of arrays of objects, capped. Anything else is
 * dropped — the sandbox falls back to inference, which always produces
 * something.
 */
function toSampleData(value: unknown): AgentSampleData | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const result: AgentSampleData = {};
  for (const [className, records] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(records)) continue;
    const rows = records
      .filter((record): record is Record<string, unknown> => record !== null && typeof record === 'object' && !Array.isArray(record))
      .slice(0, MAX_SAMPLE_RECORDS);
    if (rows.length > 0) result[className] = rows;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

export const GET_NODE_TYPES = 'get_node_types';
export const GET_COMPONENT = 'get_component';
export const SUBMIT_COMPONENT = 'submit_component';

/**
 * Rendered from the shared vocabulary rather than written here. `payload` is
 * `submit_component`'s parameter object — the editor's client omits the fields
 * only the MCP door has (`path`, `type`, `allow_unknown_types`, and `children`/
 * `variant` on a node) and keeps `sample_data`, which only this door consumes.
 */
const { node: nodeSchema, connection: connectionSchema, payload: submitSchema } = jsonSchemasFor('editor');

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
    parameters: submitSchema as unknown as Record<string, unknown>
  }
];

/**
 * Exported for `tests-unit/aaq-005` and the cross-client parity spec: the two
 * nested schemas the payload embeds, so a drift detector can compare them with
 * `noodl-mcp`'s zod rendering of the same table without re-deriving either.
 */
export const AUTHORED_NODE_JSON_SCHEMA = nodeSchema;
export const AUTHORED_CONNECTION_JSON_SCHEMA = connectionSchema;

/** Parse submit_component arguments into a SubmitPayload (snake_case → camelCase). */
export function toSubmitPayload(args: Record<string, unknown>): SubmitPayload {
  return {
    nodes: (args.nodes as SubmittedNode[]) ?? [],
    connections: args.connections as ConnectionV2[] | undefined,
    visualRoots: args.visual_roots as string[] | undefined,
    description: typeof args.description === 'string' ? args.description : undefined,
    sampleData: toSampleData(args.sample_data)
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
