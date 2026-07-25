/**
 * AIX-002 — The Authoring Loop: candidate builder
 *
 * Turns the agent's submitted payload into the three v2 files, with the shape
 * problems an LLM actually produces caught here rather than left to confuse the
 * semantic validator: duplicate ids, orphan `parent` references, parent cycles.
 *
 * The hierarchy contract is deliberately simpler than the MCP server's: the
 * agent gives `parent` only, and children arrays are *derived* from submission
 * order. Double-bookkeeping (parent fields AND children arrays) is exactly the
 * kind of consistency an LLM gets wrong, so the contract removes it.
 *
 * @module AiAssistant/authoring/candidate
 */

import { inferComponentType } from '../../../io/ProjectExporter';
import type { ComponentV2File, ConnectionsV2File, NodesV2File, NodeV2 } from '../../../schemas';
import type { AuthoringRequest, ComponentFiles, SubmitPayload, SubmittedNode } from './types';

/**
 * Node fields the submit contract cannot express. On an update, a kept node
 * (same id, same type) silently loses these under a naive full resubmission —
 * variants and visual-state overrides are exactly the kind of hand-tuned work
 * an "AI revision" must not eat — so they are carried over from the base
 * instead. Deliberately not carried: `parameters` and `ports`, which the agent
 * can express and therefore owns.
 */
const CARRIED_NODE_FIELDS = [
  'variant',
  'stateParameters',
  'stateTransitions',
  'defaultStateTransitions',
  'dynamicports',
  'metadata'
] as const;

/** "Pages/Customers" → "/Pages/Customers" (the form component references use). */
export function pathToLegacyName(componentPath: string): string {
  return '/' + componentPath.replace(/^\/+/, '');
}

/** Renderer-safe unique id. */
export function newId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  // Fallback for exotic test environments; uniqueness within one candidate is
  // all that is required here.
  return 'n-' + Math.random().toString(36).slice(2, 10) + '-' + Math.random().toString(36).slice(2, 10);
}

export interface CandidateResult {
  files?: ComponentFiles;
  /** Shape errors, phrased for the agent to act on. Empty when `files` is set. */
  errors: string[];
}

function shapeErrors(nodes: SubmittedNode[], payload: SubmitPayload): string[] {
  const errors: string[] = [];
  if (nodes.length === 0) errors.push('The component has no nodes. Submit at least one node.');

  const ids = new Set<string>();
  for (const node of nodes) {
    if (!node.id) continue;
    if (ids.has(node.id)) errors.push(`Duplicate node id "${node.id}" — every node needs a unique id.`);
    ids.add(node.id);
  }

  for (const node of nodes) {
    if (node.parent !== undefined && !ids.has(node.parent)) {
      errors.push(`Node "${node.id ?? node.type}" names parent "${node.parent}", which is not a submitted node id.`);
    }
  }

  // Parent cycles: walk up from every node; revisiting within one walk is a cycle.
  const parentOf = new Map<string, string | undefined>();
  for (const node of nodes) if (node.id) parentOf.set(node.id, node.parent);
  for (const node of nodes) {
    if (!node.id) continue;
    const seen = new Set<string>();
    let current: string | undefined = node.id;
    while (current !== undefined) {
      if (seen.has(current)) {
        errors.push(`Parent cycle involving node "${current}" — a node cannot contain itself.`);
        break;
      }
      seen.add(current);
      current = parentOf.get(current);
    }
  }

  for (const rootId of payload.visualRoots ?? []) {
    if (!ids.has(rootId)) errors.push(`visualRoots names "${rootId}", which is not a submitted node id.`);
  }

  return errors;
}

/**
 * Build the candidate v2 files, or explain what is wrong with the payload's
 * shape. Never throws — every path returns something the agent can act on.
 *
 * With `base` (update mode) the candidate keeps the base component's identity —
 * id, created, metadata, canvas comments — and each kept node (same id, same
 * type as in the base) keeps the fields the submit contract cannot express.
 * The component's identity is not the agent's to change; only the graph is.
 */
export function buildCandidate(
  request: AuthoringRequest,
  payload: SubmitPayload,
  now: string = new Date().toISOString(),
  base?: ComponentFiles
): CandidateResult {
  const submitted = (payload.nodes ?? []).map((n) => ({ ...n, id: n.id ?? newId() }));
  const errors = shapeErrors(submitted, payload);
  if (errors.length > 0) return { errors };

  // Derive children arrays from parent fields, in submission order.
  const childrenOf = new Map<string, string[]>();
  for (const node of submitted) {
    if (node.parent === undefined) continue;
    const siblings = childrenOf.get(node.parent) ?? [];
    siblings.push(node.id);
    childrenOf.set(node.parent, siblings);
  }

  const baseNodes = new Map<string, NodeV2>((base?.nodes.nodes ?? []).map((n) => [n.id, n]));

  const nodes: NodeV2[] = submitted.map((n) => {
    const children = childrenOf.get(n.id);
    const node: NodeV2 = { id: n.id, type: n.type };
    if (n.label !== undefined) node.label = n.label;
    if (n.x !== undefined) node.x = n.x;
    if (n.y !== undefined) node.y = n.y;
    if (n.parent !== undefined) node.parent = n.parent;
    if (children && children.length > 0) node.children = children;
    if (n.parameters && Object.keys(n.parameters).length > 0) node.parameters = { ...n.parameters };
    if (n.ports && n.ports.length > 0) node.ports = n.ports.map((p) => ({ ...p }));

    const baseNode = baseNodes.get(n.id);
    if (baseNode && baseNode.type === n.type) {
      for (const field of CARRIED_NODE_FIELDS) {
        if (baseNode[field] !== undefined && node[field] === undefined) {
          node[field] = JSON.parse(JSON.stringify(baseNode[field]));
        }
      }
    }
    return node;
  });

  const legacyName = pathToLegacyName(request.componentPath);
  const componentId = base?.component.id ?? newId();
  const component: ComponentV2File = base
    ? {
        ...JSON.parse(JSON.stringify(base.component)),
        modified: now,
        modifiedBy: 'ai-authoring',
        ...(payload.description ? { description: payload.description } : {})
      }
    : {
        $schema: 'https://opennoodl.dev/schemas/component-v2.json',
        id: componentId,
        name: request.componentPath.split('/').pop() ?? request.componentPath,
        path: legacyName,
        type: request.componentType ?? inferComponentType(legacyName),
        created: now,
        modified: now,
        modifiedBy: 'ai-authoring',
        ...(payload.description ? { description: payload.description } : {})
      };
  const nodesFile: NodesV2File = {
    $schema: 'https://opennoodl.dev/schemas/nodes-v2.json',
    componentId,
    version: base?.nodes.version ?? 1,
    nodes,
    ...(payload.visualRoots?.length ? { visualRoots: [...payload.visualRoots] } : {}),
    ...(base?.nodes.comments?.length ? { comments: JSON.parse(JSON.stringify(base.nodes.comments)) } : {})
  };
  const connectionsFile: ConnectionsV2File = {
    $schema: 'https://opennoodl.dev/schemas/connections-v2.json',
    componentId,
    version: 1,
    connections: (payload.connections ?? []).map((c) => ({
      fromId: c.fromId,
      fromProperty: c.fromProperty,
      toId: c.toId,
      toProperty: c.toProperty
    }))
  };

  return { files: { component, nodes: nodesFile, connections: connectionsFile }, errors: [] };
}
