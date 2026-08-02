/**
 * A workflow definition, as a graph the diff engine understands (WFA-007).
 *
 * `WorkflowDocument.buildGraph` already turns a definition into a canvas graph,
 * but it builds a live `WorkflowGraphModel` — it mints models, broadcasts global
 * `Model.*` events and needs the editor around it. Diffing a proposal happens
 * before any canvas exists, so this is the same translation with nothing live in
 * it: definition → legacy component JSON → SUB-007 `GraphSnapshot`.
 *
 * Going through legacy component JSON rather than constructing a snapshot by
 * hand is deliberate. `fromLegacyComponent` is the adapter version control
 * already uses, `toLegacyComponent` is its exact inverse, and `buildReviewComponent`
 * (AIX-003) produces legacy JSON for the diff canvas to render. Meeting that
 * pipeline at its own front door means the annotated review graph is built by
 * the code that already knows how, rather than by a second implementation that
 * agrees with it until it doesn't.
 *
 * **The component name carries the workflow prefix, and that is load-bearing.**
 * `ViewerConnection.isWorkflowModelEvent` filters model traffic by testing for
 * `/#__workflow__/`, so a review component named anything else would push
 * `nodeAdded` / `parametersChanged` at the viewer naming a component it has
 * never heard of — the defect F44 closed six times and F49 a seventh.
 *
 * This module imports nothing from the editor beyond `@noodl-versioning` (pure)
 * and this folder's own pure modules. Keep it that way: it is what lets the
 * proposal diff be exercised in plain Node.
 *
 * @module models/workflow/workflowGraphSnapshot
 */

import { fromLegacyComponent, type GraphSnapshot } from '@noodl-versioning';

import { layoutWorkflow } from './workflowLayout';
import {
  PORT_IN,
  PORT_NEXT,
  PORT_ON_ERROR,
  routePortName,
  typeNameForKind,
  WORKFLOW_NAME_PREFIX
} from './workflowPorts';

import type { WorkflowDefinition, WorkflowInput, WorkflowStep } from './types';

/** The step fields the editor stores as node PARAMETERS rather than as fields. */
const REF_PARAM = 'ref';

/** The workflow-level fields a reviewer sees as "the proposal's identity". */
export interface WorkflowMetadata {
  entry: string;
  name?: string;
  concurrency?: number;
  timeoutMs?: number;
  stepTimeoutMs?: number;
}

/** Every edge in a definition, flattened to (from, port, to). */
export interface WorkflowEdge {
  fromId: string;
  /** `next`, `onError`, or `route:<name>`. */
  fromProperty: string;
  toId: string;
}

export function edgesOf(steps: WorkflowStep[]): WorkflowEdge[] {
  const known = new Set(steps.map((s) => s.id));
  const edges: WorkflowEdge[] = [];
  const push = (fromId: string, fromProperty: string, targets: string[] | undefined) => {
    for (const toId of targets || []) {
      // A dangling edge cannot survive validation, so one here is a proposal
      // that was never offered — dropped rather than drawn as a wire to nowhere.
      if (known.has(toId)) edges.push({ fromId, fromProperty, toId });
    }
  };
  for (const step of steps) {
    push(step.id, PORT_NEXT, step.next);
    for (const [route, targets] of Object.entries(step.routes || {})) {
      push(step.id, routePortName(route), targets);
    }
    push(step.id, PORT_ON_ERROR, step.onError);
  }
  return edges;
}

/** The adapter component name for a workflow — see the module note. */
export function workflowGraphName(workflowId: string): string {
  return WORKFLOW_NAME_PREFIX + workflowId;
}

/**
 * A definition as legacy component JSON.
 *
 * Node ids are step ids, with no mapping table — the same non-negotiable
 * `WorkflowDocument` states, and what makes a change entry's canvas anchor land
 * on the right card.
 *
 * Positions follow WFA-004 §5: a stored `ui` wins, and a step without one gets
 * the deterministic DAG layout, so a proposal an agent wrote with no idea where
 * anything goes still reads as a graph rather than as a pile.
 */
export function workflowToLegacyComponent(
  definition: WorkflowDefinition | WorkflowInput,
  options: { name?: string } = {}
): Record<string, unknown> {
  const steps = definition.steps || [];
  const laidOut = layoutWorkflow(steps, definition.entry);

  const roots = steps.map((step) => {
    const parameters: Record<string, unknown> = { ...(step.params || {}) };
    if (step.ref !== undefined) parameters[REF_PARAM] = step.ref;
    const pos = step.ui || laidOut.get(step.id) || { x: 0, y: 0 };

    return {
      id: step.id,
      type: typeNameForKind(step.kind),
      x: pos.x,
      y: pos.y,
      label: step.name || step.id,
      parameters,
      ports: [],
      children: []
    };
  });

  const connections = edgesOf(steps).map((edge) => ({
    fromId: edge.fromId,
    fromProperty: edge.fromProperty,
    toId: edge.toId,
    toProperty: PORT_IN
  }));

  return {
    name: options.name ?? workflowGraphName(definition.id || ''),
    // The workflow-level fields ride component metadata, so the diff reports
    // them as `component-metadata-changed` — which AIX-003's review already
    // treats as the proposal's identity and refuses to let a reader exclude.
    // Entry, concurrency and the timeouts are exactly that: they come with the
    // proposal or they do not come at all.
    metadata: workflowMetadata(definition),
    graph: { roots, connections, comments: [] }
  };
}

/** The workflow-level fields, with undefined keys dropped so they do not diff. */
export function workflowMetadata(definition: WorkflowDefinition | WorkflowInput): Record<string, unknown> {
  const metadata: Record<string, unknown> = { entry: definition.entry };
  if (definition.name !== undefined) metadata.name = definition.name;
  if (definition.concurrency !== undefined) metadata.concurrency = definition.concurrency;
  if (definition.timeoutMs !== undefined) metadata.timeoutMs = definition.timeoutMs;
  if (definition.stepTimeoutMs !== undefined) metadata.stepTimeoutMs = definition.stepTimeoutMs;
  return metadata;
}

/** A definition as a SUB-007 snapshot, ready to diff. */
export function workflowToSnapshot(
  definition: WorkflowDefinition | WorkflowInput,
  options: { name?: string } = {}
): GraphSnapshot {
  const snapshot = fromLegacyComponent(workflowToLegacyComponent(definition, options));
  snapshot.name = options.name ?? workflowGraphName(definition.id || '');
  return snapshot;
}
