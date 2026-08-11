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
import { metadataWithComment } from '../../../validation/authoringVocabulary';
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

/**
 * The array-shaped fields of a submission, checked before anything iterates
 * them.
 *
 * `SubmitPayload` says these are arrays, but it is built by an unchecked cast
 * over tool arguments the model wrote — so the type is a claim about what
 * should arrive, not about what does. A model that submits `nodes` as an object
 * or as a JSON string used to reach `(payload.nodes ?? []).map(…)` and throw a
 * `TypeError` out of the session entirely, which is the one failure mode this
 * loop is built to not have: a malformed submission is repairable, and the
 * agent only gets to repair what it is told about.
 */
function arrayShapeErrors(payload: SubmitPayload): string[] {
  const errors: string[] = [];
  const check = (value: unknown, field: string): void => {
    if (value !== undefined && value !== null && !Array.isArray(value)) {
      errors.push(`submit_component: \`${field}\` must be an array — got ${typeof value}.`);
    }
  };
  check(payload.nodes, 'nodes');
  check(payload.connections, 'connections');
  check(payload.visualRoots, 'visual_roots');
  return errors;
}

function shapeErrors(nodes: SubmittedNode[], payload: SubmitPayload): string[] {
  const errors: string[] = [];
  if (nodes.length === 0) errors.push('The component has no nodes. Submit at least one node.');

  for (const node of nodes) {
    // Same reason as `arrayShapeErrors`: `ports` is mapped further down, and a
    // model that sends it as an object would otherwise throw there.
    if (node.ports !== undefined && node.ports !== null && !Array.isArray(node.ports)) {
      errors.push(`Node "${node.id ?? node.type}": \`ports\` must be an array — got ${typeof node.ports}.`);
    }
  }

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
  // Before anything iterates: the payload's array fields are model output, and
  // a non-array here would throw rather than be reported.
  const arrayErrors = arrayShapeErrors(payload);
  if (arrayErrors.length > 0) return { errors: arrayErrors };

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

    // LEG-001 — the authored `comment` into `metadata.comment`, AFTER the carry
    // above, and that order is the whole point: `metadata` is one of the carried
    // fields, so folding first would have made the bag "already set" and dropped
    // everything the base node kept there — `merge.soureCodePorts`, the AI prompt
    // history, the lot. This way a comment is written *into* the carried bag and
    // an omitted one leaves the base's comment standing, which is the same rule
    // the rest of `CARRIED_NODE_FIELDS` follows: an AI revision must not eat work
    // the contract gave it no way to resubmit.
    if (n.comment !== undefined) {
      const metadata = metadataWithComment(node.metadata, n.comment);
      if (metadata) node.metadata = metadata;
      else delete node.metadata;
    }
    return node;
  });

  const legacyName = pathToLegacyName(request.componentPath);
  const componentId = base?.component.id ?? newId();
  const component: ComponentV2File = base
    ? {
        ...JSON.parse(JSON.stringify(base.component)),
        // Backfilled, not merely carried. A component whose project.json entry
        // has no `id` — legacy projects have them, and `ComponentModel` only
        // mints one on import (`rekeyAllIds`) — exports to a `component.json`
        // with no id, and `{...base}` through a JSON round trip drops the
        // undefined key entirely. The candidate then fails the SCHEMA check on
        // `must have required property 'id'` on every submission, forever: the
        // agent is handed an error about a field `submit_component` cannot
        // express, so the repair loop cannot converge and the session exhausts.
        // The component's identity was never the agent's to supply — so supply it.
        id: componentId,
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
