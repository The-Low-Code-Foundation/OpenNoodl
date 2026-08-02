/**
 * A workflow proposal, expressed as something the AIX-003 review can render
 * (WFA-007).
 *
 * Two halves:
 *
 *  - **`buildWorkflowChangeSet`** — base definition + candidate definition →
 *    `AuthoringChangeSet`, so the diff canvas, the change list, the walkthrough
 *    and the exclude/restore closures all work with no changes.
 *  - **`materializeWorkflowSelection`** — the reader's kept subset → the
 *    `WorkflowInput` that gets written.
 *
 * ## Materialisation is definition-native, not snapshot-native
 *
 * AIX-003's `materializeSelection` replays changes onto a snapshot and
 * serialises v2 component files. A workflow has no files, and — more usefully —
 * a definition is a *better* target than a graph: edges live on steps, entry is
 * a field, and the thing that has to come out is exactly what the admin API
 * takes. So the replay happens over steps and an edge set, which is both simpler
 * and directly assertable.
 *
 * ## The closures were re-derived, not inherited
 *
 * `computeRequirements` (changeClosure.ts) states graph facts that hold for any
 * subject — an added edge needs the nodes it plugs into; removing a node needs
 * the edges that touched it gone. Those are reused verbatim. The rules that come
 * from what a workflow MEANS are added here, from the engine's own validator:
 *
 *  - a step whose params reference `{"$path": "upstream.X…"}` requires the
 *    change that adds **X** (`validateValueReferences`). This has no component
 *    analogue, and inheriting the component closures without it would produce a
 *    partial accept that the backend rejects on save.
 *
 * The entry is deliberately NOT a closure — see `repairEntry`.
 *
 * ## The last resort is not this file
 *
 * Whatever the closures miss, `POST /admin/workflow-defs/validate` sees: the
 * materialized definition is validated against the target backend before it is
 * written. That is the backstop, and it is why partial accept can ship at all.
 *
 * @module models/workflow/workflowChangeSet
 */

import { diffGraphs, type GraphChange, type GraphSnapshot } from '@noodl-versioning';

import {
  emptySnapshot,
  excludedWith,
  wrapChanges,
  type AuthoringChangeSet,
  type ReviewChange
} from '@noodl-models/AiAssistant/authoring/changeClosure';

import { edgesOf, workflowGraphName, workflowToSnapshot, type WorkflowEdge } from './workflowGraphSnapshot';
import { isRoutePort, kindFromTypeName, PORT_NEXT, PORT_ON_ERROR, routeNameFromPort } from './workflowPorts';

import type { StepKind, WorkflowDefinition, WorkflowInput, WorkflowStep } from './types';

/** An empty definition — what a "create" proposal is diffed against. */
export const NO_BASE = null;

function edgeKey(edge: WorkflowEdge): string {
  return `${edge.fromId}|${edge.fromProperty}|${edge.toId}`;
}

/**
 * Every `$path` string anywhere inside a value, however deeply nested.
 *
 * Conditions, `switch` cases and plain params all carry references the same
 * way, so this walks rather than knowing which params are DSL structures — the
 * engine's own `collectValuePaths` takes the same position.
 */
function pathsIn(value: unknown, found: string[] = []): string[] {
  if (!value || typeof value !== 'object') return found;
  if (Array.isArray(value)) {
    for (const item of value) pathsIn(item, found);
    return found;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.$path === 'string') found.push(record.$path);
  // `$literal` escapes the language: whatever is under it is data, and a
  // `{"$path": …}` inside it is a value, not a reference. Not descended into.
  if ('$literal' in record) return found;
  for (const entry of Object.values(record)) pathsIn(entry, found);
  return found;
}

/** The step ids a step's params say must have run before it. */
export function upstreamReferences(step: WorkflowStep): string[] {
  const ids = new Set<string>();
  for (const path of pathsIn(step.params)) {
    const segments = path.split('.');
    if (segments[0] !== 'upstream') continue;
    if (segments[1]) ids.add(segments[1]);
  }
  return [...ids];
}

/**
 * The workflow-specific half of §2's dependency closures.
 *
 * Rewrites `requires` on the changes that introduce or alter a step, adding the
 * change that adds each step its params reference through `upstream.<id>`.
 * Rejecting the referenced step's addition now also rejects the change that
 * needs it, instead of producing a definition the backend refuses with
 * *"references step X, which is not a step in this workflow"*.
 */
function augmentWorkflowRequirements(changes: ReviewChange[], target: WorkflowInput): ReviewChange[] {
  const stepsById = new Map((target.steps || []).map((s) => [s.id, s]));

  /** The change that brings a step id into existence, if any. */
  const addOf = new Map<string, string>();
  /** The change that takes a step id away, if any. */
  const removalOf = new Map<string, string>();
  for (const entry of changes) {
    if (entry.change.kind === 'node-added') addOf.set(entry.change.node.id, entry.id);
    else if (entry.change.kind === 'node-recreated') {
      addOf.set(entry.change.recreatedAs.id, entry.id);
      removalOf.set(entry.change.node.id, entry.id);
    } else if (entry.change.kind === 'node-removed') removalOf.set(entry.change.node.id, entry.id);
  }

  return changes.map((entry) => {
    const requires = new Set(entry.requires);

    /**
     * **Deleting a step and unwiring it is ONE decision.**
     *
     * `computeRequirements` already says "accepting a node removal requires
     * accepting the edge removals that touched it" — correct, and it makes the
     * reverse closure drop the node removal when a reader restores an edge. What
     * it does not do is the other direction: rejecting the *node* removal left
     * the *edge* removal accepted, so the reader who said "don't delete this
     * step" got the step back with nothing wired into it.
     *
     * That is not a 400 — an unreachable step is legal — which is exactly why it
     * needs stating: the closures' job is not only to prevent invalid
     * definitions but to prevent a reader getting something they did not ask
     * for. Making the requirement mutual makes the pair atomic: both or neither.
     * A cycle in `requires` is fine, both closures walk with a visited set.
     */
    if (entry.change.kind === 'connection-removed') {
      for (const endpoint of [entry.change.connection.fromId, entry.change.connection.toId]) {
        const removal = removalOf.get(endpoint);
        if (removal && removal !== entry.id) requires.add(removal);
      }
    }

    /**
     * A step's `{"$path": "upstream.X…"}` requires whatever brings X into
     * existence. The rule with no component analogue; it comes straight from
     * `validateValueReferences`.
     */
    const stepId = stepIdOf(entry.change);
    const step = stepId ? stepsById.get(stepId) : undefined;
    if (step) {
      for (const referenced of upstreamReferences(step)) {
        const add = addOf.get(referenced);
        if (add && add !== entry.id) requires.add(add);
      }
    }

    return requires.size === entry.requires.length ? entry : { ...entry, requires: [...requires] };
  });
}

/** The TARGET-side step a change is about, or undefined for edges and metadata. */
function stepIdOf(change: GraphChange): string | undefined {
  switch (change.kind) {
    case 'node-added':
    case 'node-renamed':
    case 'node-type-changed':
    case 'node-parameters-changed':
    case 'node-moved':
      return change.node.id;
    case 'node-recreated':
      return change.recreatedAs.id;
    default:
      return undefined;
  }
}

export interface WorkflowChangeSet extends AuthoringChangeSet {
  /** The definition as it stands on the backend, or null for a creation. */
  baseDefinition: WorkflowDefinition | null;
  /** The candidate. */
  targetDefinition: WorkflowInput;
}

/**
 * A proposal as a change set.
 *
 * `componentName` is the workflow's adapter name (`/#__workflow__/<id>`), which
 * both gives the read-only canvas the right runtime type and keeps the review
 * graph's model events out of `ViewerConnection` — see `workflowGraphSnapshot`.
 */
export function buildWorkflowChangeSet(
  base: WorkflowDefinition | null,
  target: WorkflowInput
): WorkflowChangeSet {
  const workflowId = target.id || base?.id || '';
  const componentName = workflowGraphName(workflowId);

  const targetSnapshot = workflowToSnapshot(target, { name: componentName });
  const baseSnapshot: GraphSnapshot = base
    ? workflowToSnapshot(base, { name: componentName })
    : emptySnapshot(componentName);

  const diff = diffGraphs(baseSnapshot, targetSnapshot);

  return {
    componentName,
    isNewComponent: !base,
    base: baseSnapshot,
    target: targetSnapshot,
    changes: augmentWorkflowRequirements(wrapChanges(diff.changes, baseSnapshot, targetSnapshot), target),
    baseDefinition: base,
    targetDefinition: target
  };
}

/** A step, minus everything that is an edge. */
function stepWithoutEdges(step: WorkflowStep): WorkflowStep {
  const { next, routes, onError, ...rest } = step;
  return rest as WorkflowStep;
}

/** Put an edge back onto the step it leaves from. */
function applyEdge(step: WorkflowStep, edge: WorkflowEdge): void {
  if (edge.fromProperty === PORT_NEXT) {
    step.next = [...(step.next || []), edge.toId];
  } else if (edge.fromProperty === PORT_ON_ERROR) {
    step.onError = [...(step.onError || []), edge.toId];
  } else if (isRoutePort(edge.fromProperty)) {
    const route = routeNameFromPort(edge.fromProperty);
    step.routes = step.routes || {};
    step.routes[route] = [...(step.routes[route] || []), edge.toId];
  }
}

/**
 * The entry, repaired rather than closed over (§1e of the assessment).
 *
 * Making the entry a dependency would either make half a proposal
 * non-excludable or produce a closure a reader cannot predict. Instead a partial
 * accept that orphans the entry gets the answer the canvas already gives when a
 * step is deleted (`WorkflowDocument.syncEntry`): keep the stored entry if it
 * survives, else the first step nothing is wired into. That is an outcome a
 * reader can anticipate, which a surprising closure is not.
 */
function repairEntry(entry: string, steps: WorkflowStep[], fallback: string | undefined): string {
  const ids = new Set(steps.map((s) => s.id));
  if (ids.has(entry)) return entry;
  if (fallback && ids.has(fallback)) return fallback;
  const withIncoming = new Set(edgesOf(steps).map((e) => e.toId));
  return steps.find((s) => !withIncoming.has(s.id))?.id || steps[0]?.id || entry;
}

export interface MaterializedWorkflow {
  workflow: WorkflowInput;
  /** The full rejection closure, so the UI can say how many were left out. */
  rejected: Set<string>;
}

/**
 * The definition a reader's selection produces.
 *
 * Starts from the base and applies exactly the accepted changes. Steps and edges
 * are replayed SEPARATELY — a `node-added` brings the step's fields but never
 * its wires, because each wire is its own excludable change — which is what
 * makes "add the step but not the edge into it" express what it looks like it
 * expresses.
 *
 * Rejecting everything returns the base unchanged, which is the same thing as
 * rejecting the proposal.
 */
export function materializeWorkflowSelection(
  changeSet: WorkflowChangeSet,
  rejectedIds: Iterable<string>
): MaterializedWorkflow {
  const rejected = excludedWith(changeSet, rejectedIds);
  const base = changeSet.baseDefinition;
  const target = changeSet.targetDefinition;

  const targetSteps = new Map((target.steps || []).map((s) => [s.id, s]));
  const baseSteps = new Map((base?.steps || []).map((s) => [s.id, s]));

  // Start from the base's steps, edges stripped; order follows the base and
  // then the target, so an accepted addition lands where the proposal put it.
  const steps = new Map<string, WorkflowStep>();
  for (const step of base?.steps || []) steps.set(step.id, stepWithoutEdges(step));

  const edges = new Map<string, WorkflowEdge>();
  for (const edge of edgesOf(base?.steps || [])) edges.set(edgeKey(edge), edge);

  /** Take a step's non-edge fields from the candidate. */
  const adopt = (id: string) => {
    const proposed = targetSteps.get(id);
    if (proposed) steps.set(id, stepWithoutEdges(proposed));
  };

  const metadata: Record<string, unknown> = {};

  for (const entry of changeSet.changes) {
    if (rejected.has(entry.id)) continue;
    const change = entry.change;
    switch (change.kind) {
      case 'node-added':
      case 'node-renamed':
      case 'node-type-changed':
      case 'node-parameters-changed':
      case 'node-moved':
      case 'node-ports-changed':
        adopt(change.node.id);
        break;
      case 'node-recreated':
        steps.delete(change.node.id);
        adopt(change.recreatedAs.id);
        break;
      case 'node-removed':
        steps.delete(change.node.id);
        break;
      case 'connection-added':
        edges.set(edgeKey(change.connection as unknown as WorkflowEdge), {
          fromId: change.connection.fromId,
          fromProperty: change.connection.fromProperty,
          toId: change.connection.toId
        });
        break;
      case 'connection-removed':
        edges.delete(edgeKey(change.connection as unknown as WorkflowEdge));
        break;
      case 'connection-rewired':
        edges.delete(edgeKey(change.before as unknown as WorkflowEdge));
        edges.set(edgeKey(change.after as unknown as WorkflowEdge), {
          fromId: change.after.fromId,
          fromProperty: change.after.fromProperty,
          toId: change.after.toId
        });
        break;
      case 'component-metadata-changed':
        // `path` arrives dotted and rooted — `metadata.entry`, not `entry`.
        // Reading it raw wrote a key nothing ever looked up, so every accepted
        // entry / concurrency / timeout change silently did nothing. Found by
        // the spec that asserts which paths the diff produces.
        metadata[change.path.replace(/^metadata\./, '')] = change.target;
        break;
      default:
        break;
    }
  }

  // Order: base order first (unchanged steps stay where they were, so a diff of
  // the RESULT against the base is about what changed rather than about order),
  // then anything the proposal added.
  const ordered: WorkflowStep[] = [];
  const seen = new Set<string>();
  for (const id of baseSteps.keys()) {
    const step = steps.get(id);
    if (step) {
      ordered.push(step);
      seen.add(id);
    }
  }
  for (const id of targetSteps.keys()) {
    if (seen.has(id)) continue;
    const step = steps.get(id);
    if (step) {
      ordered.push(step);
      seen.add(id);
    }
  }

  // Edges whose endpoints did not both survive are dropped. Not a closure
  // failure — a reader can legitimately keep a removal and reject the edge
  // removal that came with it — and a dangling edge is a 400, so the honest
  // reading of "keep this wire to a step that is gone" is that there is no wire.
  const live = new Set(ordered.map((s) => s.id));
  for (const edge of edges.values()) {
    if (!live.has(edge.fromId) || !live.has(edge.toId)) continue;
    const step = ordered.find((s) => s.id === edge.fromId);
    if (step) applyEdge(step, edge);
  }

  const merged: WorkflowInput = {
    id: target.id || base?.id,
    name: (metadata.name as string | undefined) ?? base?.name,
    entry: repairEntry((metadata.entry as string) ?? base?.entry ?? '', ordered, base?.entry),
    concurrency: (metadata.concurrency as number | undefined) ?? base?.concurrency,
    timeoutMs: (metadata.timeoutMs as number | undefined) ?? base?.timeoutMs,
    stepTimeoutMs: (metadata.stepTimeoutMs as number | undefined) ?? base?.stepTimeoutMs,
    steps: ordered
  };

  return { workflow: merged, rejected };
}

/**
 * The step kind of a node in the review graph — the diff speaks node types, and
 * a caller that wants to say "a `branch` step" needs the kind back.
 */
export function stepKindOfType(typeName: string): StepKind | undefined {
  return kindFromTypeName(typeName) as StepKind | undefined;
}
